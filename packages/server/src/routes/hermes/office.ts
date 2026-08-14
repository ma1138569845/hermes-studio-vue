import Router from '@koa/router'
import * as ctrl from '../../controllers/hermes/office'

export const officeRoutes = new Router()

// Office 面板轮询场景动作；外部系统经 POST 入队。
officeRoutes.get('/api/hermes/office/actions', ctrl.drainActions)
officeRoutes.get('/api/hermes/office/actions/stats', ctrl.actionStats)
officeRoutes.post('/api/hermes/office/action', ctrl.enqueueAction)
