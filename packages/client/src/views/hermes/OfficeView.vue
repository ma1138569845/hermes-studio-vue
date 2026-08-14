<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useOfficeStore } from '@/stores/hermes/office'
import OfficeScene from '@/components/hermes/office/OfficeScene.vue'
import OfficeDeskGrid from '@/components/hermes/office/OfficeDeskGrid.vue'
import OfficeLedger from '@/components/hermes/office/OfficeLedger.vue'
import OfficeAgentModal from '@/components/hermes/office/OfficeAgentModal.vue'
import type { OfficeSceneStrings } from '@/components/hermes/office/office-scene/engine'

const { t } = useI18n()
const officeStore = useOfficeStore()
const sceneRef = ref<InstanceType<typeof OfficeScene> | null>(null)
const sceneFailed = ref(false)

const ambientKeys = ['office.ambient1', 'office.ambient2', 'office.ambient3', 'office.ambient4']

const strings = computed<OfficeSceneStrings>(() => ({
  visitFallback: () => t('office.visitFallback'),
  ambientMessage: () => {
    const key = ambientKeys[Math.floor(Math.random() * ambientKeys.length)]
    return t(key)
  },
  decorLabel: (kind) => t(kind === 'kitchen' ? 'office.decor.kitchen' : 'office.decor.lounge'),
}))

function handleSceneReady(): void {
  sceneFailed.value = false
  officeStore.attachScene((action) => sceneRef.value?.enqueueAction(action) ?? false)
}

function handleSceneFailed(): void {
  sceneFailed.value = true
  officeStore.detachScene()
}

function handleAgentClick(name: string): void {
  officeStore.openAgent(name)
}

onMounted(() => {
  officeStore.start()
})

onUnmounted(() => {
  officeStore.stop()
})
</script>

<template>
  <div class="office-view">
    <header class="page-header">
      <h2 class="header-title">{{ t('office.title') }}</h2>
      <div class="header-actions">
        <NButton size="small" secondary @click="officeStore.load()">{{ t('office.refresh') }}</NButton>
      </div>
    </header>
    <div class="office-body">
      <div class="office-stage">
        <OfficeScene
          v-if="!sceneFailed"
          ref="sceneRef"
          :profiles="officeStore.officeProfiles"
          :strings="strings"
          @ready="handleSceneReady"
          @failed="handleSceneFailed"
          @agent-click="handleAgentClick"
        />
        <OfficeDeskGrid
          v-else
          :profiles="officeStore.officeProfiles"
          @agent-click="handleAgentClick"
        />
      </div>
      <aside class="office-side">
        <OfficeLedger />
      </aside>
    </div>
    <OfficeAgentModal />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.office-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.office-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
  padding: 0 16px 16px;
}

.office-stage {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--border-color);
  border-radius: $radius-md;
  overflow: hidden;
  background: var(--bg-secondary);
}

.office-side {
  width: 300px;
  flex: 0 0 300px;
  min-height: 0;
  border: 1px solid var(--border-color);
  border-radius: $radius-md;
  padding: 12px;
  background: var(--bg-card);
  overflow: hidden;
}

@media (max-width: $breakpoint-mobile) {
  .office-body {
    flex-direction: column;
  }

  .office-side {
    width: 100%;
    flex: none;
    height: 260px;
  }
}
</style>
