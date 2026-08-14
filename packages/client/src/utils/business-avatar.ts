/**
 * Business-style avatar generation.
 *
 * Renders a deterministic "initial on a solid business color" round avatar as
 * inline SVG. Used as the fallback for users / profiles / agents that do not
 * carry a custom image, replacing the previous cartoon multiavatar faces.
 */

// Restrained corporate palette — muted blues, greens, slate and oxblood.
// Each entry is [start, end] for a subtle vertical gradient.
const BUSINESS_COLORS: Array<[string, string]> = [
  ['#2b4c7e', '#1d3252'], // deep corporate blue
  ['#3b6c9e', '#24466b'], // steel blue
  ['#2e6b5e', '#1d4a41'], // pine green
  ['#5b6d85', '#3c4a5e'], // slate
  ['#6b4f7f', '#4a3657'], // muted violet
  ['#8a5a44', '#5f3d2e'], // oxblood brown
  ['#4d6a8a', '#33485f'], // dusty blue
  ['#7a4e63', '#553345'], // muted berry
]

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/** Extract the first display character, uppercased (keeps CJK as-is). */
export function avatarInitial(name: string): string {
  const trimmed = String(name || '').trim()
  if (!trimmed) return '?'
  const first = Array.from(trimmed)[0]
  return /[a-zA-Z]/.test(first) ? first.toUpperCase() : first
}

/** Pick a stable gradient pair for the given name/seed. */
export function businessAvatarColors(seed: string): [string, string] {
  return BUSINESS_COLORS[hashString(seed) % BUSINESS_COLORS.length]
}

/**
 * Build the SVG markup for a business avatar.
 *
 * @param name  Display name — drives the initial.
 * @param seed  Determinism seed — drives the color. Falls back to the name.
 */
export function businessAvatarSvg(name: string, seed?: string): string {
  const initial = avatarInitial(name)
  const [from, to] = businessAvatarColors(seed || name)
  const safeInitial = initial
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">' +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
    `</linearGradient></defs>` +
    `<circle cx="32" cy="32" r="32" fill="url(#bg)"/>` +
    `<text x="32" y="32" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif" ` +
    `font-size="28" font-weight="600" fill="#ffffff">${safeInitial}</text>` +
    '</svg>'
  )

}

/** Convert SVG markup to a base64 data URL for storage/display. */
export function businessAvatarDataUrl(name: string, seed?: string): string {
  const svg = businessAvatarSvg(name, seed)
  if (typeof btoa !== 'undefined') {
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/**
 * Detect legacy cartoon avatars persisted by the old multiavatar generator.
 *
 * Those were stored as base64 SVG data URLs without the business gradient
 * marker. User-uploaded PNG/JPEG/WebP images and the new business avatars
 * both fail this check, so they keep rendering as-is.
 */
export function isLegacyCartoonAvatarDataUrl(dataUrl: string): boolean {
  if (!dataUrl || !dataUrl.startsWith('data:image/svg+xml')) return false
  // Base64-decode lazily; non-SVG images are rejected above.
  try {
    const base64 = dataUrl.split(',')[1] || ''
    const svg = typeof atob !== 'undefined'
      ? decodeURIComponent(escape(atob(base64)))
      : Buffer.from(base64, 'base64').toString('utf-8')
    return svg.includes('linearGradient') === false
  } catch {
    return false
  }
}
