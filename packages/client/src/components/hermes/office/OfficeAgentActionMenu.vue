<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOfficeStore } from '@/stores/hermes/office'

const MENU_WIDTH = 220
const MENU_MAX_HEIGHT = 460
const VIEWPORT_MARGIN = 12

const props = defineProps<{
  agentName: string
  x: number
  y: number
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'openProfile', name: string): void
  (event: 'setState', state: 'working' | 'online' | 'offline' | 'thinking', task?: string): void
  (event: 'interact', targetName: string): void
}>()

const { t } = useI18n()
const store = useOfficeStore()

const onlineOthers = computed(() =>
  store.officeProfiles.filter(p => p.online && p.name !== props.agentName).map(p => p.name),
)

const menuStyle = computed(() => {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = props.x
  let top = props.y

  if (left + MENU_WIDTH + VIEWPORT_MARGIN > vw) {
    left = Math.max(VIEWPORT_MARGIN, vw - MENU_WIDTH - VIEWPORT_MARGIN)
  }
  if (top + MENU_MAX_HEIGHT + VIEWPORT_MARGIN > vh) {
    top = Math.max(VIEWPORT_MARGIN, top - MENU_MAX_HEIGHT - VIEWPORT_MARGIN)
  }

  return { left: `${left}px`, top: `${top}px` }
})

const stateActions = [
  { label: 'office.action.working', state: 'working' as const, task: 'office.action.workingTask' },
  { label: 'office.action.thinking', state: 'thinking' as const, task: 'office.action.thinkingTask' },
  { label: 'office.action.online', state: 'online' as const },
  { label: 'office.action.offline', state: 'offline' as const },
]

function setState(state: 'working' | 'online' | 'offline' | 'thinking', task?: string) {
  emit('setState', state, task)
  emit('close')
}

function interact(target: string) {
  emit('interact', target)
  emit('close')
}
</script>

<template>
  <div class="agent-action-menu" :style="menuStyle">
    <div class="agent-action-head">
      <span class="agent-action-name">{{ agentName }}</span>
    </div>

    <div class="agent-action-group">
      <div class="agent-action-section-title">{{ t('office.action.interact') }}</div>
      <div class="agent-action-section-hint">{{ t('office.action.interactHint') }}</div>
      <button
        v-for="name in onlineOthers"
        :key="name"
        type="button"
        class="agent-action-btn"
        @click="interact(name)"
      >{{ t('office.action.interactWith', { name }) }}</button>
      <div v-if="onlineOthers.length === 0" class="agent-action-empty">{{ t('office.action.noOnlineTargets') }}</div>
    </div>

    <div class="agent-action-group">
      <div class="agent-action-section-title">{{ t('office.action.state') }}</div>
      <div class="agent-action-section-hint">{{ t('office.action.stateHint') }}</div>
      <button
        v-for="action in stateActions"
        :key="action.state"
        type="button"
        class="agent-action-btn"
        @click="setState(action.state, action.task ? t(action.task) : undefined)"
      >{{ t(action.label) }}</button>
    </div>

    <div class="agent-action-group">
      <button
        type="button"
        class="agent-action-btn"
        data-testid="view-profile"
        @click="emit('openProfile', agentName); emit('close')"
      >
        {{ t('office.action.viewProfile') }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.agent-action-menu {
  position: fixed;
  z-index: 1000;
  width: 220px;
  max-height: min(460px, calc(100vh - 24px));
  overflow-y: auto;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: $radius-md;
  background: var(--bg-card);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.14);
  scrollbar-width: thin;
  scrollbar-color: var(--text-muted) transparent;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--text-muted);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary);
  }
}

.agent-action-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 10px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 8px;
}

.agent-action-name {
  font-size: 14px;
  font-weight: 700;
}

.agent-action-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.agent-action-group + .agent-action-group {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.agent-action-section-title {
  padding: 0 8px 2px;
  font-size: 11px;
  color: var(--text-muted);
}

.agent-action-section-hint {
  padding: 0 8px 6px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-secondary);
}

.agent-action-empty {
  padding: 0 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.agent-action-btn {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text-primary);
  border-radius: 6px;
  padding: 8px 10px;
  font: inherit;
  font-size: 13px;
  text-align: start;
  cursor: pointer;
  transition: background-color $transition-fast;

  &:hover,
  &:focus-visible {
    background: var(--bg-hover);
    outline: none;
  }
}

</style>
