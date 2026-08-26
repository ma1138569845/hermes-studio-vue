import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

vi.mock("@/api/hermes/knowledge-base", () => ({
  listKnowledgeBases: vi.fn(),
  getKnowledgeBase: vi.fn(),
  listFolders: vi.fn(),
  listDocuments: vi.fn(),
  getKbStats: vi.fn(),
  listWikiPages: vi.fn(),
  listEntities: vi.fn(),
  listRelationships: vi.fn(),
  listVectorizationJobs: vi.fn(),
  listCurationJobs: vi.fn(),
  startVectorize: vi.fn(),
  getDocument: vi.fn(),
}));

import * as kbApi from "@/api/hermes/knowledge-base";
import { useKnowledgeBaseStore } from "@/stores/hermes/knowledge-base";

describe("knowledge base store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("records an upstream error instead of pretending the list is empty", async () => {
    vi.mocked(kbApi.listKnowledgeBases).mockRejectedValue(
      new Error("API Error 502: Knowledge base upstream unreachable"),
    );
    const store = useKnowledgeBaseStore();

    await expect(store.fetchBases()).rejects.toThrow(/502/);
    expect(store.bases).toEqual([]);
    expect(store.loadError).toMatch(/502/);
  });

  it("loads nested folders in one request and starts polling after vectorize", async () => {
    vi.mocked(kbApi.listFolders).mockResolvedValue({
      folders: [
        { id: "root-a", kb_id: "kb1", name: "A", parent_id: null, path: "A", depth: 0, created_at: "" },
        { id: "child-b", kb_id: "kb1", name: "B", parent_id: "root-a", path: "A/B", depth: 1, created_at: "" },
      ],
    });
    vi.mocked(kbApi.startVectorize).mockResolvedValue({ job_id: "j1", doc_id: "d1", status: "processing" });
    vi.mocked(kbApi.getDocument).mockResolvedValue({
      id: "d1",
      kb_id: "kb1",
      folder_id: null,
      title: null,
      file_name: "a.pdf",
      file_type: "pdf",
      file_size: 1,
      file_path: "a.pdf",
      parse_status: "processing",
      summary_status: "pending",
      summary_text: null,
      chunk_count: 0,
      vector_count: 0,
      error_message: null,
      created_at: "",
      updated_at: "",
    });

    const store = useKnowledgeBaseStore();
    await store.fetchFolders("kb1");
    expect(kbApi.listFolders).toHaveBeenCalledWith("kb1", { all: true });
    expect(store.folders).toHaveLength(2);

    await store.vectorizeDoc("kb1", "d1");
    expect(store.currentDoc?.parse_status).toBe("processing");
    store.stopPolling();
  });
});
