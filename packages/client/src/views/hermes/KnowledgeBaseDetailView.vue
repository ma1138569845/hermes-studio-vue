<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, h, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NButton,
  NTabs,
  NTabPane,
  NInput,
  NTag,
  NSpin,
  NDrawer,
  NDrawerContent,
  NPopconfirm,
  NUpload,
  NTree,
  NDataTable,
  NEmpty,
  NSpace,
  NSelect,
  NDropdown,
  NAlert,
  NPagination,
  useMessage,
  useDialog,
  type DropdownOption,
} from "naive-ui";
import type { DataTableColumns, TreeOption, UploadFileInfo, SelectOption } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useKnowledgeBaseStore } from "@/stores/hermes/knowledge-base";
import type {
  KnowledgeDocument,
  DocStatus,
  SearchResult,
  WikiPage,
  SearchMode,
  WikiReviewStatus,
} from "@/types/knowledge-base";
import KbPipelineDrawer from "@/components/hermes/knowledge/KbPipelineDrawer.vue";
import MarkdownRenderer from "@/components/hermes/chat/MarkdownRenderer.vue";

const { t } = useI18n();
const message = useMessage();
const dialog = useDialog();
const route = useRoute();
const router = useRouter();
const store = useKnowledgeBaseStore();

const kbId = computed(() => route.params.kbId as string);
const activeTab = ref("documents");

const selectedFolderId = ref<string | null>(null);
const showCreateFolder = ref(false);
const newFolderName = ref("");
const uploading = ref(false);
const searchQuery = ref("");
const searchMode = ref<SearchMode>("vector");
const checkedKeys = ref<string[]>([]);
const showDrawer = ref(false);
const drawerDoc = ref<KnowledgeDocument | null>(null);
const showWiki = ref(false);
const wikiFilter = ref<string>("all");
const generateBusy = ref(false);
const actionBusy = ref(false);

const searchModeOptions: SelectOption[] = [
  { label: t("knowledgeBase.searchModeVector"), value: "vector" },
  { label: t("knowledgeBase.searchModeWiki"), value: "wiki" },
  { label: t("knowledgeBase.searchModeGraph"), value: "graph" },
  { label: t("knowledgeBase.searchModeUnified"), value: "unified" },
];

const wikiFilterOptions: SelectOption[] = [
  { label: t("knowledgeBase.reviewAll"), value: "all" },
  { label: t("knowledgeBase.reviewPending"), value: "pending" },
  { label: t("knowledgeBase.reviewApproved"), value: "approved" },
  { label: t("knowledgeBase.reviewRejected"), value: "rejected" },
];

const generateOptions: DropdownOption[] = [
  { label: t("knowledgeBase.folderWiki"), key: "folder-wiki" },
  { label: t("knowledgeBase.bulkWiki"), key: "bulk-wiki" },
  { label: t("knowledgeBase.hierarchicalWiki"), key: "hierarchical" },
  { label: t("knowledgeBase.curateApproved"), key: "curate" },
];

onMounted(async () => {
  await store.selectBase(kbId.value);
});

onUnmounted(() => {
  store.stopPolling();
});

watch(wikiFilter, async (value) => {
  await store.fetchWikiPages(kbId.value, value === "all" ? undefined : value);
});

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

function folderOpts() {
  return { folder_id: selectedFolderId.value || undefined };
}

function handleTreeNodeSelect(keys: Array<string | number>) {
  const key = String(keys[0] ?? "__root__");
  selectedFolderId.value = key === "__root__" ? null : key;
  checkedKeys.value = [];
  void store.fetchDocuments(kbId.value, { ...folderOpts(), page: 1 });
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function statusType(status: DocStatus): "default" | "info" | "success" | "error" {
  if (status === "completed") return "success";
  if (status === "processing") return "info";
  if (status === "failed") return "error";
  return "default";
}

function openDrawer(doc: KnowledgeDocument) {
  drawerDoc.value = doc;
  showDrawer.value = true;
}

const docColumns: DataTableColumns<KnowledgeDocument> = [
  { type: "selection" },
  { title: t("knowledgeBase.fileName"), key: "file_name", ellipsis: { tooltip: true } },
  { title: t("knowledgeBase.fileType"), key: "file_type", width: 72 },
  {
    title: t("knowledgeBase.fileSize"),
    key: "file_size",
    width: 88,
    render(row) {
      return formatBytes(row.file_size);
    },
  },
  {
    title: t("knowledgeBase.status"),
    key: "parse_status",
    width: 108,
    render(row) {
      return h(NTag, { size: "small", type: statusType(row.parse_status), bordered: false }, () =>
        t(`knowledgeBase.status_${row.parse_status}`),
      );
    },
  },
  {
    title: t("knowledgeBase.chunks"),
    key: "chunk_count",
    width: 64,
    align: "center",
  },
  {
    title: t("common.actions"),
    key: "actions",
    width: 168,
    render(row) {
      return h(NSpace, { size: "small" }, () => [
        h(
          NButton,
          {
            size: "tiny",
            text: true,
            disabled: row.parse_status === "processing",
            onClick: () => void handleVectorizeOne(row),
          },
          () =>
            row.parse_status === "completed"
              ? t("knowledgeBase.revectorize")
              : t("knowledgeBase.vectorize"),
        ),
        h(NButton, { size: "tiny", text: true, onClick: () => openDrawer(row) }, () =>
          t("knowledgeBase.open"),
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDeleteDoc(row) },
          {
            trigger: () =>
              h(NButton, { size: "tiny", text: true, type: "error" }, () => t("common.delete")),
            default: () => t("knowledgeBase.deleteDocConfirm"),
          },
        ),
      ]);
    },
  },
];

async function handleVectorizeOne(doc: KnowledgeDocument) {
  try {
    await store.vectorizeDoc(kbId.value, doc.id);
    message.success(t("knowledgeBase.actionStarted"));
  } catch (err: any) {
    message.error(err.message || t("knowledgeBase.actionFailed"));
  }
}

async function handleDeleteDoc(doc: KnowledgeDocument) {
  try {
    await store.deleteDoc(kbId.value, doc.id);
    checkedKeys.value = checkedKeys.value.filter((id) => id !== doc.id);
    message.success(t("common.deleted"));
  } catch (err: any) {
    message.error(err.message || t("common.deleteFailed"));
  }
}

async function handleUpload(options: {
  file: UploadFileInfo;
  onFinish: () => void;
  onError: () => void;
}) {
  uploading.value = true;
  try {
    const rawFile = (options.file as any).file as File | undefined;
    if (rawFile) {
      await store.uploadDocs(kbId.value, rawFile, selectedFolderId.value);
    }
    message.success(t("knowledgeBase.uploadSuccess"));
    options.onFinish();
    await store.fetchDocuments(kbId.value, folderOpts());
  } catch (err: any) {
    message.error(err.message || t("knowledgeBase.uploadFailed"));
    options.onError();
  } finally {
    uploading.value = false;
  }
}

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

function confirmLlm(): Promise<boolean> {
  return new Promise((resolve) => {
    dialog.warning({
      title: t("knowledgeBase.llmConfirmTitle"),
      content: t("knowledgeBase.llmConfirmBody"),
      positiveText: t("common.confirm"),
      negativeText: t("common.cancel"),
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
      onClose: () => resolve(false),
    });
  });
}

async function handleGenerate(key: string | number) {
  if (!(await confirmLlm())) return;
  generateBusy.value = true;
  try {
    const folderId = selectedFolderId.value;
    if (key === "folder-wiki") await store.folderWiki(kbId.value, folderId, false);
    else if (key === "bulk-wiki") await store.bulkWiki(kbId.value, { folderId });
    else if (key === "hierarchical") await store.hierarchicalWiki(kbId.value, { folderId });
    else if (key === "curate") {
      await store.curateWiki(kbId.value, { folderId, reviewStatus: "approved" });
    }
    message.success(t("knowledgeBase.actionStarted"));
    activeTab.value = key === "curate" || key === "bulk-wiki" ? "jobs" : "wiki";
  } catch (err: any) {
    message.error(err.message || t("knowledgeBase.actionFailed"));
  } finally {
    generateBusy.value = false;
  }
}

async function handleRebuild() {
  generateBusy.value = true;
  try {
    await store.rebuildBase(kbId.value);
    message.success(t("knowledgeBase.rebuildQueued"));
  } catch (err: any) {
    message.error(err.message || t("knowledgeBase.actionFailed"));
  } finally {
    generateBusy.value = false;
  }
}

async function handleBatch(kind: "embed" | "wiki" | "delete") {
  const ids = [...checkedKeys.value];
  if (!ids.length) return;
  if (kind === "delete") {
    try {
      await store.bulkDelete(kbId.value, ids);
      checkedKeys.value = [];
      message.success(t("common.deleted"));
    } catch (err: any) {
      message.error(err.message || t("common.deleteFailed"));
    }
    return;
  }
  if (kind === "wiki" && !(await confirmLlm())) return;
  actionBusy.value = true;
  try {
    if (kind === "embed") {
      for (const id of ids) await store.vectorizeDoc(kbId.value, id);
    } else {
      await store.bulkWiki(kbId.value, { docIds: ids });
      activeTab.value = "jobs";
    }
    checkedKeys.value = [];
    message.success(t("knowledgeBase.actionStarted"));
  } catch (err: any) {
    message.error(err.message || t("knowledgeBase.actionFailed"));
  } finally {
    actionBusy.value = false;
  }
}

async function handleSearch() {
  if (!searchQuery.value.trim()) return;
  activeTab.value = "search";
  try {
    await store.search(kbId.value, searchQuery.value.trim(), { mode: searchMode.value, limit: 12 });
  } catch (err: any) {
    message.error(err.message || t("knowledgeBase.actionFailed"));
  }
}

async function openWiki(page: WikiPage) {
  await store.fetchWikiPage(page.id);
  showWiki.value = true;
}

async function handleReview(status: WikiReviewStatus) {
  const page = store.currentWikiPage;
  if (!page) return;
  try {
    await store.reviewWiki(page.id, status);
    message.success(t("common.saved"));
  } catch (err: any) {
    message.error(err.message || t("common.saveFailed"));
  }
}

async function handleEvaluate() {
  const page = store.currentWikiPage;
  if (!page) return;
  if (!(await confirmLlm())) return;
  try {
    await store.evaluateWiki(page.id);
    message.success(t("knowledgeBase.qualityUpdated"));
  } catch (err: any) {
    message.error(err.message || t("knowledgeBase.actionFailed"));
  }
}

function reviewType(status?: string): "default" | "success" | "error" | "warning" {
  if (status === "approved") return "success";
  if (status === "rejected") return "error";
  if (status === "pending") return "warning";
  return "default";
}

const searchColumns: DataTableColumns<SearchResult> = [
  {
    title: t("knowledgeBase.fileName"),
    key: "filename",
    width: 180,
    ellipsis: { tooltip: true },
    render(row) {
      return row.filename || row.title || row.type || "—";
    },
  },
  {
    title: t("knowledgeBase.content"),
    key: "text",
    ellipsis: { tooltip: true },
    render(row) {
      return row.text || row.answer || "";
    },
  },
  {
    title: t("knowledgeBase.score"),
    key: "score",
    width: 80,
    align: "center",
    render(row) {
      return typeof row.score === "number" ? row.score.toFixed(2) : "—";
    },
  },
];

function onPageChange(page: number) {
  void store.fetchDocuments(kbId.value, { ...folderOpts(), page });
}

function onPageSizeChange(pageSize: number) {
  void store.fetchDocuments(kbId.value, { ...folderOpts(), page: 1, page_size: pageSize });
}

const jobRows = computed(() => {
  const vec = store.vectorJobs.map((j) => ({
    id: j.id,
    kind: t("knowledgeBase.vectorize"),
    status: j.status,
    detail: j.error || `${j.progress ?? 0}%`,
    created_at: j.created_at,
  }));
  const cur = store.curationJobs.map((j) => ({
    id: j.id,
    kind: j.job_type || t("knowledgeBase.curate"),
    status: j.status,
    detail: j.error_message || "",
    created_at: j.created_at,
  }));
  return [...vec, ...cur].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
});
</script>

<template>
  <div class="kb-detail-view">
    <div class="kb-detail-header">
      <NButton text @click="router.push({ name: 'hermes.knowledgeBase' })">
        ← {{ t("common.back") }}
      </NButton>
      <h1 v-if="store.currentKb" class="kb-detail-title">{{ store.currentKb.name }}</h1>
      <div v-if="store.stats" class="kb-stat-chips">
        <span>{{ store.stats.total_documents }} {{ t("knowledgeBase.documents") }}</span>
        <span>{{ store.stats.completed }} {{ t("knowledgeBase.completed") }}</span>
        <span>{{ store.stats.processing }} {{ t("knowledgeBase.processing") }}</span>
        <span v-if="store.stats.failed">{{ store.stats.failed }} {{ t("knowledgeBase.failed") }}</span>
      </div>
      <NSpace v-if="store.currentKb" class="kb-header-actions">
        <NDropdown :options="generateOptions" trigger="click" @select="handleGenerate">
          <NButton size="small" :loading="generateBusy">{{ t("knowledgeBase.generate") }}</NButton>
        </NDropdown>
        <NPopconfirm @positive-click="handleRebuild">
          <template #trigger>
            <NButton size="small">{{ t("knowledgeBase.rebuild") }}</NButton>
          </template>
          {{ t("knowledgeBase.rebuildConfirm") }}
        </NPopconfirm>
      </NSpace>
    </div>

    <NAlert
      v-if="store.loadError"
      type="error"
      :title="t('knowledgeBase.upstreamError')"
      style="margin-bottom: 16px"
    >
      {{ store.loadError }}
    </NAlert>

    <NSpin :show="store.loading && !store.hasActiveJobs">
      <NTabs v-if="store.currentKb" v-model:value="activeTab" type="line">
        <NTabPane name="documents" :tab="t('knowledgeBase.documents')">
          <div class="kb-detail-layout">
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
                selectable
                @update:selected-keys="handleTreeNodeSelect"
              />
            </aside>

            <main class="kb-main">
              <div class="kb-toolbar">
                <NUpload :show-file-list="false" multiple accept="*" :custom-request="handleUpload">
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
                  @keyup.enter="handleSearch"
                />
              </div>

              <div v-if="checkedKeys.length" class="kb-batch">
                <span>{{ t("knowledgeBase.selectedCount", { n: checkedKeys.length }) }}</span>
                <NButton size="tiny" :loading="actionBusy" @click="handleBatch('embed')">
                  {{ t("knowledgeBase.vectorize") }}
                </NButton>
                <NButton size="tiny" :loading="actionBusy" @click="handleBatch('wiki')">
                  {{ t("knowledgeBase.wiki") }}
                </NButton>
                <NPopconfirm @positive-click="handleBatch('delete')">
                  <template #trigger>
                    <NButton size="tiny" type="error">{{ t("common.delete") }}</NButton>
                  </template>
                  {{ t("knowledgeBase.bulkDeleteConfirm") }}
                </NPopconfirm>
              </div>

              <NDataTable
                v-if="store.documents.length > 0"
                :columns="docColumns"
                :data="store.documents"
                :row-key="(row: KnowledgeDocument) => row.id"
                :checked-row-keys="checkedKeys"
                size="small"
                :bordered="false"
                :single-line="false"
                @update:checked-row-keys="(keys) => (checkedKeys = keys as string[])"
              />
              <NEmpty v-else :description="t('knowledgeBase.noDocuments')" />
              <div v-if="store.docTotal > store.docPageSize" class="kb-pager">
                <NPagination
                  :page="store.docPage"
                  :page-size="store.docPageSize"
                  :item-count="store.docTotal"
                  show-size-picker
                  :page-sizes="[20, 50, 100]"
                  @update:page="onPageChange"
                  @update:page-size="onPageSizeChange"
                />
              </div>
            </main>
          </div>
        </NTabPane>

        <NTabPane name="search" :tab="t('knowledgeBase.search')">
          <div class="kb-search-panel">
            <NSpace>
              <NInput
                v-model:value="searchQuery"
                :placeholder="t('knowledgeBase.searchPlaceholder')"
                style="width: 360px"
                @keyup.enter="handleSearch"
              />
              <NSelect
                v-model:value="searchMode"
                :options="searchModeOptions"
                style="width: 140px"
                size="small"
              />
              <NButton type="primary" :loading="store.searchLoading" @click="handleSearch">
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
              v-else-if="!store.searchLoading"
              :description="t('knowledgeBase.noSearchResults')"
              style="margin-top: 32px"
            />
          </div>
        </NTabPane>

        <NTabPane name="wiki" :tab="t('knowledgeBase.wiki')">
          <div class="kb-wiki-panel">
            <div class="kb-toolbar">
              <NSelect
                v-model:value="wikiFilter"
                :options="wikiFilterOptions"
                size="small"
                style="width: 180px"
              />
            </div>
            <NEmpty v-if="store.wikiPages.length === 0" :description="t('knowledgeBase.noWikiPages')" />
            <div v-else class="kb-wiki-grid">
              <article
                v-for="page in store.wikiPages"
                :key="page.id"
                class="kb-wiki-card"
                @click="openWiki(page)"
              >
                <h3>{{ page.title }}</h3>
                <div class="kb-wiki-meta">
                  <NTag size="small" :type="reviewType(page.review_status)" :bordered="false">
                    {{ page.review_status || page.status }}
                  </NTag>
                  <NTag v-if="page.source" size="small" :bordered="false">{{ page.source }}</NTag>
                  <NTag v-if="page.quality_score != null" size="small" :bordered="false">
                    {{ t("knowledgeBase.quality") }} {{ Number(page.quality_score).toFixed(1) }}
                  </NTag>
                </div>
                <time>{{ new Date(page.updated_at).toLocaleDateString() }}</time>
              </article>
            </div>
          </div>
        </NTabPane>

        <NTabPane name="graph" :tab="t('knowledgeBase.graph')">
          <div class="kb-graph-panel">
            <NEmpty
              v-if="store.entities.length === 0 && store.relationships.length === 0"
              :description="t('knowledgeBase.noGraph')"
            />
            <div v-else class="kb-graph-cols">
              <section>
                <h3>{{ t("knowledgeBase.entities") }} ({{ store.entities.length }})</h3>
                <ul>
                  <li v-for="ent in store.entities" :key="ent.id">
                    <strong>{{ ent.name }}</strong>
                    <span v-if="ent.type"> · {{ ent.type }}</span>
                    <p v-if="ent.description">{{ ent.description }}</p>
                  </li>
                </ul>
              </section>
              <section>
                <h3>{{ t("knowledgeBase.relationships") }} ({{ store.relationships.length }})</h3>
                <ul>
                  <li v-for="rel in store.relationships" :key="rel.id">
                    {{ rel.source }} → {{ rel.relation || "related" }} → {{ rel.target }}
                  </li>
                </ul>
              </section>
            </div>
          </div>
        </NTabPane>

        <NTabPane name="jobs" :tab="t('knowledgeBase.jobs')">
          <NEmpty v-if="jobRows.length === 0" :description="t('knowledgeBase.noJobs')" />
          <ul v-else class="kb-job-list">
            <li v-for="job in jobRows" :key="job.id">
              <NTag size="small" :bordered="false">{{ job.kind }}</NTag>
              <NTag
                size="small"
                :type="job.status === 'completed' || job.status === 'success' ? 'success' : job.status === 'failed' ? 'error' : 'info'"
                :bordered="false"
              >
                {{ job.status }}
              </NTag>
              <span class="kb-job-detail">{{ job.detail }}</span>
              <time>{{ job.created_at ? new Date(job.created_at).toLocaleString() : "" }}</time>
            </li>
          </ul>
        </NTabPane>
      </NTabs>
    </NSpin>

    <KbPipelineDrawer
      v-model:show="showDrawer"
      :kb-id="kbId"
      :doc="drawerDoc"
      @changed="store.fetchStats(kbId)"
    />

    <NDrawer v-model:show="showWiki" :width="640" placement="right">
      <NDrawerContent :title="store.currentWikiPage?.title" closable>
        <div v-if="store.currentWikiPage" class="kb-wiki-drawer">
          <NSpace>
            <NTag size="small" :type="reviewType(store.currentWikiPage.review_status)" :bordered="false">
              {{ store.currentWikiPage.review_status }}
            </NTag>
            <NButton size="tiny" @click="handleReview('approved')">{{ t("knowledgeBase.approve") }}</NButton>
            <NButton size="tiny" @click="handleReview('rejected')">{{ t("knowledgeBase.reject") }}</NButton>
            <NButton size="tiny" @click="handleReview('pending')">{{ t("knowledgeBase.reviewPending") }}</NButton>
            <NButton size="tiny" @click="handleEvaluate">{{ t("knowledgeBase.evaluateQuality") }}</NButton>
          </NSpace>
          <div class="kb-wiki-md">
            <MarkdownRenderer :content="store.currentWikiPage.content || ''" />
          </div>
        </div>
      </NDrawerContent>
    </NDrawer>
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
  flex-wrap: wrap;
}

.kb-detail-title {
  font-size: 22px;
  font-weight: 700;
  color: $text-primary;
  margin: 0;
}

.kb-stat-chips {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: $text-muted;
  flex: 1;
}

.kb-header-actions {
  margin-inline-start: auto;
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

.kb-batch {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: $bg-secondary;
  border-radius: $radius-sm;
  font-size: 13px;
  color: $text-secondary;
}

.kb-pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.kb-search-panel,
.kb-wiki-panel,
.kb-graph-panel {
  padding: 16px 0;
}

.kb-wiki-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
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

  time {
    font-size: 12px;
    color: $text-muted;
  }
}

.kb-wiki-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.kb-wiki-drawer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kb-wiki-md {
  font-size: 14px;
  line-height: 1.65;
  color: $text-primary;
}

.kb-graph-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;

  h3 {
    font-size: 14px;
    margin: 0 0 12px;
    color: $text-muted;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    padding: 8px 0;
    border-bottom: 1px solid $border-color;
    font-size: 13px;
    color: $text-secondary;

    p {
      margin: 4px 0 0;
      color: $text-muted;
    }
  }
}

.kb-job-list {
  list-style: none;
  margin: 0;
  padding: 0;

  li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 0;
    border-bottom: 1px solid $border-color;
    font-size: 13px;
  }

  time {
    margin-inline-start: auto;
    color: $text-muted;
    font-size: 12px;
  }
}

.kb-job-detail {
  color: $text-secondary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 800px) {
  .kb-detail-layout {
    flex-direction: column;
  }

  .kb-sidebar {
    width: 100%;
    border-inline-end: none;
    padding-inline-end: 0;
    border-bottom: 1px solid $border-color;
    padding-bottom: 12px;
  }

  .kb-graph-cols {
    grid-template-columns: 1fr;
  }
}
</style>
