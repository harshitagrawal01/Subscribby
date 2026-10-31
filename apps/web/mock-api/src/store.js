// In-memory "database". Everything is lost on restart and re-seeded (see seed.js).
import { nowIso } from './dates.js';

export const COLLECTIONS = [
  'users',
  'customers',
  'products',
  'plans',
  'templates',
  'taxes',
  'discounts',
  'subscriptions',
  'invoices',
  'payments',
  'billingRuns',
  'emails',
];

export const db = { counters: {} };
let idCounter = 0;

export function resetStore() {
  for (const c of COLLECTIONS) db[c] = [];
  db.counters = {};
  idCounter = 0;
}
resetStore();

/** 24-char hex id, deterministic (so seeded ids are the same on every start). */
export function newId() {
  idCounter += 1;
  return '6721f0c2' + idCounter.toString(16).padStart(16, '0');
}

/** "SUB/2026/0042" style numbers, sequential per prefix and year, never reused. */
export function nextNumber(prefix, year) {
  const key = `${prefix}-${year}`;
  db.counters[key] = (db.counters[key] || 0) + 1;
  return `${prefix}/${year}/${String(db.counters[key]).padStart(4, '0')}`;
}

export function byId(collection, id) {
  if (typeof id !== 'string') return null;
  return db[collection].find((r) => r.id === id) || null;
}

/** Add id + timestamps and store. */
export function insert(collection, record, at) {
  const ts = at || nowIso();
  const r = { id: newId(), ...record, createdAt: record.createdAt || ts, updatedAt: record.updatedAt || ts };
  db[collection].push(r);
  return r;
}

export function touch(record) {
  record.updatedAt = nowIso();
  return record;
}

/** Deep copy of some collections, used to make billing dry runs write nothing. */
export function snapshot(keys) {
  return { data: structuredClone(Object.fromEntries(keys.map((k) => [k, db[k]]))), idCounter };
}
export function restore(snap) {
  Object.assign(db, snap.data);
  idCounter = snap.idCounter;
}
