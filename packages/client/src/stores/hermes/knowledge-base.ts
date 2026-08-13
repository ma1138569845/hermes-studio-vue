import { defineStore } from "pinia";
import { ref, computed } from "vue";
import * as kbApi from "@/api/hermes/knowledge-base";
import type {
  KnowledgeBase,
  KnowledgeFolder,
  KnowledgeDocument,
  WikiPage,
  KbStats,
  SearchResult,
  DocStatus,
} from "@/types/knowledge-base";

export const useKnowledgeBaseStore = defineStore("knowledgeBase", () => {
  // ─── State ────────────────────────────────────────────────────────
  const bases = ref<KnowledgeBase[]>([]);
  const currentKb = ref<KnowledgeBase | null>(null);
  const folders = ref<KnowledgeFolder[]>([]);
  const documents = ref<KnowledgeDocument[]>([]);
  const currentDoc = ref<KnowledgeDocument | null>(null);
  const wikiPages = ref<WikiPage[]>([]);
  const currentWikiPage = ref<WikiPage | null>(null);
  const stats = ref<KbStats | null>(null);
  const searchResults = ref<SearchResult[]>([]);
  const loading = ref(false);
  const searchLoading = ref(false);

  // ─── Computed ─────────────────────────────────────────────────────
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

  // ─── Base CRUD ────────────────────────────────────────────────────
  async function fetchBases() {
    loading.value = true;
    try {
      const res = await kbApi.listKnowledgeBases();
      bases.value = res.bases;
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
    const kb = bases.value.find((b) => b.id === kbId) || null;
    if (!kb) {
      currentKb.value = null;
      return;
    }
    currentKb.value = kb;
    await Promise.all([fetchFolders(kbId), fetchDocuments(kbId), fetchStats(kbId)]);
  }

  // ─── Folders ──────────────────────────────────────────────────────
  async function fetchFolders(kbId: string) {
    const res = await kbApi.listFolders(kbId);
    folders.value = res.folders;
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

  // ─── Documents ────────────────────────────────────────────────────
  async function fetchDocuments(kbId: string, opts?: { folder_id?: string; parse_status?: string; keyword?: string }) {
    loading.value = true;
    try {
      const res = await kbApi.listDocuments(kbId, opts);
      documents.value = res.documents;
    } finally {
      loading.value = false;
    }
  }

  async function uploadDocs(kbId: string, file: File, folderId?: string | null) {
    const doc = await kbApi.uploadDocument(kbId, file, folderId);
    documents.value.unshift(doc);
    return doc;
  }

  async function deleteDoc(kbId: string, docId: string) {
    await kbApi.deleteDocument(kbId, docId);
    documents.value = documents.value.filter((d) => d.id !== docId);
    if (currentDoc.value?.id === docId) currentDoc.value = null;
  }

  async function selectDocument(docId: string) {
    const doc = await kbApi.getDocument(docId);
    currentDoc.value = doc;
    return doc;
  }

  // ─── Search ───────────────────────────────────────────────────────
  async function search(kbId: string, query: string, limit = 10) {
    searchLoading.value = true;
    try {
      const res = await kbApi.searchKnowledgeBase(kbId, query, limit);
      searchResults.value = res.results;
      return res.results;
    } finally {
      searchLoading.value = false;
    }
  }

  // ─── Wiki ─────────────────────────────────────────────────────────
  async function fetchWikiPages(kbId: string) {
    const res = await kbApi.listWikiPages(kbId);
    wikiPages.value = res.pages;
  }

  async function fetchWikiPage(wikiId: string) {
    const page = await kbApi.getWikiPage(wikiId);
    currentWikiPage.value = page;
    return page;
  }

  // ─── Stats ────────────────────────────────────────────────────────
  async function fetchStats(kbId: string) {
    stats.value = await kbApi.getKbStats(kbId);
  }

  return {
    // State
    bases,
    currentKb,
    folders,
    documents,
    currentDoc,
    wikiPages,
    currentWikiPage,
    stats,
    searchResults,
    loading,
    searchLoading,
    // Computed
    systemBases,
    userBases,
    docsByStatus,
    // Actions
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
    selectDocument,
    search,
    fetchWikiPages,
    fetchWikiPage,
    fetchStats,
  };
});
