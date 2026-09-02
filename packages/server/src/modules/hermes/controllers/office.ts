import type { Context } from 'koa'
import * as officeActions from '../../studio/services/office-actions'

/** GET /api/hermes/office/actions — 取走全部排队动作（Office 面板短轮询）。 */
export async function drainActions(ctx: Context): Promise<void> {
  ctx.body = { actions: officeActions.drain() }
}

/** GET /api/hermes/office/actions/stats — 队列统计。 */
export async function actionStats(ctx: Context): Promise<void> {
  ctx.body = officeActions.stats()
}

/** POST /api/hermes/office/action — 外部系统入队动作。 */
export async function enqueueAction(ctx: Context): Promise<void> {
  const actions = officeActions.normalizePayload(ctx.request.body)
  ctx.status = 202
  ctx.body = officeActions.enqueue(actions)
}
