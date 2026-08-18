<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { NButton, NModal, NSpin, NTabs, NTabPane, NEmpty } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useOfficeStore } from '@/stores/hermes/office'
import { useProfilesStore } from '@/stores/hermes/profiles'
import { fetchSkills } from '@/api/hermes/skills'
import { fetchMemoryForProfile } from '@/api/hermes/office'
import { agentCssColor } from './office-scene/theme'
import MarkdownRenderer from '@/components/hermes/chat/MarkdownRenderer.vue'
import type { MemoryData } from '@/api/hermes/skills'
import type { SkillInfo } from '@/api/hermes/skills'
import type { KanbanTask } from '@/api/hermes/kanban'

const { t } = useI18n()
const router = useRouter()
const officeStore = useOfficeStore()
const profilesStore = useProfilesStore()

const activeTab = ref('config')
const memory = reactive<Record<string, MemoryData | null>>({})
const memoryError = reactive<Record<string, string>>({})
const skills = reactive<Record<string, SkillInfo[] | null>>({})
const skillsError = reactive<Record<string, string>>({})

const profile = computed(() => officeStore.activeAgent)
const show = computed({
  get: () => !!profile.value,
  set: (value: boolean) => {
    if (!value) officeStore.closeAgent()
  },
})

const sceneProfile = computed(() => officeStore.officeProfiles.find(p => p.name === profile.value))
const statusKey = computed<'busy' | 'online' | 'offline'>(() =>
  sceneProfile.value?.busy ? 'busy' : sceneProfile.value?.online ? 'online' : 'offline',
)

const tasks = computed<KanbanTask[]>(() => (profile.value ? officeStore.tasksForAgent(profile.value) : []))
const archivedTasks = computed<KanbanTask[]>(() => (profile.value ? officeStore.archivedTasksForAgent(profile.value) : []))

function initial(name: string): string {
  const s = String(name || '?').trim()
  return s ? s[0].toUpperCase() : '?'
}

async function loadMemory(name: string): Promise<void> {
  if (memory[name] || memoryError[name]) return
  try {
    memory[name] = await fetchMemoryForProfile(name)
  } catch (error) {
    memoryError[name] = error instanceof Error ? error.message : String(error)
  }
}

async function loadSkills(name: string): Promise<void> {
  if (skills[name] !== undefined || skillsError[name]) return
  try {
    const data = await fetchSkills(name)
    skills[name] = data.categories.flatMap(category => category.skills)
  } catch (error) {
    skillsError[name] = error instanceof Error ? error.message : String(error)
  }
}

watch(profile, (name) => {
  activeTab.value = 'config'
  if (name) void loadMemory(name)
}, { immediate: true })

watch(activeTab, (tab) => {
  const name = profile.value
  if (!name) return
  if (tab === 'config' || tab === 'memory') void loadMemory(name)
  if (tab === 'skills') void loadSkills(name)
})

function splitIntoCards(text: string): Array<{ title: string; body: string }> {
  return text.split(/§+/).map(section => section.trim()).filter(Boolean).map(chunk => {
    const lines = chunk.split('\n')
    const title = lines[0].replace(/^#+\s*/, '').trim() || ''
    const body = lines.slice(1).join('\n').trim() || lines[0]
    return { title, body }
  })
}

async function openChat(): Promise<void> {
  const name = profile.value
  if (!name) return
  await profilesStore.switchHermesProfile(name).catch(() => undefined)
  void router.push({ name: 'hermes.chat' })
}

function openTaskInKanban(task: KanbanTask): void {
  void router.push({ name: 'hermes.kanban', query: { task: task.id } })
}
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    class="office-agent-modal"
    :style="{ width: 'min(760px, 92vw)' }"
    :title="t('office.title')"
  >
    <template v-if="profile">
      <div class="office-agent-modal-identity">
        <div
          class="office-agent-avatar"
          :style="{ '--office-char-color': agentCssColor(profile) }"
        >{{ initial(profile) }}</div>
        <div class="office-agent-modal-meta">
          <div class="office-agent-name">{{ profile }}</div>
          <div class="office-agent-status" :class="`office-status-${statusKey}`">
            {{ t(`office.status.${statusKey}`) }}
          </div>
        </div>
      </div>

      <NTabs v-model:value="activeTab" type="line" size="small" class="office-agent-tabs">
        <NTabPane name="config" :tab="t('office.tab.config')">
          <template v-if="memory[profile]">
            <div v-if="memory[profile]?.soul" class="office-agent-body">
              <MarkdownRenderer :content="memory[profile]!.soul" />
            </div>
            <NEmpty v-else :description="t('office.agent.soulEmpty')" size="small" />
          </template>
          <NSpin v-else-if="!memoryError[profile]" class="office-agent-loading" />
          <div v-else class="office-agent-error">{{ memoryError[profile] }}</div>
        </NTabPane>

        <NTabPane name="skills" :tab="t('office.tab.skills')">
          <template v-if="skills[profile] !== undefined">
            <div class="office-agent-section-title">
              {{ t('office.tab.skills') }}
              <span class="office-agent-section-count">
                {{ skills[profile]!.filter(skill => skill.enabled !== false).length }} / {{ skills[profile]!.length }}
              </span>
            </div>
            <div v-if="skills[profile]!.length" class="office-agent-skill-list">
              <div
                v-for="skill in skills[profile]!"
                :key="skill.name"
                class="office-agent-skill-item"
                :class="{ disabled: skill.enabled === false }"
              >
                <div class="office-agent-skill-name">{{ skill.name }}</div>
                <div v-if="skill.description" class="office-agent-skill-desc">{{ skill.description }}</div>
              </div>
            </div>
            <NEmpty v-else :description="t('office.agent.skillsEmpty')" size="small" />
          </template>
          <NSpin v-else-if="!skillsError[profile]" class="office-agent-loading" />
          <div v-else class="office-agent-error">{{ skillsError[profile] }}</div>
        </NTabPane>

        <NTabPane name="memory" :tab="t('office.tab.memory')">
          <template v-if="memory[profile]">
            <div class="office-agent-section-title">{{ t('office.agent.notes') }}</div>
            <div v-if="memory[profile]!.memory" class="office-agent-card-list">
              <div v-for="card in splitIntoCards(memory[profile]!.memory)" :key="card.title" class="office-agent-card">
                <div class="office-agent-card-header">{{ card.title }}</div>
                <div class="office-agent-card-body">
                  <MarkdownRenderer :content="card.body" />
                </div>
              </div>
            </div>
            <NEmpty v-else :description="t('office.agent.memoryEmpty')" size="small" />

            <div class="office-agent-section-title office-agent-section-spaced">{{ t('office.agent.userProfile') }}</div>
            <div v-if="memory[profile]!.user" class="office-agent-card-list">
              <div v-for="card in splitIntoCards(memory[profile]!.user)" :key="card.title" class="office-agent-card">
                <div class="office-agent-card-header">{{ card.title }}</div>
                <div class="office-agent-card-body">
                  <MarkdownRenderer :content="card.body" />
                </div>
              </div>
            </div>
            <NEmpty v-else :description="t('office.agent.userEmpty')" size="small" />
          </template>
          <NSpin v-else-if="!memoryError[profile]" class="office-agent-loading" />
          <div v-else class="office-agent-error">{{ memoryError[profile] }}</div>
        </NTabPane>

        <NTabPane name="tasks" :tab="t('office.tab.tasks')">
          <div v-if="tasks.length" class="office-agent-task-list">
            <button
              v-for="task in tasks"
              :key="task.id"
              type="button"
              class="office-agent-task-item"
              @click="openTaskInKanban(task)"
            >
              <span class="office-agent-task-title">{{ task.title || task.id }}</span>
              <span class="office-agent-task-meta">{{ task.status }}</span>
            </button>
          </div>
          <NEmpty v-else :description="t('office.agent.tasksEmpty')" size="small" />
        </NTabPane>

        <NTabPane name="archive" :tab="t('office.tab.archive')">
          <div v-if="archivedTasks.length" class="office-agent-task-list">
            <button
              v-for="task in archivedTasks"
              :key="task.id"
              type="button"
              class="office-agent-task-item"
              @click="openTaskInKanban(task)"
            >
              <span class="office-agent-task-title">{{ task.title || task.id }}</span>
              <span class="office-agent-task-meta">{{ task.status }}</span>
            </button>
          </div>
          <NEmpty v-else :description="t('office.agent.archiveEmpty')" size="small" />
        </NTabPane>

        <NTabPane name="chat" :tab="t('office.tab.chat')">
          <div class="office-agent-chat">
            <p class="office-agent-chat-hint">{{ t('office.agent.chatHint', { name: profile }) }}</p>
            <NButton type="primary" size="small" @click="openChat">{{ t('office.agent.openChat') }}</NButton>
          </div>
        </NTabPane>
      </NTabs>
    </template>
  </NModal>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.office-agent-modal-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border-color);
}

.office-agent-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--office-char-color, var(--text-muted));
  color: #ffffff;
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.office-agent-modal-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.office-agent-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.office-agent-status {
  font-size: 12px;
  color: var(--text-muted);

  &.office-status-online {
    color: var(--success);
  }

  &.office-status-busy {
    color: var(--warning);
  }
}

.office-agent-tabs {
  min-height: 320px;
  max-height: 56vh;
}

.office-agent-loading {
  padding: 48px 0;
}

.office-agent-error {
  padding: 24px 0;
  font-size: 12px;
  color: var(--error);
}

.office-agent-body {
  max-height: 44vh;
  overflow-y: auto;
}

.office-agent-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.office-agent-section-spaced {
  margin-top: 18px;
}

.office-agent-section-count {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
}

.office-agent-skill-list,
.office-agent-card-list,
.office-agent-task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 44vh;
  overflow-y: auto;
}

.office-agent-skill-item {
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: $radius-sm;
  background: var(--bg-card);

  &.disabled {
    opacity: 0.55;
  }
}

.office-agent-skill-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.office-agent-skill-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.office-agent-card {
  border: 1px solid var(--border-color);
  border-radius: $radius-sm;
  background: var(--bg-card);
  overflow: hidden;
}

.office-agent-card-header {
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-light);
}

.office-agent-card-body {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.office-agent-task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

  &:hover,
  &:focus-visible {
    border-color: var(--accent-primary);
    outline: none;
  }
}

.office-agent-task-title {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.office-agent-task-meta {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--text-muted);
}

.office-agent-chat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 0;
}

.office-agent-chat-hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
