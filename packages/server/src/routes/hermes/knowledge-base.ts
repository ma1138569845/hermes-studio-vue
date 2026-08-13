import Router from '@koa/router'
import type { Context } from 'koa'
import { forwardKnowledge } from '../../services/hermes/knowledge-proxy'

export const knowledgeBaseRoutes = new Router()

// Every knowledge-base endpoint delegates to the upstream Hermes web_server
// (RAG engine) via a transparent pass-through proxy.
const proxy = (ctx: Context) => forwardKnowledge(ctx)

// Knowledge Base CRUD
knowledgeBaseRoutes.get('/api/knowledge/bases', proxy)
knowledgeBaseRoutes.post('/api/knowledge/bases', proxy)
knowledgeBaseRoutes.get('/api/knowledge/bases/:kbId', proxy)
knowledgeBaseRoutes.delete('/api/knowledge/bases/:kbId', proxy)

// Folders
knowledgeBaseRoutes.get('/api/knowledge/bases/:kbId/folders', proxy)
knowledgeBaseRoutes.post('/api/knowledge/bases/:kbId/folders', proxy)
knowledgeBaseRoutes.delete('/api/knowledge/bases/:kbId/folders/:folderId', proxy)

// Documents
knowledgeBaseRoutes.get('/api/knowledge/bases/:kbId/docs', proxy)
knowledgeBaseRoutes.post('/api/knowledge/bases/:kbId/docs/upload', proxy)
knowledgeBaseRoutes.get('/api/knowledge/docs/:docId', proxy)
knowledgeBaseRoutes.get('/api/knowledge/docs/:docId/chunks', proxy)
knowledgeBaseRoutes.delete('/api/knowledge/bases/:kbId/docs/:docId', proxy)

// Search
knowledgeBaseRoutes.post('/api/knowledge/bases/:kbId/search', proxy)

// Wiki
knowledgeBaseRoutes.get('/api/knowledge/bases/:kbId/wiki', proxy)
knowledgeBaseRoutes.get('/api/knowledge/wiki/:wikiId', proxy)

// Knowledge Graph
knowledgeBaseRoutes.get('/api/knowledge/bases/:kbId/entities', proxy)
knowledgeBaseRoutes.get('/api/knowledge/bases/:kbId/relationships', proxy)

// Stats
knowledgeBaseRoutes.get('/api/knowledge/bases/:kbId/stats', proxy)
