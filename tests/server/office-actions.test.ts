import { afterEach, describe, expect, it } from 'vitest'
import * as officeActions from '../../packages/server/src/modules/studio/services/office-actions'

afterEach(() => {
  // 队列是进程级状态，每个用例前清空并归零统计，保证隔离。
  officeActions.reset()
})

describe('officeActions.normalizePayload', () => {
  it('accepts a single action object and a batch envelope', () => {
    const single = officeActions.normalizePayload({ type: 'broadcast', message: 'hi' })
    expect(single).toEqual([{ type: 'broadcast', message: 'hi' }])

    const batch = officeActions.normalizePayload({
      actions: [
        { type: 'celebrate', target: 'alpha' },
        { type: 'broadcast', message: 'yo' },
      ],
    })
    expect(batch).toHaveLength(2)

    const list = officeActions.normalizePayload([{ type: 'broadcast', message: 'a' }])
    expect(list).toHaveLength(1)
  })

  it('drops invalid or unknown actions', () => {
    expect(officeActions.normalizePayload({ type: 'explode' })).toEqual([])
    expect(officeActions.normalizePayload(null)).toEqual([])
    expect(officeActions.normalizePayload(42)).toEqual([])
    expect(officeActions.normalizePayload({ type: 'broadcast', message: '' })).toEqual([])
    expect(officeActions.normalizePayload({ type: 'desk_visit', visitor: 'a', host: 'a' })).toEqual([])
    expect(officeActions.normalizePayload({ type: 'set_state', profile: 'p', state: 'flying' })).toEqual([])
  })

  it('trims names and truncates long messages', () => {
    const [visit] = officeActions.normalizePayload({
      type: 'desk_visit',
      visitor: '  alpha  ',
      host: 'beta',
      message: 'x'.repeat(600),
    })
    expect(visit).toEqual({ type: 'desk_visit', visitor: 'alpha', host: 'beta', message: 'x'.repeat(500) })
  })

  it('deduplicates tour hosts and removes the visitor itself', () => {
    const [tour] = officeActions.normalizePayload({
      type: 'desk_visit_tour',
      visitor: 'alpha',
      hosts: ['beta', 'beta', 'alpha', 'gamma'],
    })
    expect(tour).toEqual({ type: 'desk_visit_tour', visitor: 'alpha', hosts: ['beta', 'gamma'], message: undefined })
  })
})

describe('officeActions queue', () => {
  it('drain returns queued actions and clears the queue', () => {
    const actions = [
      { type: 'broadcast', message: 'one' },
      { type: 'broadcast', message: 'two' },
    ]
    officeActions.enqueue(officeActions.normalizePayload(actions))
    expect(officeActions.drain()).toEqual(actions)
    expect(officeActions.drain()).toEqual([])
  })

  it('drops oldest action past the queue cap', () => {
    for (let i = 0; i < 105; i += 1) {
      officeActions.enqueue(officeActions.normalizePayload({ type: 'broadcast', message: `m${i}` }))
    }
    const stats = officeActions.stats()
    expect(stats.queued).toBe(100)
    expect(stats.accepted).toBe(105)
    expect(stats.dropped).toBe(5)
    const drained = officeActions.drain()
    expect(drained[0]).toEqual({ type: 'broadcast', message: 'm5' })
  })

  it('reports cumulative stats across operations', () => {
    officeActions.enqueue([{ type: 'celebrate', target: 'alpha' }])
    officeActions.enqueue(officeActions.normalizePayload({ type: 'set_state', profile: 'beta', state: 'working' }))
    officeActions.drain()
    expect(officeActions.stats()).toMatchObject({ queued: 0, accepted: 2, dropped: 0 })
  })
})
