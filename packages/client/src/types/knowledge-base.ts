// ─── Knowledge Base types (mirror dechnicAuditor-agent RAG shapes) ──

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  kb_type: string;
  root_path: string;
  qdrant_collection: string;
  embedding_model: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  stats?: KbStats;
}

export interface KnowledgeFolder {
  id: string;
  kb_id: string;
  name: string;
  parent_id: string | null;
  path: string;
  depth: number;
  created_at: string;
}

export type DocStatus = "pending" | "processing" | "completed" | "failed";

export interface KnowledgeDocument {
  id: string;
  kb_id: string;
  folder_id: string | null;
  title: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  parse_status: DocStatus;
  summary_status: string;
  summary_text: string | null;
  chunk_count: number;
  vector_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChunk {
  id: string;
  chunk_index: number;
  chunk_type: string | null;
  content: string;
  char_count: number;
  is_enabled: boolean;
  metadata: Record<string, unknown>;
}

export type WikiReviewStatus = "pending" | "approved" | "rejected";

export interface WikiPage {
  id: string;
  kb_id?: string;
  doc_id?: string | null;
  folder_id?: string | null;
  folder_path?: string;
  title: string;
  slug?: string;
  content?: string;
  status?: string;
  review_status?: WikiReviewStatus | string;
  source?: "folder" | "doc" | "unknown" | string;
  quality_score?: number | null;
  quality_report?: Record<string, unknown> | null;
  updated_at: string;
}

export interface KnowledgeEntity {
  id: string;
  name: string;
  type: string;
  description: string;
}

export interface KnowledgeRelationship {
  id: string;
  source: string;
  target: string;
  relation: string;
  description: string;
}

export type SearchMode = "vector" | "graph" | "wiki" | "graph_wiki" | "unified";

export interface SearchResult {
  score: number;
  filename?: string;
  chapter?: string;
  text?: string;
  title?: string;
  wiki_id?: string;
  type?: string;
  answer?: string;
  entities?: KnowledgeEntity[];
  relationships?: KnowledgeRelationship[];
  metadata?: Record<string, unknown>;
}

export interface KbStats {
  total_documents: number;
  completed: number;
  processing: number;
  failed: number;
  total_size: number;
  orphaned: number;
}

export interface VectorizationJob {
  id: string;
  kb_id: string;
  doc_id: string;
  status: string;
  progress: number;
  chunks_done?: number;
  chunks_total?: number;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface CurationJob {
  id: string;
  kb_id: string;
  folder_id?: string | null;
  job_type?: string;
  status: string;
  input_pages?: unknown;
  output_pages?: unknown;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface DocPreview {
  id: string;
  path: string;
  file_name: string;
  content: string;
  lines: number;
  size: number;
  summary: string;
}

export interface PipelineJobAck {
  job_id?: string | null;
  doc_id?: string;
  status?: string;
  skipped?: boolean;
  reason?: string;
  wiki_id?: string;
  [key: string]: unknown;
}
