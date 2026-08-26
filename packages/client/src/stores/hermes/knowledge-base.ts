import { defineStore } from "pinia";
import { ref, computed } from "vue";
import * as kbApi from "@/api/hermes/knowledge-base";
import type {
  KnowledgeBase,
  KnowledgeFolder,
  KnowledgeDocument,
  KnowledgeChunk,
  WikiPage,
  KbStats,
  SearchResult,
  SearchMode,
  DocStatus,
  KnowledgeEntity,
  KnowledgeRelationship,
  VectorizationJob,
  CurationJob,
  WikiReviewStatus,
} from "@/types/knowledge-base";

const POLL_MS = 2500;

export const useKnowledgeBaseStore = defineStore("knowledgeBase", () => {
  const bases = ref<KnowledgeBase[]>([]);
  const currentKb = ref<KnowledgeBase | null>(null);
  const folders = ref<KnowledgeFolder[]>([]);
  const documents = ref<KnowledgeDocument[]>([]);
  const docTotal = ref(0);
  const docPage = ref(1);
  const docPageSize = ref(20);
  const currentDoc = ref<KnowledgeDocument | null>(null);
  const chunks = ref<KnowledgeChunk[]>([]);
  const wikiPages = ref<WikiPage[]>([]);
  const currentWikiPage = ref<WikiPage | null>(null);
  const stats = ref<KbStats | null>(null);
  const searchResults = ref<SearchResult[]>([]);
  const entities = ref<KnowledgeEntity[]>([]);
  const relationships = ref<KnowledgeRelationship[]>([]);
  const vectorJobs = ref<VectorizationJob[]>([]);
  const curationJobs = ref<CurationJob[]>([]);
  const loading = ref(false);
  const searchLoading = ref(false);
  const loadError = ref<string | null>(null);

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let pollKbId: string | null = null;
  let lastDocOpts: { folder_id?: string; parse_status?: string; keyword?: string } = {};

  const systemBases = computed(() => bases.value.filter((b) => b.is_system));
  const userBases = computed(() => bases.value.filter((b) => !b.is_system));

  const docsByStatus = computed(() => {
    const map: Record<DocStatus, KnowledgeDocument[]> = {
      pending: [],
      processing: [],
      completed: [],
      failed: [],
    };
    for (const doc of documents.value) {
      map[doc.parse_status]?.push(doc);
    }
    return map;
  });

  const hasActiveJobs = computed(() => {
    if (documents.value.some((d) => d.parse_status === "processing")) return true;
    if (vectorJobs.value.some((j) => j.status === "processing" || j.status === "pending")) return true;
    if (curationJobs.value.some((j) => j.status === "processing" || j.status === "running" || j.status === "pending")) {
      return true;
    }
    return false;
  });

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    pollKbId = null;
  }

  function startPolling(kbId: string) {
    if (pollTimer && pollKbId === kbId) return;
    stopPolling();
    pollKbId = kbId;
    pollTimer = setInterval(() => {
      void refreshBusy(kbId);
    }, POLL_MS);
  }

  async function refreshBusy(kbId: string) {
    try {
      await Promise.all([
        fetchDocuments(kbId, lastDocOpts, { silent: true }),
        fetchStats(kbId),
        fetchJobs(kbId),
      ]);
      if (!hasActiveJobs.value) stopPolling();
    } catch {
      // Keep polling; a transient 502 should not freeze the pipeline view.
    }
  }

  async function fetchBases() {
    loading.value = true;
    loadError.value = null;
    try {
      const res = await kbApi.listKnowledgeBases();
      bases.value = res.bases || [];
    } catch (err) {
      bases.value = [];
      loadError.value = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createBase(name: string, description: string) {
    const kb = await kbApi.createKnowledgeBase(name, description);
    bases.value.push(kb);
    return kb;
  }

  async function deleteBase(kbId: string) {
    await kbApi.deleteKnowledgeBase(kbId);
    bases.value = bases.value.filter((b) => b.id !== kbId);
    if (currentKb.value?.id === kbId) currentKb.value = null;
  }

  async function selectBase(kbId: string) {
    loadError.value = null;
    try {
      const listed = bases.value.find((b) => b.id === kbId);
      currentKb.value = listed || (await kbApi.getKnowledgeBase(kbId));
    } catch (err) {
      currentKb.value = null;
      loadError.value = err instanceof Error ? err.message : String(err);
      return;
    }
    await Promise.allSettled([
      fetchFolders(kbId),
      fetchDocuments(kbId),
      fetchStats(kbId),
      fetchWikiPages(kbId),
      fetchGraph(kbId),
      fetchJobs(kbId),
    ]);
    if (hasActiveJobs.value) startPolling(kbId);
  }

  async function fetchFolders(kbId: string) {
    const res = await kbApi.listFolders(kbId, { all: true });
    folders.value = res.folders || [];
  }

  async function createFolder(kbId: string, name: string, parentId?: string | null) {
    const folder = await kbApi.createFolder(kbId, name, parentId);
    folders.value.push(folder);
    return folder;
  }

  async function deleteFolder(kbId: string, folderId: string) {
    await kbApi.deleteFolder(kbId, folderId);
    folders.value = folders.value.filter((f) => f.id !== folderId);
  }

  async function fetchDocuments(
    kbId: string,
    opts?: { folder_id?: string; parse_status?: string; keyword?: string; page?: number; page_size?: number },
    flags?: { silent?: boolean },
  ) {
    lastDocOpts = {
      folder_id: opts?.folder_id,
      parse_status: opts?.parse_status,
      keyword: opts?.keyword,
    };
    if (opts?.page) docPage.value = opts.page;
    if (opts?.page_size) docPageSize.value = opts.page_size;
    if (!flags?.silent) loading.value = true;
    try {
      const res = await kbApi.listDocuments(kbId, {
        ...lastDocOpts,
        page: opts?.page ?? docPage.value,
        page_size: opts?.page_size ?? docPageSize.value,
      });
      documents.value = res.documents || [];
      docTotal.value = res.total ?? res.documents?.length ?? 0;
      if (res.page) docPage.value = res.page;
      if (res.page_size) docPageSize.value = res.page_size;
    } finally {
      if (!flags?.silent) loading.value = false;
    }
  }

  async function uploadDocs(kbId: string, file: File, folderId?: string | null) {
    const doc = await kbApi.uploadDocument(kbId, file, folderId);
    documents.value.unshift(doc);
    docTotal.value += 1;
    return doc;
  }

  async function deleteDoc(kbId: string, docId: string) {
    await kbApi.deleteDocument(kbId, docId);
    documents.value = documents.value.filter((d) => d.id !== docId);
    docTotal.value = Math.max(0, docTotal.value - 1);
    if (currentDoc.value?.id === docId) currentDoc.value = null;
  }

  async function bulkDelete(kbId: string, docIds: string[]) {
    const res = await kbApi.bulkDeleteDocuments(kbId, docIds);
    const removed = new Set(docIds);
    documents.value = documents.value.filter((d) => !removed.has(d.id));
    if (currentDoc.value && removed.has(currentDoc.value.id)) currentDoc.value = null;
    await fetchDocuments(kbId, lastDocOpts);
    await fetchStats(kbId);
    return res;
  }

  async function selectDocument(docId: string) {
    const doc = await kbApi.getDocument(docId);
    currentDoc.value = doc;
    const idx = documents.value.findIndex((d) => d.id === docId);
    if (idx >= 0) documents.value[idx] = doc;
    return doc;
  }

  async function fetchChunks(docId: string) {
    const res = await kbApi.getDocumentChunks(docId);
    chunks.value = res.chunks || [];
    return chunks.value;
  }

  async function patchChunk(chunkId: string, patch: { content?: string; is_enabled?: boolean }) {
    const res = await kbApi.updateChunk(chunkId, patch);
    if (res.chunks) chunks.value = res.chunks;
    return res;
  }

  async function removeChunk(chunkId: string) {
    const res = await kbApi.deleteChunk(chunkId);
    if (res.chunks) chunks.value = res.chunks;
    else chunks.value = chunks.value.filter((c) => c.id !== chunkId);
    return res;
  }

  async function vectorizeDoc(kbId: string, docId: string) {
    const ack = await kbApi.startVectorize(docId);
    await selectDocument(docId);
    startPolling(kbId);
    return ack;
  }

  async function summarizeDoc(docId: string) {
    const res = await kbApi.generateSummary(docId);
    await selectDocument(docId);
    return res;
  }

  async function graphDoc(kbId: string, docId: string) {
    const res = await kbApi.buildGraph(docId);
    await Promise.all([selectDocument(docId), fetchGraph(kbId)]);
    return res;
  }

  async function wikiDoc(kbId: string, docId: string, curate = false) {
    const res = await kbApi.generateDocWiki(docId, curate);
    await Promise.all([selectDocument(docId), fetchWikiPages(kbId)]);
    if (curate) startPolling(kbId);
    return res;
  }

  async function rebuildBase(kbId: string) {
    const res = await kbApi.rebuildKnowledgeBase(kbId);
    startPolling(kbId);
    await fetchDocuments(kbId, lastDocOpts);
    return res;
  }

  async function bulkWiki(kbId: string, opts?: { folderId?: string | null; docIds?: string[] }) {
    const res = await kbApi.startBulkWiki(kbId, opts);
    startPolling(kbId);
    return res;
  }

  async function hierarchicalWiki(kbId: string, opts?: { folderId?: string | null; curate?: boolean }) {
    const res = await kbApi.startHierarchicalWiki(kbId, opts);
    await fetchWikiPages(kbId);
    if (opts?.curate) startPolling(kbId);
    return res;
  }

  async function curateWiki(kbId: string, opts?: { folderId?: string | null; pageIds?: string[]; reviewStatus?: string }) {
    const res = await kbApi.startCuration(kbId, opts);
    startPolling(kbId);
    return res;
  }

  async function folderWiki(kbId: string, folderId: string | null, curate = false) {
    const res = await kbApi.generateFolderWiki(kbId, folderId, { curate });
    await fetchWikiPages(kbId);
    if (curate) startPolling(kbId);
    return res;
  }

  async function search(kbId: string, query: string, opts?: { limit?: number; mode?: SearchMode }) {
    searchLoading.value = true;
    try {
      const res = await kbApi.searchKnowledgeBase(kbId, query, opts);
      searchResults.value = res.results || [];
      return searchResults.value;
    } finally {
      searchLoading.value = false;
    }
  }

  async function fetchWikiPages(kbId: string, reviewStatus?: string) {
    const res = await kbApi.listWikiPages(kbId, reviewStatus ? { review_status: reviewStatus } : undefined);
    wikiPages.value = res.pages || [];
  }

  async function fetchWikiPage(wikiId: string) {
    const page = await kbApi.getWikiPage(wikiId);
    currentWikiPage.value = page;
    return page;
  }

  async function reviewWiki(wikiId: string, status: WikiReviewStatus) {
    const res = await kbApi.updateWikiReview(wikiId, status);
    wikiPages.value = wikiPages.value.map((p) =>
      p.id === wikiId ? { ...p, review_status: res.review_status } : p,
    );
    if (currentWikiPage.value?.id === wikiId) {
      currentWikiPage.value = { ...currentWikiPage.value, review_status: res.review_status };
    }
    return res;
  }

  async function evaluateWiki(wikiId: string) {
    const res = await kbApi.evaluateWikiQuality(wikiId);
    wikiPages.value = wikiPages.value.map((p) =>
      p.id === wikiId ? { ...p, quality_score: res.quality_score, quality_report: res.quality_report } : p,
    );
    if (currentWikiPage.value?.id === wikiId) {
      currentWikiPage.value = {
        ...currentWikiPage.value,
        quality_score: res.quality_score,
        quality_report: res.quality_report,
      };
    }
    return res;
  }

  async function fetchGraph(kbId: string) {
    const [ent, rel] = await Promise.all([kbApi.listEntities(kbId), kbApi.listRelationships(kbId)]);
    entities.value = ent.entities || [];
    relationships.value = rel.relationships || [];
  }

  async function fetchJobs(kbId: string) {
    const [vec, cur] = await Promise.allSettled([
      kbApi.listVectorizationJobs(kbId),
      kbApi.listCurationJobs(kbId),
    ]);
    if (vec.status === "fulfilled") vectorJobs.value = vec.value.jobs || [];
    if (cur.status === "fulfilled") curationJobs.value = cur.value.jobs || [];
  }

  async function fetchStats(kbId: string) {
    stats.value = await kbApi.getKbStats(kbId);
  }

  function resetDetail() {
    stopPolling();
    currentKb.value = null;
    folders.value = [];
    documents.value = [];
    currentDoc.value = null;
    chunks.value = [];
    wikiPages.value = [];
    currentWikiPage.value = null;
    stats.value = null;
    searchResults.value = [];
    entities.value = [];
    relationships.value = [];
    vectorJobs.value = [];
    curationJobs.value = [];
    loadError.value = null;
  }

  return {
    bases,
    currentKb,
    folders,
    documents,
    docTotal,
    docPage,
    docPageSize,
    currentDoc,
    chunks,
    wikiPages,
    currentWikiPage,
    stats,
    searchResults,
    entities,
    relationships,
    vectorJobs,
    curationJobs,
    loading,
    searchLoading,
    loadError,
    systemBases,
    userBases,
    docsByStatus,
    hasActiveJobs,
    fetchBases,
    createBase,
    deleteBase,
    selectBase,
    fetchFolders,
    createFolder,
    deleteFolder,
    fetchDocuments,
    uploadDocs,
    deleteDoc,
    bulkDelete,
    selectDocument,
    fetchChunks,
    patchChunk,
    removeChunk,
    vectorizeDoc,
    summarizeDoc,
    graphDoc,
    wikiDoc,
    rebuildBase,
    bulkWiki,
    hierarchicalWiki,
    curateWiki,
    folderWiki,
    search,
    fetchWikiPages,
    fetchWikiPage,
    reviewWiki,
    evaluateWiki,
    fetchGraph,
    fetchJobs,
    fetchStats,
    startPolling,
    stopPolling,
    resetDetail,
  };
});
