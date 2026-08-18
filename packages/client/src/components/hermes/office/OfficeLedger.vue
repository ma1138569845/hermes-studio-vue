<script setup lang="ts">
import { computed } from 'vue'
import { NSelect } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useOfficeStore } from '@/stores/hermes/office'
import type { KanbanTask } from '@/api/hermes/kanban'

const { t } = useI18n()
const router = useRouter()
const officeStore = useOfficeStore()

const filterOptions = computed(() => [
  { label: t('office.filter.all'), value: 'all' },
  { label: t('office.filter.open'), value: 'open' },
  { label: t('office.filter.done'), value: 'done' },
])

function isDone(task: KanbanTask): boolean {
  return String(task.status ?? '').toLowerCase() === 'done'
}

function openTask(task: KanbanTask): void {
  void router.push({ name: 'hermes.kanban', query: { task: task.id } })
}
</script>

<template>
  <div class="office-ledger">
    <div class="office-ledger-head">
      <NSelect
        :value="officeStore.ledgerFilter"
        :options="filterOptions"
        size="small"
        style="width: 120px"
        @update:value="value => officeStore.setLedgerFilter(value as 'all' | 'open' | 'done')"
      />
    </div>
    <div class="office-ledger-list">
      <p v-if="officeStore.ledgerTasks.length === 0" class="office-ledger-empty">
        {{ t('office.empty.tasks') }}
      </p>
      <button
        v-for="task in officeStore.ledgerTasks"
        :key="task.id"
        type="button"
        class="office-ledger-item"
        :class="{ 'is-done': isDone(task) }"
        @click="openTask(task)"
      >
        <span class="office-ledger-check">{{ isDone(task) ? '✓' : '' }}</span>
        <span class="office-ledger-main">
          <span class="office-ledger-title">{{ task.title || task.id }}</span>
          <span class="office-ledger-meta">{{ task.assignee || t('office.unassigned') }} · {{ task.status }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.office-ledger {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 10px;
}

.office-ledger-head {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.office-ledger-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.office-ledger-empty {
  margin: 0;
  padding: 16px 8px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}

.office-ledger-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: $radius-sm;
  background: var(--bg-card);
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition:
    border-color $transition-fast,
    background-color $transition-fast;

  &:hover,
  &:focus-visible {
    border-color: var(--accent-primary);
    outline: none;
  }

  &.is-done {
    opacity: 0.65;

    .office-ledger-title {
      text-decoration: line-through;
    }
  }
}

.office-ledger-check {
  flex: 0 0 auto;
  width: 16px;
  color: var(--success);
  font-size: 12px;
}

.office-ledger-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.office-ledger-title {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.office-ledger-meta {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
