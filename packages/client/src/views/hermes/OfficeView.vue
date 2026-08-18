<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useOfficeStore } from '@/stores/hermes/office'
import OfficeScene from '@/components/hermes/office/OfficeScene.vue'
import OfficeDeskGrid from '@/components/hermes/office/OfficeDeskGrid.vue'
import OfficeAgentModal from '@/components/hermes/office/OfficeAgentModal.vue'
import OfficeHeaderStats from '@/components/hermes/office/OfficeHeaderStats.vue'
import OfficeRightPanel from '@/components/hermes/office/OfficeRightPanel.vue'
import OfficeBottomToolbar from '@/components/hermes/office/OfficeBottomToolbar.vue'
import OfficeAgentActionMenu from '@/components/hermes/office/OfficeAgentActionMenu.vue'
import type { OfficeSceneStrings } from '@/components/hermes/office/office-scene/engine'

const { t } = useI18n()
const officeStore = useOfficeStore()
const sceneRef = ref<InstanceType<typeof OfficeScene> | null>(null)
const sceneFailed = ref(false)
const actionMenu = ref<{ name: string; x: number; y: number } | null>(null)

const ambientKeys = ['office.ambient1', 'office.ambient2', 'office.ambient3', 'office.ambient4']

const strings = computed<OfficeSceneStrings>(() => ({
  visitFallback: () => t('office.visitFallback'),
  ambientMessage: () => {
    const key = ambientKeys[Math.floor(Math.random() * ambientKeys.length)]
    return t(key)
  },
}))

function handleSceneReady(): void {
  sceneFailed.value = false
  officeStore.attachScene((action) => sceneRef.value?.enqueueAction(action) ?? false)
}

function handleSceneFailed(): void {
  sceneFailed.value = true
  officeStore.detachScene()
}

function handleAgentClick(payload: { name: string; clientX: number; clientY: number }): void {
  actionMenu.value = { name: payload.name, x: payload.clientX, y: payload.clientY }
}

function openProfile(name: string): void {
  officeStore.openAgent(name)
  actionMenu.value = null
}

async function handleSetState(state: 'working' | 'online' | 'offline' | 'thinking', task?: string): Promise<void> {
  const name = actionMenu.value?.name
  if (name) await officeStore.dispatchSetState(name, state, task)
}

async function handleInteract(targetName: string): Promise<void> {
  const visitor = actionMenu.value?.name
  if (visitor) await officeStore.dispatchDeskVisit(visitor, targetName, t('office.visitFallback'))
}

function handleNewTask(): void {
  // Future: navigate to kanban task creation or open a task modal.
}

function handleExportReport(): void {
  // Future: trigger report export.
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

    <OfficeHeaderStats />

    <div class="office-dashboard">
      <main class="office-stage">
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
        <OfficeBottomToolbar @new-task="handleNewTask" @export-report="handleExportReport" />
      </main>
      <OfficeRightPanel />
    </div>

    <OfficeAgentModal />

    <Teleport v-if="actionMenu" to="body">
      <div
        class="office-action-backdrop"
        aria-hidden="true"
        @click="actionMenu = null"
      />
      <OfficeAgentActionMenu
        :agent-name="actionMenu.name"
        :x="actionMenu.x"
        :y="actionMenu.y"
        @close="actionMenu = null"
        @open-profile="openProfile"
        @set-state="handleSetState"
        @interact="handleInteract"
      />
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.office-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 12px;
  padding: 12px 16px 16px;
}

.office-dashboard {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
}

.office-stage {
  flex: 1;
  min-width: 0;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: $radius-md;
  background: var(--bg-secondary);
}

.office-action-backdrop {
  position: fixed;
  inset: 0;
  z-index: 999;
}

@media (max-width: $breakpoint-mobile) {
  .office-dashboard {
    flex-direction: column;
  }
}
</style>
