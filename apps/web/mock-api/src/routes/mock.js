// Mock-only endpoints (not part of the real API). No auth.
import { Router } from 'express';
import { db } from '../store.js';
import { send } from '../http.js';
import { seed } from '../seed.js';
import { today } from '../dates.js';

const router = Router();

/** Wipe everything and re-seed. Existing tokens stay valid (seeded ids are deterministic). */
router.post('/__mock/reset', (req, res) => {
  const counts = seed();
  send(res, { ok: true, today: today(), counts });
});

/** Captured "sent" emails (password resets, quotations, invoices), newest first. ?to=&type= filters. */
router.get('/__mock/emails', (req, res) => {
  const to = typeof req.query.to === 'string' ? req.query.to.toLowerCase() : null;
  const type = typeof req.query.type === 'string' ? req.query.type : null;
  const items = [...db.emails]
    .reverse()
    .filter((e) => (!to || e.to.email === to) && (!type || e.type === type));
  send(res, items);
});

export default router;
