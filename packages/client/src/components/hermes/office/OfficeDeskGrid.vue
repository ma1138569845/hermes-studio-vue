<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { agentCssColor, agentTextCssColor } from './office-scene/theme'

export interface OfficeGridProfile {
  name: string
  online: boolean
  busy: boolean
}

const props = defineProps<{ profiles: OfficeGridProfile[] }>()
const emit = defineEmits<{ (event: 'agentClick', payload: { name: string; clientX: number; clientY: number }): void }>()
const { t } = useI18n()

function initial(name: string): string {
  const s = String(name || '?').trim()
  return s ? s[0].toUpperCase() : '?'
}

function statusKey(profile: OfficeGridProfile): 'busy' | 'online' | 'offline' {
  return profile.busy ? 'busy' : profile.online ? 'online' : 'offline'
}

function statusLabel(profile: OfficeGridProfile): string {
  return t(`office.status.${statusKey(profile)}`)
}

function deskClass(profile: OfficeGridProfile): string {
  const key = statusKey(profile)
  return `is-${key}`
}

const rows = computed(() =>
  props.profiles.map(profile => ({
    profile,
    cssColor: agentCssColor(profile.name),
    textColor: agentTextCssColor(profile.name),
    statusKey: statusKey(profile),
    label: statusLabel(profile),
  })),
)
</script>

<template>
  <div class="office-desk-grid">
    <button
      v-for="{ profile, cssColor, textColor, label } in rows"
      :key="profile.name"
      type="button"
      class="office-desk"
      :class="deskClass(profile)"
      @click="(event: MouseEvent) => emit('agentClick', { name: profile.name, clientX: event.clientX, clientY: event.clientY })"
    >
      <div class="office-desk-surface">
        <div class="office-desk-monitor" />
        <div class="office-char" :style="{ '--office-char-color': cssColor, '--office-char-text': textColor }">
          <div class="office-char-chair" />
          <div class="office-char-head">{{ initial(profile.name) }}</div>
          <div class="office-char-body" />
        </div>
        <span class="office-status-dot" :class="`office-status-${statusKey(profile)}`" :title="label" />
      </div>
      <div class="office-desk-label">
        <span class="office-desk-name">{{ profile.name }}</span>
        <span class="office-desk-status">{{ label }}</span>
      </div>
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.office-desk-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 16px;
  padding: 20px;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  align-content: start;
  background: var(--bg-secondary);
}

.office-desk {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: $radius-md;
  background: var(--bg-card);
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition:
    border-color $transition-fast,
    box-shadow $transition-fast;

  &:hover,
  &:focus-visible {
    border-color: var(--accent-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    outline: none;
  }

  &.is-offline {
    opacity: 0.6;
  }
}

.office-desk-surface {
  position: relative;
  height: 76px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  border-bottom: 2px solid var(--border-color);
}

.office-desk-monitor {
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 52px;
  height: 34px;
  border: 2px solid var(--text-secondary);
  border-radius: 4px;
  background: var(--bg-primary);
}

.office-char {
  position: relative;
  width: 48px;
  height: 58px;

  --office-char-color: #999999;
}

.office-char-chair {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 14px;
  border-radius: 5px;
  background: var(--text-muted);
}

.office-char-head {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--office-char-color);
  color: var(--office-char-text, #ffffff);
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.office-char-body {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 26px;
  border-radius: 10px 10px 6px 6px;
  background: var(--office-char-color);
}

.office-status-dot {
  position: absolute;
  top: 4px;
  right: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-muted);
  border: 1px solid var(--bg-card);
  box-shadow: 0 0 0 1px var(--border-color);

  &.office-status-online {
    background: var(--success);
  }

  &.office-status-busy {
    background: var(--warning);
  }

  &.office-status-offline {
    background: transparent;
  }
}

.office-desk-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.office-desk-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.office-desk-status {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
