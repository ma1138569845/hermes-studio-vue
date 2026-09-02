import type { Context } from 'koa'
import { Readable } from 'stream'
import { config } from '../public/config'
import { logger } from '../public/logging'

/**
 * Transparent forwarder for the knowledge-base HTTP API.
 *
 * The hermes-studio-vue BFF no longer reimplements knowledge-base storage; it
 * delegates `/api/knowledge/*` to the upstream Hermes web_server (FastAPI),
 * which owns the real RAG engine. Requests are forwarded method/path/query/body
 * verbatim, authenticating against the upstream's session-token gate
 * (`X-Hermes-Session-Token`) rather than the BFF's own JWT.
 */

const MULTIPART_RE = /^multipart\/form-data/i

function readStreamBuffer(stream: Readable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

async function readBody(ctx: Context): Promise<Uint8Array | undefined> {
  if (ctx.method === 'GET' || ctx.method === 'HEAD') return undefined

  const contentType = ctx.get('content-type') || ''
  if (MULTIPART_RE.test(contentType)) {
    // @koa/bodyparser is not configured for multipart, so the raw request
    // stream is still unread. Consume it directly to forward verbatim.
    return readStreamBuffer(ctx.req)
  }

  const body = ctx.request.body
  if (body === undefined || body === null) return undefined
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return Buffer.from(text)
}

function buildHeaders(ctx: Context): Record<string, string> {
  const headers: Record<string, string> = {}
  const contentType = ctx.get('content-type')
  const accept = ctx.get('accept')
  if (contentType) headers['content-type'] = contentType
  if (accept) headers['accept'] = accept
  if (config.knowledgeToken) headers['x-hermes-session-token'] = config.knowledgeToken
  return headers
}

export async function forwardKnowledge(ctx: Context): Promise<void> {
  const target = `${config.knowledgeUpstream}${ctx.path}${ctx.querystring ? `?${ctx.querystring}` : ''}`

  let body: Uint8Array | undefined
  try {
    body = await readBody(ctx)
  } catch (err) {
    logger.warn(err, '[knowledge-proxy] failed to read request body for %s %s', ctx.method, ctx.path)
    ctx.status = 400
    ctx.body = { error: 'Failed to read request body' }
    return
  }

  let res: Response
  try {
    res = await fetch(target, {
      method: ctx.method,
      headers: buildHeaders(ctx),
      // `Uint8Array<ArrayBufferLike>` does not satisfy the DOM `BodyInit` type
      // under TS 5.7's generic TypedArrays; Node's fetch accepts it at runtime.
      body: body ? (body as unknown as BodyInit) : undefined,
    })
  } catch (err) {
    logger.warn(err, '[knowledge-proxy] upstream request failed for %s %s', ctx.method, ctx.path)
    ctx.status = 502
    ctx.body = { error: 'Knowledge base upstream unreachable' }
    return
  }

  ctx.status = res.status
  const upstreamType = res.headers.get('content-type')
  if (upstreamType) ctx.set('content-type', upstreamType)

  const resBody = Buffer.from(await res.arrayBuffer())
  if (resBody.length === 0) {
    ctx.body = res.status === 204 ? undefined : ''
    return
  }
  ctx.body = resBody
}
