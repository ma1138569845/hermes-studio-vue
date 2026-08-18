<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import OfficeLedger from './OfficeLedger.vue'

const { t } = useI18n()
</script>

<template>
  <aside class="office-right-panel">
    <section class="panel-section">
      <h3>{{ t('office.rightPanel.taskFlow') }}</h3>
      <div class="panel-section-content">
        <OfficeLedger />
      </div>
    </section>

    <section class="panel-section panel-grow">
      <h3>{{ t('office.rightPanel.activity') }}</h3>
      <div class="panel-section-content">
        <div class="office-activity-empty">{{ t('office.rightPanel.activityEmpty') }}</div>
      </div>
    </section>

    <section class="panel-section">
      <h3>{{ t('office.rightPanel.quickTools') }}</h3>
      <div class="panel-section-content">
        <div class="quick-tools">
          <button type="button" class="quick-tool">{{ t('office.rightPanel.files') }}</button>
          <button type="button" class="quick-tool">{{ t('office.rightPanel.browser') }}</button>
        </div>
      </div>
    </section>
  </aside>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.office-right-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 280px;
  flex: 0 0 280px;
  height: 100%;
  min-height: 0;
  padding: 12px;
  border-inline-start: 1px solid var(--border-color);
  background: var(--bg-card);
  overflow: hidden;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;

  > h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.panel-grow {
  flex: 1;
  min-height: 0;
}

.panel-section-content {
  min-height: 0;
  overflow: hidden;
}

.office-activity-empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px 4px;
}

.quick-tools {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.quick-tool {
  min-height: 52px;
  border: 1px solid var(--border-color);
  border-radius: $radius-sm;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition:
    border-color $transition-fast,
    background-color $transition-fast;

  &:hover,
  &:focus-visible {
    border-color: var(--accent-primary);
    outline: none;
  }
}

@media (max-width: $breakpoint-mobile) {
  .office-right-panel {
    display: none;
  }
}
</style>
