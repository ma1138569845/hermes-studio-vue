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

export interface WikiPage {
  id: string;
  kb_id?: string;
  title: string;
  slug?: string;
  content?: string;
  status?: string;
  review_status?: string;
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

export interface SearchResult {
  score: number;
  filename: string;
  chapter: string;
  text: string;
  metadata: Record<string, unknown>;
}

export interface KbStats {
  total_documents: number;
  completed: number;
  processing: number;
  failed: number;
  total_size: number;
  orphaned: number;
}
