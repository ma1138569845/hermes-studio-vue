/**
 * 进程内 Office 场景动作队列。
 *
 * 外部系统 POST office actions（desk_visit / desk_visit_tour / set_state /
 * broadcast / celebrate），webui Office 面板短轮询 GET 取走后交由 Pixi 场景播放。
 * 语义对照 dechnic-auditor-agent-main 的 office_actions（其源头为
 * ai-office-react-main scripts/action-gateway.mjs）：POST 入队、GET 取走。
 *
 * 队列是进程内易失结构——动作只是场景触发信号，不是持久状态。
 */

export type OfficeAction =
  | { type: 'desk_visit'; visitor: string; host: string; message?: string }
  | { type: 'desk_visit_tour'; visitor: string; hosts: string[]; message?: string }
  | { type: 'set_state'; profile: string; state: 'working' | 'online' | 'offline' | 'thinking'; task?: string }
  | { type: 'broadcast'; message: string }
  | { type: 'celebrate'; target: string }

const MAX_QUEUED = 100
const MAX_MESSAGE_LEN = 500
const MAX_TOUR_STOPS = 12
const MAX_NAME_LEN = 120
const ALLOWED_TYPES = new Set(['desk_visit', 'desk_visit_tour', 'set_state', 'broadcast', 'celebrate'])
const ALLOWED_STATES = new Set(['working', 'online', 'offline', 'thinking'])

let queue: OfficeAction[] = []
let droppedCount = 0
let acceptedCount = 0

function name(value: unknown): string {
  return String(value ?? '').trim().slice(0, MAX_NAME_LEN)
}

function message(value: unknown): string {
  return String(value ?? '').slice(0, MAX_MESSAGE_LEN)
}

/** 校验并归一化单个动作；无效时返回 null。 */
function sanitize(action: unknown): OfficeAction | null {
  if (!action || typeof action !== 'object') return null
  const record = action as Record<string, unknown>
  const type = record.type
  if (typeof type !== 'string' || !ALLOWED_TYPES.has(type)) return null

  if (type === 'desk_visit') {
    const visitor = name(record.visitor)
    const host = name(record.host)
    if (!visitor || !host || visitor === host) return null
    return { type: 'desk_visit', visitor, host, message: message(record.message) || undefined }
  }

  if (type === 'desk_visit_tour') {
    const visitor = name(record.visitor)
    const hosts = Array.isArray(record.hosts)
      ? Array.from(new Set(record.hosts.map(name).filter(Boolean)))
      : []
    const filtered = hosts.filter(host => host !== visitor)
    if (!visitor || filtered.length === 0) return null
    return { type: 'desk_visit_tour', visitor, hosts: filtered.slice(0, MAX_TOUR_STOPS), message: message(record.message) || undefined }
  }

  if (type === 'set_state') {
    const profile = name(record.profile)
    const state = String(record.state ?? '')
    if (!profile || !ALLOWED_STATES.has(state)) return null
    return { type: 'set_state', profile, state: state as Extract<OfficeAction, { type: 'set_state' }>['state'], task: message(record.task) || undefined }
  }

  if (type === 'broadcast') {
    const text = message(record.message)
    return text ? { type: 'broadcast', message: text } : null
  }

  // celebrate
  const target = name(record.target)
  return target ? { type: 'celebrate', target } : null
}

/** 接受单个动作对象，或 {"actions": [...]} / [...] 批量。 */
export function normalizePayload(payload: unknown): OfficeAction[] {
  let raw: unknown[]
  if (payload && typeof payload === 'object' && Array.isArray((payload as { actions?: unknown }).actions)) {
    raw = (payload as { actions: unknown[] }).actions
  } else if (Array.isArray(payload)) {
    raw = payload
  } else {
    raw = [payload]
  }
  const result: OfficeAction[] = []
  for (const item of raw) {
    const action = sanitize(item)
    if (action) result.push(action)
  }
  return result
}

/** 追加动作；超过上限时丢弃最旧的。 */
export function enqueue(actions: OfficeAction[]): { accepted: number; queued: number } {
  for (const action of actions) {
    if (queue.length >= MAX_QUEUED) {
      queue.shift()
      droppedCount += 1
    }
    queue.push(action)
    acceptedCount += 1
  }
  return { accepted: actions.length, queued: queue.length }
}

/** 取走全部排队动作（原子交换）。 */
export function drain(): OfficeAction[] {
  const batch = queue
  queue = []
  return batch
}

export function stats(): { queued: number; accepted: number; dropped: number; max_queued: number } {
  return { queued: queue.length, accepted: acceptedCount, dropped: droppedCount, max_queued: MAX_QUEUED }
}

/** 清空队列并归零统计（供测试隔离或进程重置使用）。 */
export function reset(): void {
  queue = []
  droppedCount = 0
  acceptedCount = 0
}
