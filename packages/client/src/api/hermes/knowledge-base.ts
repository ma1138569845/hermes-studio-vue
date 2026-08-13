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
  KbStats,
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

export function listFolders(kbId: string): Promise<{ folders: KnowledgeFolder[] }> {
  return request<{ folders: KnowledgeFolder[] }>(`/api/knowledge/bases/${kbId}/folders`);
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

export function getDocumentChunks(docId: string): Promise<{ chunks: KnowledgeChunk[] }> {
  return request<{ chunks: KnowledgeChunk[] }>(`/api/knowledge/docs/${docId}/chunks`);
}

// ─── Search ─────────────────────────────────────────────────────────

export function searchKnowledgeBase(kbId: string, query: string, limit = 10): Promise<{ results: SearchResult[] }> {
  return request<{ results: SearchResult[] }>(`/api/knowledge/bases/${kbId}/search`, {
    method: "POST",
    body: JSON.stringify({ query, limit }),
  });
}

// ─── Wiki (read-only: pages are LLM-generated upstream) ─────────────

export function listWikiPages(kbId: string): Promise<{ pages: WikiPage[] }> {
  return request<{ pages: WikiPage[] }>(`/api/knowledge/bases/${kbId}/wiki`);
}

export function getWikiPage(wikiId: string): Promise<WikiPage> {
  return request<WikiPage>(`/api/knowledge/wiki/${wikiId}`);
}

// ─── Knowledge Graph ────────────────────────────────────────────────

export function listEntities(kbId: string): Promise<{ entities: KnowledgeEntity[] }> {
  return request<{ entities: KnowledgeEntity[] }>(`/api/knowledge/bases/${kbId}/entities`);
}

export function listRelationships(kbId: string): Promise<{ relationships: KnowledgeRelationship[] }> {
  return request<{ relationships: KnowledgeRelationship[] }>(`/api/knowledge/bases/${kbId}/relationships`);
}

// ─── Stats ──────────────────────────────────────────────────────────

export function getKbStats(kbId: string): Promise<KbStats> {
  return request<KbStats>(`/api/knowledge/bases/${kbId}/stats`);
}
