import { describe, expect, it } from 'vitest'
import {
  avatarInitial,
  businessAvatarColors,
  businessAvatarDataUrl,
  businessAvatarSvg,
  isLegacyCartoonAvatarDataUrl,
} from '../../packages/client/src/utils/business-avatar'

describe('business avatar utilities', () => {
  it('extracts an uppercased ASCII initial', () => {
    expect(avatarInitial('alice')).toBe('A')
    expect(avatarInitial('Alice')).toBe('A')
    expect(avatarInitial('  bob  ')).toBe('B')
    expect(avatarInitial('')).toBe('?')
    expect(avatarInitial('   ')).toBe('?')
  })

  it('keeps CJK characters as-is', () => {
    expect(avatarInitial('张伟')).toBe('张')
  })

  it('picks a stable color pair for a seed', () => {
    expect(businessAvatarColors('alice')).toEqual(businessAvatarColors('alice'))
    const [from, to] = businessAvatarColors('alice')
    expect(from).toMatch(/^#[0-9a-f]{6}$/)
    expect(to).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('renders a round business SVG with the initial and gradient', () => {
    const svg = businessAvatarSvg('alice')
    expect(svg).toContain('<svg')
    expect(svg).toContain('circle')
    expect(svg).toContain('linearGradient')
    expect(svg).toContain('>A</text>')
    expect(svg).toContain('viewBox="0 0 64 64"')
  })

  it('uses the seed color deterministically but keeps the name initial', () => {
    const svgA = businessAvatarSvg('alice', 'seed-1')
    const svgB = businessAvatarSvg('alice', 'seed-1')
    const svgC = businessAvatarSvg('alice', 'seed-2')
    expect(svgA).toBe(svgB)
    expect(svgA).toContain('>A</text>')
    // different seeds should pick different palettes at least sometimes
    expect(svgA === svgC).toBe(false)
  })

  it('escapes special characters in the initial', () => {
    const svg = businessAvatarSvg('&name')
    expect(svg).toContain('&amp;')
    expect(svg).not.toContain('>&name</text>')
  })

  it('falls back to the name as the color seed when no seed is given', () => {
    expect(businessAvatarSvg('bob')).toContain('>B</text>')
    expect(businessAvatarSvg('bob')).toBe(businessAvatarSvg('bob'))
  })

  it('detects legacy multiavatar cartoon SVG data URLs', () => {
    // A stored multiavatar SVG (path-based, no business gradient)
    const legacySvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 231 231"><path d="M33.83,33.83"/></svg>'
    const legacyDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(legacySvg)))
    expect(isLegacyCartoonAvatarDataUrl(legacyDataUrl)).toBe(true)
  })

  it('keeps business avatars and raster images as-is', () => {
    expect(isLegacyCartoonAvatarDataUrl(businessAvatarDataUrl('alice', 's'))).toBe(false)
    expect(isLegacyCartoonAvatarDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(false)
    expect(isLegacyCartoonAvatarDataUrl('')).toBe(false)
    expect(isLegacyCartoonAvatarDataUrl('data:image/svg+xml;utf8,<svg/>')).toBe(false)
  })
})
