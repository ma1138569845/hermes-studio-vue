<script setup lang="ts">
import { useOfficeStore } from '@/stores/hermes/office'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const store = useOfficeStore()

const cards = [
  { label: 'office.stats.online', value: store.onlineCount },
  { label: 'office.stats.busy', value: store.busyCount },
  { label: 'office.stats.openTasks', value: store.openTaskCount },
  { label: 'office.stats.doneToday', value: store.doneTodayCount },
]
</script>

<template>
  <div class="office-header-stats">
    <div v-for="card in cards" :key="card.label" class="stat-card">
      <span class="stat-label">{{ t(card.label) }}</span>
      <strong class="stat-value">{{ card.value }}</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.office-header-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.stat-card {
  border: 1px solid var(--border-color);
  border-radius: $radius-md;
  background: var(--bg-card);
  padding: 12px 16px;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
}

.stat-value {
  display: block;
  margin-top: 4px;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}
</style>
