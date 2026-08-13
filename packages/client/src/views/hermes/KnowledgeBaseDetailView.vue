<script setup lang="ts">
import { ref, onMounted, computed, h } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NButton,
  NTabs,
  NTabPane,
  NInput,
  NTag,
  NSpin,
  NModal,
  NPopconfirm,
  NUpload,
  NTree,
  NDataTable,
  NEmpty,
  NSpace,
  useMessage,
} from "naive-ui";
import type { DataTableColumns, TreeOption, UploadFileInfo } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useKnowledgeBaseStore } from "@/stores/hermes/knowledge-base";
import type { KnowledgeDocument, DocStatus, SearchResult, WikiPage } from "@/types/knowledge-base";

const { t } = useI18n();
const message = useMessage();
const route = useRoute();
const router = useRouter();
const store = useKnowledgeBaseStore();

const kbId = computed(() => route.params.kbId as string);
const activeTab = ref("documents");

// ─── Folder state ───────────────────────────────────────────────────
const selectedFolderId = ref<string | null>(null);
const showCreateFolder = ref(false);
const newFolderName = ref("");

// ─── Upload ─────────────────────────────────────────────────────────
const uploading = ref(false);

// ─── Search ─────────────────────────────────────────────────────────
const searchQuery = ref("");
const searching = ref(false);

// ─── Wiki (read-only preview of upstream-generated pages) ───────────
const showWiki = ref(false);

// ─── Document preview ───────────────────────────────────────────────
const previewDoc = ref<KnowledgeDocument | null>(null);
const showPreview = ref(false);

onMounted(async () => {
  await store.selectBase(kbId.value);
  if (store.currentKb) {
    await store.fetchWikiPages(kbId.value);
  }
});

// ─── Folder tree data ───────────────────────────────────────────────
const treeData = computed<TreeOption[]>(() => {
  function buildTree(parentId: string | null): TreeOption[] {
    return store.folders
      .filter((f) => f.parent_id === parentId)
      .map((f) => ({
        key: f.id,
        label: f.name,
        children: buildTree(f.id),
      }));
  }
  return [
    {
      key: "__root__",
      label: store.currentKb?.name || t("knowledgeBase.allDocuments"),
      children: buildTree(null),
    },
  ];
});

function handleTreeNodeSelect(keys: string[]) {
  const key = keys[0];
  selectedFolderId.value = key === "__root__" ? null : key;
  store.fetchDocuments(kbId.value, { folder_id: selectedFolderId.value || undefined });
}

// ─── Document table ─────────────────────────────────────────────────
const docColumns: DataTableColumns<KnowledgeDocument> = [
  { title: t("knowledgeBase.fileName"), key: "file_name", ellipsis: { tooltip: true } },
  { title: t("knowledgeBase.fileType"), key: "file_type", width: 80 },
  {
    title: t("knowledgeBase.fileSize"),
    key: "file_size",
    width: 100,
    render(row) {
      return row.file_size < 1024
        ? `${row.file_size} B`
        : row.file_size < 1024 * 1024
          ? `${(row.file_size / 1024).toFixed(1)} KB`
          : `${(row.file_size / (1024 * 1024)).toFixed(1)} MB`;
    },
  },
  {
    title: t("knowledgeBase.status"),
    key: "parse_status",
    width: 100,
    render(row) {
      const typeMap: Record<DocStatus, "default" | "info" | "success" | "error"> = {
        pending: "default",
        processing: "info",
        completed: "success",
        failed: "error",
      };
      return h(NTag, { size: "small", type: typeMap[row.parse_status], bordered: false }, () =>
        t(`knowledgeBase.status_${row.parse_status}`),
      );
    },
  },
  {
    title: t("knowledgeBase.chunks"),
    key: "chunk_count",
    width: 70,
    align: "center",
  },
  {
    title: t("knowledgeBase.createdAt"),
    key: "created_at",
    width: 120,
    render(row) {
      return new Date(row.created_at).toLocaleDateString();
    },
  },
  {
    title: t("common.actions"),
    key: "actions",
    width: 150,
    render(row) {
      return h(NSpace, { size: "small" }, () => [
        h(
          NButton,
          { size: "tiny", text: true, onClick: () => openPreview(row) },
          () => t("common.preview"),
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDeleteDoc(row) },
          {
            trigger: () =>
              h(NButton, { size: "tiny", text: true, type: "error" }, () => t("common.delete")),
          },
        ),
      ]);
    },
  },
];

function openPreview(doc: KnowledgeDocument) {
  previewDoc.value = doc;
  showPreview.value = true;
}

async function handleDeleteDoc(doc: KnowledgeDocument) {
  try {
    await store.deleteDoc(kbId.value, doc.id);
    message.success(t("common.deleted"));
  } catch (err: any) {
    message.error(err.message || t("common.deleteFailed"));
  }
}

// ─── Upload handler ─────────────────────────────────────────────────
async function handleUpload(options: { file: UploadFileInfo; onFinish: () => void; onError: () => void }) {
  uploading.value = true;
  try {
    const rawFile = (options.file as any).file as File | undefined;
    if (rawFile) {
      await store.uploadDocs(kbId.value, rawFile, selectedFolderId.value);
    }
    message.success(t("knowledgeBase.uploadSuccess"));
    options.onFinish();
    await store.fetchDocuments(kbId.value, { folder_id: selectedFolderId.value || undefined });
  } catch (err: any) {
    message.error(err.message || t("knowledgeBase.uploadFailed"));
    options.onError();
  } finally {
    uploading.value = false;
  }
}

// ─── Folder creation ────────────────────────────────────────────────
async function handleCreateFolder() {
  if (!newFolderName.value.trim()) return;
  try {
    await store.createFolder(kbId.value, newFolderName.value.trim(), selectedFolderId.value);
    newFolderName.value = "";
    showCreateFolder.value = false;
    message.success(t("common.created"));
  } catch (err: any) {
    message.error(err.message || t("common.saveFailed"));
  }
}

// ─── Search ─────────────────────────────────────────────────────────
async function handleSearch() {
  if (!searchQuery.value.trim()) return;
  searching.value = true;
  try {
    await store.search(kbId.value, searchQuery.value.trim());
  } finally {
    searching.value = false;
  }
}

// ─── Wiki (read-only) ───────────────────────────────────────────────
async function openWiki(page: WikiPage) {
  await store.fetchWikiPage(page.id);
  showWiki.value = true;
}

// ─── Search result columns ──────────────────────────────────────────
const searchColumns: DataTableColumns<SearchResult> = [
  { title: t("knowledgeBase.fileName"), key: "filename", width: 180, ellipsis: { tooltip: true } },
  {
    title: t("knowledgeBase.content"),
    key: "text",
    ellipsis: { tooltip: true },
  },
  {
    title: t("knowledgeBase.score"),
    key: "score",
    width: 80,
    align: "center",
    render(row) {
      return row.score.toFixed(2);
    },
  },
];
</script>

<template>
  <div class="kb-detail-view">
    <!-- Header -->
    <div class="kb-detail-header">
      <NButton text @click="router.push({ name: 'hermes.knowledgeBase' })">
        ← {{ t("common.back") }}
      </NButton>
      <h1 v-if="store.currentKb" class="kb-detail-title">{{ store.currentKb.name }}</h1>
    </div>

    <NSpin :show="store.loading">
      <NTabs v-if="store.currentKb" v-model:value="activeTab" type="line">
        <!-- Documents Tab -->
        <NTabPane name="documents" :tab="t('knowledgeBase.documents')">
          <div class="kb-detail-layout">
            <!-- Left: Folder Tree -->
            <aside class="kb-sidebar">
              <div class="kb-sidebar-header">
                <span class="kb-sidebar-title">{{ t("knowledgeBase.folders") }}</span>
                <NButton size="tiny" text @click="showCreateFolder = !showCreateFolder">
                  + {{ t("knowledgeBase.newFolder") }}
                </NButton>
              </div>
              <div v-if="showCreateFolder" class="kb-new-folder">
                <NInput
                  v-model:value="newFolderName"
                  size="small"
                  :placeholder="t('knowledgeBase.folderNamePlaceholder')"
                  @keyup.enter="handleCreateFolder"
                />
                <NButton size="tiny" type="primary" @click="handleCreateFolder">
                  {{ t("common.confirm") }}
                </NButton>
              </div>
              <NTree
                :data="treeData"
                :default-expanded-keys="['__root__']"
                block-line
                @update:selected-keys="handleTreeNodeSelect"
              />
            </aside>

            <!-- Right: Document Table -->
            <main class="kb-main">
              <div class="kb-toolbar">
                <NUpload
                  :show-file-list="false"
                  multiple
                  accept="*"
                  :custom-request="handleUpload"
                >
                  <NButton type="primary" size="small" :loading="uploading">
                    {{ t("knowledgeBase.upload") }}
                  </NButton>
                </NUpload>
                <NInput
                  v-model:value="searchQuery"
                  size="small"
                  :placeholder="t('knowledgeBase.searchPlaceholder')"
                  clearable
                  style="width: 240px"
                  @keyup.enter="activeTab = 'search'; handleSearch()"
                />
              </div>
              <NDataTable
                v-if="store.documents.length > 0"
                :columns="docColumns"
                :data="store.documents"
                :row-key="(row: KnowledgeDocument) => row.id"
                size="small"
                :bordered="false"
                :single-line="false"
              />
              <NEmpty v-else :description="t('knowledgeBase.noDocuments')" />
            </main>
          </div>
        </NTabPane>

        <!-- Search Tab -->
        <NTabPane name="search" :tab="t('knowledgeBase.search')">
          <div class="kb-search-panel">
            <NSpace>
              <NInput
                v-model:value="searchQuery"
                :placeholder="t('knowledgeBase.searchPlaceholder')"
                style="width: 400px"
                @keyup.enter="handleSearch"
              />
              <NButton type="primary" :loading="searching" @click="handleSearch">
                {{ t("knowledgeBase.search") }}
              </NButton>
            </NSpace>
            <NDataTable
              v-if="store.searchResults.length > 0"
              :columns="searchColumns"
              :data="store.searchResults"
              size="small"
              style="margin-top: 16px"
            />
            <NEmpty
              v-else-if="!searching"
              :description="t('knowledgeBase.noSearchResults')"
              style="margin-top: 32px"
            />
          </div>
        </NTabPane>

        <!-- Wiki Tab -->
        <NTabPane name="wiki" :tab="t('knowledgeBase.wiki')">
          <div class="kb-wiki-panel">
            <div v-if="store.wikiPages.length === 0" class="kb-empty">
              <NEmpty :description="t('knowledgeBase.noWikiPages')" />
            </div>
            <div v-else class="kb-wiki-grid">
              <article
                v-for="page in store.wikiPages"
                :key="page.id"
                class="kb-wiki-card"
                @click="openWiki(page)"
              >
                <h3>{{ page.title }}</h3>
                <div class="kb-wiki-meta">
                  <NTag size="small" :bordered="false">{{ page.review_status || page.status }}</NTag>
                </div>
                <time>{{ new Date(page.updated_at).toLocaleDateString() }}</time>
              </article>
            </div>
          </div>
        </NTabPane>

        <!-- Stats Tab -->
        <NTabPane v-if="store.stats" name="stats" :tab="t('knowledgeBase.stats')">
          <div class="kb-stats-panel">
            <div class="kb-stat-item">
              <span class="kb-stat-value">{{ store.stats.total_documents }}</span>
              <span class="kb-stat-label">{{ t("knowledgeBase.totalDocuments") }}</span>
            </div>
            <div class="kb-stat-item">
              <span class="kb-stat-value">{{ store.stats.completed }}</span>
              <span class="kb-stat-label">{{ t("knowledgeBase.completed") }}</span>
            </div>
            <div class="kb-stat-item">
              <span class="kb-stat-value">{{ store.stats.processing }}</span>
              <span class="kb-stat-label">{{ t("knowledgeBase.processing") }}</span>
            </div>
            <div class="kb-stat-item">
              <span class="kb-stat-value">{{ store.stats.failed }}</span>
              <span class="kb-stat-label">{{ t("knowledgeBase.failed") }}</span>
            </div>
            <div class="kb-stat-item">
              <span class="kb-stat-value">{{ store.stats.orphaned }}</span>
              <span class="kb-stat-label">{{ t("knowledgeBase.orphaned") }}</span>
            </div>
            <div class="kb-stat-item">
              <span class="kb-stat-value">{{
                store.stats.total_size < 1024 * 1024
                  ? `${(store.stats.total_size / 1024).toFixed(1)} KB`
                  : `${(store.stats.total_size / (1024 * 1024)).toFixed(1)} MB`
              }}</span>
              <span class="kb-stat-label">{{ t("knowledgeBase.totalSize") }}</span>
            </div>
          </div>
        </NTabPane>
      </NTabs>
    </NSpin>

    <!-- Wiki View Modal (read-only) -->
    <NModal v-model:show="showWiki" :title="store.currentWikiPage?.title" preset="dialog" style="width: 720px">
      <div v-if="store.currentWikiPage" class="kb-wiki-content">
        {{ store.currentWikiPage.content }}
      </div>
    </NModal>

    <!-- Document Preview Modal -->
    <NModal v-model:show="showPreview" :title="previewDoc?.file_name" preset="dialog" style="width: 800px">
      <div v-if="previewDoc" class="kb-preview">
        <div class="kb-preview-meta">
          <NTag size="small">{{ previewDoc.file_type }}</NTag>
          <NTag size="small" :type="previewDoc.parse_status === 'completed' ? 'success' : 'default'">
            {{ t(`knowledgeBase.status_${previewDoc.parse_status}`) }}
          </NTag>
          <span>{{ previewDoc.chunk_count }} {{ t("knowledgeBase.chunks") }}</span>
        </div>
        <p v-if="previewDoc.summary_text" class="kb-preview-summary">{{ previewDoc.summary_text }}</p>
        <p v-if="previewDoc.error_message" class="kb-preview-error">{{ previewDoc.error_message }}</p>
      </div>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.kb-detail-view {
  padding: 24px 32px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.kb-detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.kb-detail-title {
  font-size: 22px;
  font-weight: 700;
  color: $text-primary;
  margin: 0;
}

.kb-detail-layout {
  display: flex;
  gap: 24px;
  min-height: 500px;
}

.kb-sidebar {
  width: 220px;
  flex-shrink: 0;
  border-inline-end: 1px solid $border-color;
  padding-inline-end: 16px;
}

.kb-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.kb-sidebar-title {
  font-size: 13px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
}

.kb-new-folder {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}

.kb-main {
  flex: 1;
  min-width: 0;
}

.kb-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

// ─── Search ─────────────────────────────────────────────────────────
.kb-search-panel {
  padding: 16px 0;
}

// ─── Wiki ───────────────────────────────────────────────────────────
.kb-wiki-panel {
  padding: 16px 0;
}

.kb-wiki-header {
  margin-bottom: 16px;
}

.kb-wiki-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.kb-wiki-card {
  padding: 16px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: box-shadow 0.15s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  h3 {
    margin: 0 0 8px;
    font-size: 15px;
    color: $text-primary;
  }

  p {
    margin: 0 0 8px;
    font-size: 13px;
    color: $text-secondary;
    line-height: 1.5;
  }

  time {
    font-size: 12px;
    color: $text-muted;
  }
}

.kb-wiki-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.kb-wiki-content {
  max-height: 60vh;
  overflow-y: auto;
  white-space: pre-wrap;
  font-size: 14px;
  color: $text-primary;
  line-height: 1.6;
}

// ─── Stats ──────────────────────────────────────────────────────────
.kb-stats-panel {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  padding: 24px 0;
}

.kb-stat-item {
  text-align: center;
  padding: 24px 16px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
}

.kb-stat-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: $accent-primary;
  margin-bottom: 4px;
}

.kb-stat-label {
  font-size: 13px;
  color: $text-muted;
}

// ─── Preview ────────────────────────────────────────────────────────
.kb-preview {
  padding: 16px 0;
}

.kb-preview-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.kb-preview-summary {
  font-size: 14px;
  color: $text-secondary;
  line-height: 1.6;
}

.kb-preview-error {
  font-size: 13px;
  color: $error;
}

.kb-empty {
  text-align: center;
  padding: 48px 0;
}
</style>
