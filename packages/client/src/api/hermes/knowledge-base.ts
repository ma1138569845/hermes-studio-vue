import { request, getApiKey, getActiveProfileName, getBaseUrlValue } from "../client";
import type {
  KnowledgeBase,
  KnowledgeFolder,
  KnowledgeDocument,
  KnowledgeChunk,
  WikiPage,
  KnowledgeEntity,
  KnowledgeRelationship,
  SearchResult,
  SearchMode,
  KbStats,
  VectorizationJob,
  CurationJob,
  DocPreview,
  PipelineJobAck,
  WikiReviewStatus,
} from "@/types/knowledge-base";

// ─── Knowledge Base CRUD ────────────────────────────────────────────

export function listKnowledgeBases(): Promise<{ bases: KnowledgeBase[] }> {
  return request<{ bases: KnowledgeBase[] }>("/api/knowledge/bases");
}

export function createKnowledgeBase(name: string, description: string): Promise<KnowledgeBase> {
  return request<KnowledgeBase>("/api/knowledge/bases", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export function getKnowledgeBase(kbId: string): Promise<KnowledgeBase> {
  return request<KnowledgeBase>(`/api/knowledge/bases/${kbId}`);
}

export function deleteKnowledgeBase(kbId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/knowledge/bases/${kbId}`, {
    method: "DELETE",
  });
}

// ─── Folders ────────────────────────────────────────────────────────

export function listFolders(
  kbId: string,
  opts?: { parent_id?: string | null; all?: boolean },
): Promise<{ folders: KnowledgeFolder[] }> {
  const params = new URLSearchParams();
  if (opts?.all) params.set("all", "true");
  else if (opts?.parent_id) params.set("parent_id", opts.parent_id);
  const qs = params.toString();
  return request<{ folders: KnowledgeFolder[] }>(
    `/api/knowledge/bases/${kbId}/folders${qs ? `?${qs}` : ""}`,
  );
}

export function createFolder(kbId: string, name: string, parentId?: string | null): Promise<KnowledgeFolder> {
  return request<KnowledgeFolder>(`/api/knowledge/bases/${kbId}/folders`, {
    method: "POST",
    body: JSON.stringify({ name, parent_id: parentId || null }),
  });
}

export function deleteFolder(kbId: string, folderId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/knowledge/bases/${kbId}/folders/${folderId}`, {
    method: "DELETE",
  });
}

function folderSegment(folderId?: string | null): string {
  return folderId ? `/folders/${folderId}` : "";
}

// ─── Documents ──────────────────────────────────────────────────────

export interface ListDocumentsResponse {
  documents: KnowledgeDocument[];
  total: number;
  page: number;
  page_size: number;
}

export function listDocuments(
  kbId: string,
  opts?: { folder_id?: string; parse_status?: string; keyword?: string; page?: number; page_size?: number },
): Promise<ListDocumentsResponse> {
  const params = new URLSearchParams();
  if (opts?.folder_id) params.set("folder_id", opts.folder_id);
  if (opts?.parse_status) params.set("parse_status", opts.parse_status);
  if (opts?.keyword) params.set("keyword", opts.keyword);
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.page_size) params.set("page_size", String(opts.page_size));
  const qs = params.toString();
  return request<ListDocumentsResponse>(`/api/knowledge/bases/${kbId}/docs${qs ? `?${qs}` : ""}`);
}

export function getDocument(docId: string): Promise<KnowledgeDocument> {
  return request<KnowledgeDocument>(`/api/knowledge/docs/${docId}`);
}

export function getDocumentPreview(docId: string): Promise<DocPreview> {
  return request<DocPreview>(`/api/knowledge/docs/${docId}/preview`);
}

// The upstream RAG engine accepts one file per multipart upload. The `file` is
// posted raw; the target folder travels as a query parameter (not a form field).
export async function uploadDocument(kbId: string, file: File, folderId?: string | null): Promise<KnowledgeDocument> {
  const base = getBaseUrlValue();
  const formData = new FormData();
  formData.append("file", file);

  const params = new URLSearchParams();
  if (folderId) params.set("folder_id", folderId);
  const qs = params.toString();

  const headers: Record<string, string> = {};
  const token = getApiKey();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const profileName = getActiveProfileName();
  if (profileName) headers["X-Hermes-Profile"] = profileName;

  const res = await fetch(`${base}/api/knowledge/bases/${kbId}/docs/upload${qs ? `?${qs}` : ""}`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(body.detail || body.error || `Upload failed: ${res.status}`);
  }
  const data = await res.json();
  return data.document || data.existing;
}

export function deleteDocument(kbId: string, docId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/knowledge/bases/${kbId}/docs/${docId}`, {
    method: "DELETE",
  });
}

export function bulkDeleteDocuments(
  kbId: string,
  docIds: string[],
): Promise<{ deleted: number; failed: number }> {
  return request<{ deleted: number; failed: number }>(`/api/knowledge/bases/${kbId}/bulk-delete`, {
    method: "POST",
    body: JSON.stringify({ doc_ids: docIds }),
  });
}

export function getDocumentChunks(docId: string): Promise<{ chunks: KnowledgeChunk[] }> {
  return request<{ chunks: KnowledgeChunk[] }>(`/api/knowledge/docs/${docId}/chunks`);
}

export function updateChunk(
  chunkId: string,
  patch: { content?: string; is_enabled?: boolean },
): Promise<{ chunks: KnowledgeChunk[] }> {
  return request<{ chunks: KnowledgeChunk[] }>(`/api/knowledge/chunks/${chunkId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteChunk(chunkId: string): Promise<{ deleted?: boolean; chunks?: KnowledgeChunk[] }> {
  return request<{ deleted?: boolean; chunks?: KnowledgeChunk[] }>(`/api/knowledge/chunks/${chunkId}`, {
    method: "DELETE",
  });
}

// ─── Pipeline ───────────────────────────────────────────────────────

export function startVectorize(docId: string): Promise<PipelineJobAck> {
  return request<PipelineJobAck>(`/api/knowledge/docs/${docId}/vectorize`, { method: "POST" });
}

export function generateSummary(docId: string): Promise<{ id: string; summary: string; status: string }> {
  return request<{ id: string; summary: string; status: string }>(`/api/knowledge/docs/${docId}/summary`, {
    method: "POST",
  });
}

export function buildGraph(docId: string): Promise<{ id: string; entities: number; relationships: number }> {
  return request<{ id: string; entities: number; relationships: number }>(
    `/api/knowledge/docs/${docId}/graph`,
    { method: "POST" },
  );
}

export function generateDocWiki(docId: string, curate = false): Promise<PipelineJobAck> {
  return request<PipelineJobAck>(`/api/knowledge/docs/${docId}/wiki`, {
    method: "POST",
    body: JSON.stringify({ curate }),
  });
}

export function rebuildKnowledgeBase(kbId: string): Promise<{ kb_id: string; rebuild_jobs: string[]; queued_documents: number }> {
  return request(`/api/knowledge/bases/${kbId}/rebuild`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function startBulkWiki(
  kbId: string,
  opts?: { folderId?: string | null; docIds?: string[] },
): Promise<PipelineJobAck> {
  return request<PipelineJobAck>(
    `/api/knowledge/bases/${kbId}${folderSegment(opts?.folderId)}/bulk-wiki`,
    {
      method: "POST",
      body: JSON.stringify({ doc_ids: opts?.docIds || null }),
    },
  );
}

export function startHierarchicalWiki(
  kbId: string,
  opts?: { folderId?: string | null; curate?: boolean },
): Promise<PipelineJobAck> {
  return request<PipelineJobAck>(
    `/api/knowledge/bases/${kbId}${folderSegment(opts?.folderId)}/hierarchical-wiki`,
    {
      method: "POST",
      body: JSON.stringify({ curate: Boolean(opts?.curate) }),
    },
  );
}

export function startCuration(
  kbId: string,
  opts?: { folderId?: string | null; pageIds?: string[]; reviewStatus?: string },
): Promise<PipelineJobAck> {
  return request<PipelineJobAck>(
    `/api/knowledge/bases/${kbId}${folderSegment(opts?.folderId)}/curate`,
    {
      method: "POST",
      body: JSON.stringify({
        page_ids: opts?.pageIds || null,
        review_status: opts?.reviewStatus || null,
      }),
    },
  );
}

export function generateFolderWiki(
  kbId: string,
  folderId: string | null,
  opts?: { title?: string; curate?: boolean },
): Promise<PipelineJobAck> {
  return request<PipelineJobAck>(
    `/api/knowledge/bases/${kbId}/folders/${folderId || "root"}/wiki`,
    {
      method: "POST",
      body: JSON.stringify({ title: opts?.title || "", curate: Boolean(opts?.curate) }),
    },
  );
}

export function getVectorizationJob(jobId: string): Promise<VectorizationJob> {
  return request<VectorizationJob>(`/api/knowledge/jobs/${jobId}`);
}

export function listVectorizationJobs(kbId: string): Promise<{ jobs: VectorizationJob[] }> {
  return request<{ jobs: VectorizationJob[] }>(`/api/knowledge/bases/${kbId}/vectorization-jobs`);
}

export function listCurationJobs(kbId: string): Promise<{ jobs: CurationJob[] }> {
  return request<{ jobs: CurationJob[] }>(`/api/knowledge/bases/${kbId}/curation-jobs`);
}

// ─── Search ─────────────────────────────────────────────────────────

export function searchKnowledgeBase(
  kbId: string,
  query: string,
  opts?: { limit?: number; mode?: SearchMode },
): Promise<{ results: SearchResult[] }> {
  return request<{ results: SearchResult[] }>(`/api/knowledge/bases/${kbId}/search`, {
    method: "POST",
    body: JSON.stringify({
      query,
      limit: opts?.limit ?? 10,
      mode: opts?.mode ?? "vector",
    }),
  });
}

// ─── Wiki ───────────────────────────────────────────────────────────

export function listWikiPages(
  kbId: string,
  opts?: { review_status?: string },
): Promise<{ pages: WikiPage[] }> {
  const params = new URLSearchParams();
  if (opts?.review_status) params.set("review_status", opts.review_status);
  const qs = params.toString();
  return request<{ pages: WikiPage[] }>(`/api/knowledge/bases/${kbId}/wiki${qs ? `?${qs}` : ""}`);
}

export function getWikiPage(wikiId: string): Promise<WikiPage> {
  return request<WikiPage>(`/api/knowledge/wiki/${wikiId}`);
}

export function updateWikiReview(
  wikiId: string,
  reviewStatus: WikiReviewStatus,
): Promise<{ id: string; review_status: string }> {
  return request<{ id: string; review_status: string }>(`/api/knowledge/wiki/${wikiId}/review`, {
    method: "PATCH",
    body: JSON.stringify({ review_status: reviewStatus }),
  });
}

export function evaluateWikiQuality(
  wikiId: string,
): Promise<{ id: string; quality_score: number; quality_report: Record<string, unknown> }> {
  return request(`/api/knowledge/wiki/${wikiId}/evaluate-quality`, { method: "POST" });
}

// ─── Knowledge Graph ────────────────────────────────────────────────

export function listEntities(kbId: string): Promise<{ entities: KnowledgeEntity[] }> {
  return request<{ entities: KnowledgeEntity[] }>(`/api/knowledge/bases/${kbId}/entities`);
}

export function listRelationships(kbId: string): Promise<{ relationships: KnowledgeRelationship[] }> {
  return request<{ relationships: KnowledgeRelationship[] }>(
    `/api/knowledge/bases/${kbId}/relationships`,
  );
}

// ─── Stats ──────────────────────────────────────────────────────────

export function getKbStats(kbId: string): Promise<KbStats> {
  return request<KbStats>(`/api/knowledge/bases/${kbId}/stats`);
}
