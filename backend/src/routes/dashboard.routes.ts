import { Router } from 'express';

import { showDashboardSummary } from '../controllers/dashboard.controller.js';

export const dashboardRouter = Router();
dashboardRouter.get('/summary', showDashboardSummary);
