<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { NButton, NCard, NModal, NInput, NSpace, NSpin, NTag, NPopconfirm, useMessage } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useKnowledgeBaseStore } from "@/stores/hermes/knowledge-base";
import type { KnowledgeBase } from "@/types/knowledge-base";

const { t } = useI18n();
const message = useMessage();
const router = useRouter();
const store = useKnowledgeBaseStore();

const showCreateModal = ref(false);
const newName = ref("");
const newDescription = ref("");
const creating = ref(false);

onMounted(() => {
  store.fetchBases();
});

function openKb(kb: KnowledgeBase) {
  router.push({ name: "hermes.knowledgeBaseDetail", params: { kbId: kb.id } });
}

async function handleCreate() {
  if (!newName.value.trim()) return;
  creating.value = true;
  try {
    await store.createBase(newName.value.trim(), newDescription.value.trim());
    showCreateModal.value = false;
    newName.value = "";
    newDescription.value = "";
    message.success(t("common.created"));
  } catch (err: any) {
    message.error(err.message || t("common.saveFailed"));
  } finally {
    creating.value = false;
  }
}

async function handleDelete(kb: KnowledgeBase) {
  try {
    await store.deleteBase(kb.id);
    message.success(t("common.deleted"));
  } catch (err: any) {
    message.error(err.message || t("common.deleteFailed"));
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}
</script>

<template>
  <div class="kb-view">
    <div class="kb-header">
      <h1 class="kb-title">{{ t("knowledgeBase.title") }}</h1>
      <NButton type="primary" @click="showCreateModal = true">
        {{ t("knowledgeBase.create") }}
      </NButton>
    </div>

    <NSpin :show="store.loading">
      <!-- System KBs -->
      <section v-if="store.systemBases.length > 0" class="kb-section">
        <h2 class="kb-section-title">{{ t("knowledgeBase.systemBases") }}</h2>
        <div class="kb-grid">
          <NCard
            v-for="kb in store.systemBases"
            :key="kb.id"
            size="small"
            class="kb-card"
            hoverable
            @click="openKb(kb)"
          >
            <template #header>
              <div class="kb-card-header">
                <span class="kb-card-name">{{ kb.name }}</span>
                <NTag size="small" type="info" :bordered="false">{{ t("knowledgeBase.system") }}</NTag>
              </div>
            </template>
            <p class="kb-card-desc">{{ kb.description || t("knowledgeBase.noDescription") }}</p>
            <template #footer>
              <span class="kb-card-date">{{ formatDate(kb.created_at) }}</span>
            </template>
          </NCard>
        </div>
      </section>

      <!-- User KBs -->
      <section class="kb-section">
        <h2 class="kb-section-title">{{ t("knowledgeBase.userBases") }}</h2>
        <div v-if="store.userBases.length === 0 && !store.loading" class="kb-empty">
          <p>{{ t("knowledgeBase.empty") }}</p>
        </div>
        <div class="kb-grid">
          <NCard
            v-for="kb in store.userBases"
            :key="kb.id"
            size="small"
            class="kb-card"
            hoverable
            @click="openKb(kb)"
          >
            <template #header>
              <div class="kb-card-header">
                <span class="kb-card-name">{{ kb.name }}</span>
              </div>
            </template>
            <p class="kb-card-desc">{{ kb.description || t("knowledgeBase.noDescription") }}</p>
            <template #footer>
              <div class="kb-card-footer">
                <span class="kb-card-date">{{ formatDate(kb.created_at) }}</span>
                <NPopconfirm @positive-click="handleDelete(kb)">
                  <template #trigger>
                    <NButton size="tiny" text type="error" @click.stop>
                      {{ t("common.delete") }}
                    </NButton>
                  </template>
                  {{ t("knowledgeBase.deleteConfirm") }}
                </NPopconfirm>
              </div>
            </template>
          </NCard>
        </div>
      </section>
    </NSpin>

    <!-- Create Modal -->
    <NModal v-model:show="showCreateModal" :title="t('knowledgeBase.create')" preset="dialog">
      <NSpace vertical style="width: 100%">
        <NInput
          v-model:value="newName"
          :placeholder="t('knowledgeBase.namePlaceholder')"
          :maxlength="120"
        />
        <NInput
          v-model:value="newDescription"
          type="textarea"
          :placeholder="t('knowledgeBase.descPlaceholder')"
          :maxlength="500"
          :rows="3"
        />
        <NButton type="primary" :loading="creating" block @click="handleCreate">
          {{ t("common.confirm") }}
        </NButton>
      </NSpace>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.kb-view {
  padding: 24px 32px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.kb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.kb-title {
  font-size: 22px;
  font-weight: 700;
  color: $text-primary;
  margin: 0;
}

.kb-section {
  margin-bottom: 32px;
}

.kb-section-title {
  font-size: 14px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.kb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.kb-card {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: translateY(-2px);
  }
}

.kb-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.kb-card-name {
  font-weight: 600;
  font-size: 15px;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kb-card-desc {
  font-size: 13px;
  color: $text-secondary;
  line-height: 1.5;
  min-height: 40px;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.kb-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.kb-card-date {
  font-size: 12px;
  color: $text-muted;
}

.kb-empty {
  text-align: center;
  padding: 48px 0;
  color: $text-muted;
  font-size: 14px;
}
</style>
