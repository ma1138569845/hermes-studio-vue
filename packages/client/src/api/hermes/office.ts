import { request } from '../client'
import type { MemoryData } from './skills'

export type OfficeAction =
  | { type: 'desk_visit'; visitor: string; host: string; message?: string }
  | { type: 'desk_visit_tour'; visitor: string; hosts: string[]; message?: string }
  | { type: 'set_state'; profile: string; state: 'working' | 'online' | 'offline' | 'thinking'; task?: string }
  | { type: 'broadcast'; message: string }
  | { type: 'celebrate'; target: string }

export interface OfficeActionStats {
  queued: number
  accepted: number
  dropped: number
  max_queued: number
}

/** 入队一个或多个场景动作（外部系统/看板事件驱动）。 */
export async function enqueueOfficeAction(action: OfficeAction | OfficeAction[]): Promise<{ accepted: number; queued: number }> {
  const body = Array.isArray(action) ? { actions: action } : action
  return request<{ accepted: number; queued: number }>('/api/hermes/office/action', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 取走全部排队动作（Office 面板短轮询）。 */
export async function drainOfficeActions(): Promise<OfficeAction[]> {
  const res = await request<{ actions: OfficeAction[] }>('/api/hermes/office/actions')
  return res.actions
}

/** 队列统计。 */
export async function fetchOfficeActionStats(): Promise<OfficeActionStats> {
  return request<OfficeActionStats>('/api/hermes/office/actions/stats')
}

/** 按指定 profile 读取记忆（soul / memory / user），供 Office agent 弹窗使用。 */
export async function fetchMemoryForProfile(profile: string): Promise<MemoryData> {
  return request<MemoryData>('/api/hermes/memory', { headers: { 'X-Hermes-Profile': profile } })
}
