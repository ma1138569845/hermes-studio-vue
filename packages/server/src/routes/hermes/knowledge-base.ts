import Router from '@koa/router'
import type { Context } from 'koa'
import { forwardKnowledge } from '../../services/hermes/knowledge-proxy'

export const knowledgeBaseRoutes = new Router()

// Every knowledge-base endpoint delegates to the upstream RAG FastAPI via a
// transparent pass-through proxy. Methods must be listed: @koa/router 15
// (path-to-regexp v8) does not treat `(.*)` as a wildcard.
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
knowledgeBaseRoutes.get('/api/knowledge/docs/:docId/preview', proxy)
knowledgeBaseRoutes.delete('/api/knowledge/bases/:kbId/docs/:docId', proxy)

// Document pipeline
knowledgeBaseRoutes.post('/api/knowledge/docs/:docId/vectorize', proxy)
knowledgeBaseRoutes.post('/api/knowledge/docs/:docId/reparse', proxy)
knowledgeBaseRoutes.post('/api/knowledge/docs/:docId/summary', proxy)
knowledgeBaseRoutes.post('/api/knowledge/docs/:docId/graph', proxy)
knowledgeBaseRoutes.post('/api/knowledge/docs/:docId/wiki', proxy)

// Search
knowledgeBaseRoutes.post('/api/knowledge/bases/:kbId/search', proxy)

// Wiki
knowledgeBaseRoutes.get('/api/knowledge/bases/:kbId/wiki', proxy)
knowledgeBaseRoutes.get('/api/knowledge/wiki/:wikiId', proxy)
knowledgeBaseRoutes.patch('/api/knowledge/wiki/:wikiId/review', proxy)
knowledgeBaseRoutes.post('/api/knowledge/wiki/:wikiId/evaluate-quality', proxy)
knowledgeBaseRoutes.patch('/api/knowledge/wiki/:wikiId/evaluate-quality', proxy)

// Folder / KB generation jobs
knowledgeBaseRoutes.post('/api/knowledge/bases/:kbId/folders/:folderId/wiki', proxy)
knowledgeBaseRoutes.post('/api/knowledge/bases/:kbId/hierarchical-wiki', proxy)
knowledgeBaseRoutes.post('/api/knowledge/bases/:kbId/folders/:folderId/hierarchical-wiki', proxy)
knowledgeBaseRoutes.post('/api/knowledge/bases/:kbId/curate', proxy)
knowledgeBaseRoutes.post('/api/knowledge/bases/:kbId/folders/:folderId/curate', proxy)
knowledgeBaseRoutes.post('/api/knowledge/bases/:kbId/bulk-wiki', proxy)
knowledgeBaseRoutes.post('/api/knowledge/bases/:kbId/folders/:folderId/bulk-wiki', proxy)
knowledgeBaseRoutes.post('/api/knowledge/bases/:kbId/rebuild', proxy)
knowledgeBaseRoutes.post('/api/knowledge/bases/:kbId/bulk-delete', proxy)

// Jobs
knowledgeBaseRoutes.get('/api/knowledge/jobs/:jobId', proxy)
knowledgeBaseRoutes.get('/api/knowledge/bases/:kbId/vectorization-jobs', proxy)
knowledgeBaseRoutes.get('/api/knowledge/bases/:kbId/curation-jobs', proxy)
knowledgeBaseRoutes.get('/api/knowledge/bases/:kbId/curation-jobs/:jobId', proxy)

// Knowledge Graph
knowledgeBaseRoutes.get('/api/knowledge/bases/:kbId/entities', proxy)
knowledgeBaseRoutes.get('/api/knowledge/bases/:kbId/relationships', proxy)

// Chunks
knowledgeBaseRoutes.put('/api/knowledge/chunks/:chunkId', proxy)
knowledgeBaseRoutes.patch('/api/knowledge/chunks/:chunkId', proxy)
knowledgeBaseRoutes.delete('/api/knowledge/chunks/:chunkId', proxy)

// Stats
knowledgeBaseRoutes.get('/api/knowledge/bases/:kbId/stats', proxy)
