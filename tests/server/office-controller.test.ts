import { afterEach, describe, expect, it } from 'vitest'
import { actionStats, drainActions, enqueueAction } from '../../packages/server/src/modules/hermes/controllers/office'
import { reset } from '../../packages/server/src/modules/studio/services/office-actions'

function makeCtx(body?: unknown): any {
  return { request: { body }, status: 200, body: undefined as unknown }
}

afterEach(() => {
  reset()
})

describe('office controller', () => {
  it('POST /api/hermes/office/action enqueues and GET drains the same actions', async () => {
    const enqueue = makeCtx({ type: 'broadcast', message: 'hello' })
    await enqueueAction(enqueue)
    expect(enqueue.status).toBe(202)
    expect(enqueue.body).toEqual({ accepted: 1, queued: 1 })

    const drain = makeCtx()
    await drainActions(drain)
    expect(drain.body).toEqual({ actions: [{ type: 'broadcast', message: 'hello' }] })
  })

  it('supports the batch envelope and a list payload', async () => {
    const batch = makeCtx({ actions: [{ type: 'celebrate', target: 'alpha' }, { type: 'broadcast', message: 'hi' }] })
    await enqueueAction(batch)
    expect(batch.body).toEqual({ accepted: 2, queued: 2 })

    const list = makeCtx([{ type: 'desk_visit', visitor: 'a', host: 'b' }])
    await enqueueAction(list)
    expect(list.body).toEqual({ accepted: 1, queued: 3 })

    const drain = makeCtx()
    await drainActions(drain)
    expect(drain.body.actions).toHaveLength(3)
  })

  it('drops invalid actions and reports stats', async () => {
    await enqueueAction(makeCtx({ type: 'explode' }))
    await enqueueAction(makeCtx({ type: 'set_state', profile: 'p', state: 'flying' }))

    const statsCtx = makeCtx()
    await actionStats(statsCtx)
    expect(statsCtx.body).toMatchObject({ accepted: 0, queued: 0, dropped: 0 })
  })
})
