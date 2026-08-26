<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  NDrawer,
  NDrawerContent,
  NButton,
  NTag,
  NSpace,
  NProgress,
  NSwitch,
  NPopconfirm,
  NCollapse,
  NCollapseItem,
  NInput,
  NEmpty,
  NSpin,
  NDropdown,
  useMessage,
  useDialog,
  type DropdownOption,
} from "naive-ui";
import { useI18n } from "vue-i18n";
import { useKnowledgeBaseStore } from "@/stores/hermes/knowledge-base";
import type { KnowledgeDocument, KnowledgeChunk } from "@/types/knowledge-base";

const props = defineProps<{
  show: boolean;
  kbId: string;
  doc: KnowledgeDocument | null;
}>();

const emit = defineEmits<{
  "update:show": [boolean];
  changed: [];
}>();

const { t } = useI18n();
const message = useMessage();
const dialog = useDialog();
const store = useKnowledgeBaseStore();

const loadingMeta = ref(false);
const preview = ref("");
const previewLoading = ref(false);
const actionBusy = ref<string | null>(null);
const editingChunkId = ref<string | null>(null);
const editingContent = ref("");

const liveDoc = computed(() => {
  if (!props.doc) return null;
  return store.documents.find((d) => d.id === props.doc!.id) || store.currentDoc || props.doc;
});

const job = computed(() => {
  const id = liveDoc.value?.id;
  if (!id) return null;
  return store.vectorJobs.find((j) => j.doc_id === id) || null;
});

const parseType = computed(() => {
  const status = liveDoc.value?.parse_status;
  if (status === "completed") return "success" as const;
  if (status === "processing") return "info" as const;
  if (status === "failed") return "error" as const;
  return "default" as const;
});

const wikiOptions: DropdownOption[] = [
  { label: t("knowledgeBase.wikiOnly"), key: "wiki" },
  { label: t("knowledgeBase.wikiAndCurate"), key: "wiki-curate" },
];

watch(
  () => [props.show, props.doc?.id] as const,
  async ([open, docId]) => {
    if (!open || !docId) return;
    loadingMeta.value = true;
    preview.value = "";
    editingChunkId.value = null;
    try {
      await Promise.all([store.selectDocument(docId), store.fetchChunks(docId)]);
    } catch (err: any) {
      message.error(err?.message || t("knowledgeBase.actionFailed"));
    } finally {
      loadingMeta.value = false;
    }
  },
);

async function loadPreview() {
  if (!liveDoc.value || preview.value || previewLoading.value) return;
  previewLoading.value = true;
  try {
    const { getDocumentPreview } = await import("@/api/hermes/knowledge-base");
    const res = await getDocumentPreview(liveDoc.value.id);
    preview.value = res.content || "";
  } catch (err: any) {
    message.error(err?.message || t("knowledgeBase.actionFailed"));
  } finally {
    previewLoading.value = false;
  }
}

function confirmLlm(title: string, content: string): Promise<boolean> {
  return new Promise((resolve) => {
    dialog.warning({
      title,
      content,
      positiveText: t("common.confirm"),
      negativeText: t("common.cancel"),
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
      onClose: () => resolve(false),
    });
  });
}

async function runAction(key: string, fn: () => Promise<unknown>, llm = false) {
  if (llm) {
    const ok = await confirmLlm(t("knowledgeBase.llmConfirmTitle"), t("knowledgeBase.llmConfirmBody"));
    if (!ok) return;
  }
  actionBusy.value = key;
  try {
    const result = await fn();
    const skipped = result && typeof result === "object" && "skipped" in result && (result as { skipped?: boolean }).skipped;
    message.success(skipped ? t("knowledgeBase.wikiSkipped") : t("knowledgeBase.actionStarted"));
    emit("changed");
  } catch (err: any) {
    message.error(err?.message || t("knowledgeBase.actionFailed"));
  } finally {
    actionBusy.value = null;
  }
}

function handleEmbed() {
  if (!liveDoc.value) return;
  void runAction("embed", () => store.vectorizeDoc(props.kbId, liveDoc.value!.id));
}

function handleSummary() {
  if (!liveDoc.value) return;
  void runAction("summary", () => store.summarizeDoc(liveDoc.value!.id), true);
}

function handleGraph() {
  if (!liveDoc.value) return;
  void runAction("graph", () => store.graphDoc(props.kbId, liveDoc.value!.id), true);
}

function handleWikiSelect(key: string | number) {
  if (!liveDoc.value) return;
  const curate = key === "wiki-curate";
  void runAction(curate ? "wiki-curate" : "wiki", () => store.wikiDoc(props.kbId, liveDoc.value!.id, curate), true);
}

async function toggleChunk(chunk: KnowledgeChunk, enabled: boolean) {
  try {
    await store.patchChunk(chunk.id, { is_enabled: enabled });
  } catch (err: any) {
    message.error(err?.message || t("knowledgeBase.actionFailed"));
  }
}

function startEdit(chunk: KnowledgeChunk) {
  editingChunkId.value = chunk.id;
  editingContent.value = chunk.content;
}

async function saveEdit(chunk: KnowledgeChunk) {
  try {
    await store.patchChunk(chunk.id, { content: editingContent.value });
    editingChunkId.value = null;
    message.success(t("common.saved"));
  } catch (err: any) {
    message.error(err?.message || t("common.saveFailed"));
  }
}

async function handleDeleteChunk(chunk: KnowledgeChunk) {
  try {
    await store.removeChunk(chunk.id);
    message.success(t("common.deleted"));
  } catch (err: any) {
    message.error(err?.message || t("common.deleteFailed"));
  }
}

function onCollapseClick(info: { name: string | number }) {
  if (info.name === "preview") void loadPreview();
}

const canEnrich = computed(() => liveDoc.value?.parse_status === "completed");
</script>

<template>
  <NDrawer :show="show" :width="560" placement="right" @update:show="emit('update:show', $event)">
    <NDrawerContent :title="liveDoc?.file_name || t('knowledgeBase.documents')" closable>
      <NSpin :show="loadingMeta">
        <div v-if="liveDoc" class="kb-drawer">
          <NSpace align="center" wrap>
            <NTag size="small" :type="parseType" :bordered="false">
              {{ t(`knowledgeBase.status_${liveDoc.parse_status}`) }}
            </NTag>
            <NTag size="small" :bordered="false">
              {{ liveDoc.chunk_count }} {{ t("knowledgeBase.chunks") }}
            </NTag>
            <NTag v-if="liveDoc.summary_status" size="small" :bordered="false">
              {{ t("knowledgeBase.summary") }} · {{ liveDoc.summary_status }}
            </NTag>
          </NSpace>

          <p v-if="liveDoc.error_message" class="kb-drawer-error">{{ liveDoc.error_message }}</p>

          <div v-if="liveDoc.parse_status === 'processing' && job" class="kb-drawer-progress">
            <NProgress
              type="line"
              :percentage="Math.max(0, Math.min(100, Number(job.progress) || 0))"
              :processing="true"
            />
            <span class="kb-drawer-progress-label">
              {{ job.chunks_done || 0 }} / {{ job.chunks_total || liveDoc.chunk_count || "…" }}
            </span>
          </div>

          <div class="kb-drawer-actions">
            <NButton
              size="small"
              :loading="actionBusy === 'embed'"
              :disabled="liveDoc.parse_status === 'processing'"
              @click="handleEmbed"
            >
              {{ liveDoc.parse_status === "completed" ? t("knowledgeBase.revectorize") : t("knowledgeBase.vectorize") }}
            </NButton>
            <NButton
              size="small"
              :disabled="!canEnrich"
              :loading="actionBusy === 'summary'"
              @click="handleSummary"
            >
              {{ t("knowledgeBase.summary") }}
            </NButton>
            <NDropdown :options="wikiOptions" trigger="click" @select="handleWikiSelect">
              <NButton
                size="small"
                :disabled="!canEnrich"
                :loading="actionBusy === 'wiki' || actionBusy === 'wiki-curate'"
              >
                {{ t("knowledgeBase.wiki") }}
              </NButton>
            </NDropdown>
            <NButton
              size="small"
              :disabled="!canEnrich"
              :loading="actionBusy === 'graph'"
              @click="handleGraph"
            >
              {{ t("knowledgeBase.graph") }}
            </NButton>
          </div>

          <section v-if="liveDoc.summary_text" class="kb-drawer-section">
            <h4>{{ t("knowledgeBase.summary") }}</h4>
            <p class="kb-drawer-summary">{{ liveDoc.summary_text }}</p>
          </section>

          <NCollapse @item-header-click="onCollapseClick">
            <NCollapseItem :title="t('common.preview')" name="preview">
              <NSpin :show="previewLoading">
                <pre v-if="preview" class="kb-drawer-preview">{{ preview }}</pre>
                <NEmpty v-else-if="!previewLoading" :description="t('knowledgeBase.noPreview')" />
              </NSpin>
            </NCollapseItem>
            <NCollapseItem :title="`${t('knowledgeBase.chunks')} (${store.chunks.length})`" name="chunks">
              <div v-if="store.chunks.length === 0" class="kb-drawer-empty">
                <NEmpty :description="t('knowledgeBase.noChunks')" />
              </div>
              <article v-for="chunk in store.chunks" :key="chunk.id" class="kb-chunk">
                <header class="kb-chunk-head">
                  <span>#{{ chunk.chunk_index }} · {{ chunk.char_count }}</span>
                  <NSpace size="small" align="center">
                    <NSwitch
                      size="small"
                      :value="chunk.is_enabled"
                      @update:value="(v: boolean) => toggleChunk(chunk, v)"
                    />
                    <NButton size="tiny" text @click="startEdit(chunk)">{{ t("common.edit") }}</NButton>
                    <NPopconfirm @positive-click="handleDeleteChunk(chunk)">
                      <template #trigger>
                        <NButton size="tiny" text type="error">{{ t("common.delete") }}</NButton>
                      </template>
                      {{ t("knowledgeBase.deleteChunkConfirm") }}
                    </NPopconfirm>
                  </NSpace>
                </header>
                <NInput
                  v-if="editingChunkId === chunk.id"
                  v-model:value="editingContent"
                  type="textarea"
                  :rows="6"
                  class="kb-chunk-edit"
                />
                <NSpace v-if="editingChunkId === chunk.id" justify="end">
                  <NButton size="tiny" @click="editingChunkId = null">{{ t("common.cancel") }}</NButton>
                  <NButton size="tiny" type="primary" @click="saveEdit(chunk)">{{ t("common.save") }}</NButton>
                </NSpace>
                <p v-else class="kb-chunk-body">{{ chunk.content }}</p>
              </article>
            </NCollapseItem>
          </NCollapse>
        </div>
      </NSpin>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.kb-drawer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kb-drawer-error {
  margin: 0;
  font-size: 13px;
  color: $error;
}

.kb-drawer-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kb-drawer-progress-label {
  font-size: 12px;
  color: $text-muted;
}

.kb-drawer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.kb-drawer-section h4 {
  margin: 0 0 8px;
  font-size: 13px;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.kb-drawer-summary {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: $text-secondary;
}

.kb-drawer-preview {
  max-height: 320px;
  overflow: auto;
  white-space: pre-wrap;
  font-size: 12px;
  line-height: 1.5;
  color: $text-secondary;
  margin: 0;
}

.kb-chunk {
  padding: 10px 0;
  border-bottom: 1px solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.kb-chunk-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: $text-muted;
  margin-bottom: 6px;
}

.kb-chunk-body {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: $text-secondary;
  white-space: pre-wrap;
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.kb-chunk-edit {
  margin-bottom: 8px;
}

.kb-drawer-empty {
  padding: 16px 0;
}
</style>
