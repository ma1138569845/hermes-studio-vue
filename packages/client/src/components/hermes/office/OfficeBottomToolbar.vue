<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useOfficeStore } from '@/stores/hermes/office'

const { t } = useI18n()
const store = useOfficeStore()
const emit = defineEmits<{
  (event: 'newTask'): void
  (event: 'exportReport'): void
}>()

async function pauseAll() {
  await Promise.all(store.officeProfiles.map(p => store.dispatchSetState(p.name, 'offline')))
}

async function resumeAll() {
  await Promise.all(store.officeProfiles.map(p => store.dispatchSetState(p.name, 'online')))
}

function newTask() {
  emit('newTask')
}
</script>

<template>
  <div class="office-bottom-toolbar">
    <div class="toolbar-inner">
      <button type="button" class="toolbar-btn" @click="pauseAll">
        {{ t('office.toolbar.pauseAll') }}
      </button>
      <button type="button" class="toolbar-btn" @click="resumeAll">
        {{ t('office.toolbar.resumeAll') }}
      </button>
      <button type="button" class="toolbar-btn primary" @click="newTask">
        {{ t('office.toolbar.newTask') }}
      </button>
      <button type="button" class="toolbar-btn" @click="$emit('exportReport')">
        {{ t('office.toolbar.exportReport') }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.office-bottom-toolbar {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  z-index: 10;
  pointer-events: none;
}

.toolbar-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--bg-card);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  pointer-events: auto;
}

.toolbar-btn {
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  padding: 8px 12px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition:
    background-color $transition-fast,
    color $transition-fast;

  &:hover,
  &:focus-visible {
    background: var(--bg-hover);
    outline: none;
  }

  &.primary {
    background: var(--accent-primary);
    color: #fff;

    &:hover,
    &:focus-visible {
      background: var(--accent-primary-hover, var(--accent-primary));
    }
  }
}

@media (max-width: $breakpoint-mobile) {
  .toolbar-inner {
    padding: 6px 8px;
    gap: 4px;
  }

  .toolbar-btn {
    padding: 6px 8px;
    font-size: 11px;
  }
}
</style>
