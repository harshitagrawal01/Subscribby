// Subscribby mock API: an in-memory stand-in for the Subscribby API.
import express from 'express';
import { config } from './config.js';
import { today } from './dates.js';
import { seed } from './seed.js';
import { errorHandler, notFoundHandler } from './http.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import settingsRoutes from './routes/settings.js';
import userRoutes from './routes/users.js';
import customerRoutes from './routes/customers.js';
import subscriptionRoutes from './routes/subscriptions.js';
import invoiceRoutes from './routes/invoices.js';
import reportRoutes from './routes/reports.js';
import portalRoutes from './routes/portal.js';
import mockRoutes from './routes/mock.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);

  // CORS: any origin (the real API restricts this to CORS_ORIGINS).
  app.use((req, res, next) => {
    res.set({
      'Access-Control-Allow-Origin': req.get('origin') || '*',
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': req.get('access-control-request-headers') || 'Authorization, Content-Type',
      'Access-Control-Expose-Headers': 'Content-Disposition',
      'Access-Control-Max-Age': '600',
    });
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  // Optional artificial latency, to see loading states.
  if (config.delayMs > 0) app.use((req, res, next) => setTimeout(next, config.delayMs));

  app.use(express.json({ limit: '1mb' }));

  const api = express.Router();
  for (const r of [
    authRoutes,
    catalogRoutes,
    settingsRoutes,
    userRoutes,
    customerRoutes,
    subscriptionRoutes,
    invoiceRoutes,
    reportRoutes,
    portalRoutes,
    mockRoutes,
  ]) {
    api.use(r);
  }
  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const counts = seed();
createApp().listen(config.port, () => {
  console.log(`Subscribby mock API listening on http://localhost:${config.port}/api/v1`);
  console.log(
    `  today (IST): ${today()}${config.mockToday ? ' (MOCK_TODAY)' : ''} · seeded ${counts.customers} customers, ` +
      `${counts.subscriptions} subscriptions, ${counts.invoices} invoices, ${counts.payments} payments`,
  );
  console.log(
    `  delay: ${config.delayMs} ms · CUSTOMER_SELF_SERVICE=${config.customerSelfService} · WEB_URL=${config.webUrl}`,
  );
  console.log('  mock-only: POST /api/v1/__mock/reset · GET /api/v1/__mock/emails');
});
