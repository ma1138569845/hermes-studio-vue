import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { listTasks } from '@/api/hermes/kanban'
import { fetchProfileRuntimeStatuses } from '@/api/hermes/profiles'
import { drainOfficeActions, enqueueOfficeAction } from '@/api/hermes/office'
import { useKanbanStore } from './kanban'
import { useProfilesStore } from './profiles'
import { agentColor } from '@/components/hermes/office/office-scene/theme'
import type { OfficeAgentProfile } from '@/components/hermes/office/office-scene/engine'
import type { OfficeAction } from '@/api/hermes/office'
import type { KanbanTask } from '@/api/hermes/kanban'

const DONE_STATUSES = new Set(['done'])
const ARCHIVED_STATUS = 'archived'
const REFRESH_MS = 15000
const ACTION_POLL_MS = 2000

export type LedgerFilter = 'all' | 'open' | 'done'

function isDone(task: KanbanTask): boolean {
  return DONE_STATUSES.has(String(task.status ?? '').toLowerCase())
}

function isArchived(task: KanbanTask): boolean {
  return String(task.status ?? '').toLowerCase() === ARCHIVED_STATUS
}

function taskMap(tasks: KanbanTask[]): Map<string, KanbanTask> {
  return new Map(tasks.map(task => [task.id, task]))
}

export const useOfficeStore = defineStore('office', () => {
  const { t } = useI18n()
  const profilesStore = useProfilesStore()
  const kanbanStore = useKanbanStore()

  const gatewayRunning = ref<Record<string, boolean>>({})
  const tasks = ref<KanbanTask[]>([])
  const ledgerFilter = ref<LedgerFilter>('open')
  const activeAgent = ref<string | null>(null)
  const sceneAvailable = ref(false)

  let sceneEnqueue: ((action: OfficeAction) => boolean) | null = null
  let refreshTimer: ReturnType<typeof setInterval> | null = null
  let actionTimer: ReturnType<typeof setInterval> | null = null
  let boardSnapshot: Map<string, KanbanTask> | null = null
  let dispatcherIdx = 0

  const officeProfiles = computed<OfficeAgentProfile[]>(() => {
    const names = new Set<string>([
      ...profilesStore.profiles.map(profile => profile.name),
      ...Object.keys(gatewayRunning.value),
    ])
    return [...names].map(name => ({
      name,
      color: agentColor(name),
      online: !!gatewayRunning.value[name],
      busy: tasks.value.some(task => task.assignee === name && !isDone(task) && !isArchived(task)),
    }))
  })

  const ledgerTasks = computed(() => {
    const filtered = tasks.value.filter(task => {
      const done = isDone(task)
      if (ledgerFilter.value === 'open') return !done && !isArchived(task)
      if (ledgerFilter.value === 'done') return done
      return true
    })
    return [...filtered].sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
  })

  const onlineCount = computed(() => officeProfiles.value.filter(p => p.online).length)
  const busyCount = computed(() => officeProfiles.value.filter(p => p.busy).length)
  const openTaskCount = computed(() => tasks.value.filter(t => !isDone(t) && !isArchived(t)).length)
  const doneTodayCount = computed(() => {
    const startOfDay = new Date().setHours(0, 0, 0, 0)
    return tasks.value.filter(t => isDone(t) && (t.updated_at ?? t.created_at ?? 0) >= startOfDay).length
  })
  const blockedTaskCount = computed(() => tasks.value.filter(t => String(t.status ?? '').toLowerCase() === 'blocked').length)

  /** 某 agent 名下未归档的任务（弹窗 tasks tab）。 */
  const tasksForAgent = (name: string): KanbanTask[] =>
    tasks.value
      .filter(task => task.assignee === name && String(task.status ?? '').toLowerCase() !== ARCHIVED_STATUS)
      .slice(0, 50)

  /** 某 agent 名下的归档任务（弹窗 archive tab）。 */
  const archivedTasksForAgent = (name: string): KanbanTask[] =>
    tasks.value.filter(task => task.assignee === name && String(task.status ?? '').toLowerCase() === ARCHIVED_STATUS)

  async function loadRuntimeStatuses(): Promise<void> {
    try {
      const statuses = await fetchProfileRuntimeStatuses()
      const map: Record<string, boolean> = {}
      for (const status of statuses) map[status.profile] = !!status.gateway?.running
      gatewayRunning.value = map
    } catch {
      gatewayRunning.value = {}
    }
  }

  async function loadTasks(): Promise<void> {
    try {
      tasks.value = await listTasks({ board: kanbanStore.selectedBoard, includeArchived: true })
    } catch {
      tasks.value = []
    }
  }

  /** 从在线 profile 中轮换取一位调度者（不含 assignee 本人）。 */
  function pickDispatcher(assignee: string): string | null {
    const online = profilesStore.profiles
      .map(profile => profile.name)
      .filter(name => gatewayRunning.value[name] && name !== assignee)
    if (online.length === 0) return null
    const picked = online[dispatcherIdx % online.length]
    dispatcherIdx += 1
    return picked
  }

  /**
   * 对比前后两次看板，把变化翻译成场景动作：
   *  - 新开任务（有 assignee）→ 调度者走过去告知任务标题
   *  - 任务转为 done → assignee 庆祝
   * 首次加载（无前一次快照）刻意不触发任何动作。
   */
  function detectBoardEvents(prev: Map<string, KanbanTask> | null, next: KanbanTask[]): void {
    if (!prev || !sceneEnqueue) return
    for (const task of next) {
      const before = prev.get(task.id)
      if (!before && task.assignee && !isDone(task)) {
        const visitor = pickDispatcher(task.assignee)
        if (visitor) {
          sceneEnqueue({
            type: 'desk_visit',
            visitor,
            host: task.assignee,
            message: `${t('office.newTaskPrefix')}: ${String(task.title || '').slice(0, 60)}`,
          })
        }
      } else if (before && !isDone(before) && isDone(task) && task.assignee) {
        sceneEnqueue({ type: 'celebrate', target: task.assignee })
      }
    }
  }

  async function load(): Promise<void> {
    const prev = boardSnapshot
    await Promise.all([
      profilesStore.fetchProfiles(),
      loadRuntimeStatuses(),
      loadTasks(),
    ])
    detectBoardEvents(prev, tasks.value)
    boardSnapshot = taskMap(tasks.value)
  }

  /** 绑定 Pixi 场景（成功初始化后），并立即取走积压动作。 */
  function attachScene(enqueue: (action: OfficeAction) => boolean): void {
    sceneEnqueue = enqueue
    sceneAvailable.value = true
    void drainActions()
  }

  /** 场景销毁/失败时解绑（DOM 降级模式下不再轮询动作）。 */
  function detachScene(): void {
    sceneEnqueue = null
    sceneAvailable.value = false
  }

  async function drainActions(): Promise<void> {
    if (!sceneEnqueue) return
    try {
      const actions = await drainOfficeActions()
      for (const action of actions) sceneEnqueue(action)
    } catch (error) {
      // 后端端点缺失（旧后端 404）时停止轮询，避免每 2s 空转。
      if (error instanceof Error && / 404 /.test(error.message)) {
        if (actionTimer) {
          clearInterval(actionTimer)
          actionTimer = null
        }
      }
    }
  }

  function isVisible(): boolean {
    return typeof document === 'undefined' || document.visibilityState === 'visible'
  }

  function start(): void {
    if (refreshTimer || actionTimer) return
    void load()
    // 标签页不可见时暂停轮询，避免后台空转（与看板页行为一致）。
    refreshTimer = setInterval(() => {
      if (isVisible()) void load()
    }, REFRESH_MS)
    actionTimer = setInterval(() => {
      if (isVisible()) void drainActions()
    }, ACTION_POLL_MS)
  }

  function stop(): void {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
    if (actionTimer) {
      clearInterval(actionTimer)
      actionTimer = null
    }
    boardSnapshot = null
    detachScene()
  }

  function setLedgerFilter(filter: LedgerFilter): void {
    ledgerFilter.value = filter
  }

  function openAgent(name: string): void {
    activeAgent.value = name
  }

  function closeAgent(): void {
    activeAgent.value = null
  }

  async function dispatchSetState(profile: string, state: 'working' | 'online' | 'offline' | 'thinking', task?: string): Promise<void> {
    await enqueueOfficeAction({ type: 'set_state', profile, state, task })
  }

  async function dispatchDeskVisit(visitor: string, host: string, message?: string): Promise<void> {
    await enqueueOfficeAction({ type: 'desk_visit', visitor, host, message })
  }

  async function dispatchBroadcast(message: string): Promise<void> {
    await enqueueOfficeAction({ type: 'broadcast', message })
  }

  return {
    gatewayRunning,
    tasks,
    officeProfiles,
    ledgerTasks,
    ledgerFilter,
    activeAgent,
    sceneAvailable,
    onlineCount,
    busyCount,
    openTaskCount,
    doneTodayCount,
    blockedTaskCount,
    tasksForAgent,
    archivedTasksForAgent,
    load,
    start,
    stop,
    attachScene,
    detachScene,
    drainActions,
    setLedgerFilter,
    openAgent,
    closeAgent,
    dispatchSetState,
    dispatchDeskVisit,
    dispatchBroadcast,
  }
})
