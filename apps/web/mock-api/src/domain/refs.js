// Small embedded summaries ("customer: { id, name }") used across responses.
import { byId } from '../store.js';

export function userRef(id) {
  const u = byId('users', id);
  return u ? { id: u.id, name: u.name } : null;
}

export function actorRef(by) {
  if (by === 'system') return { id: 'system', name: 'System' };
  return userRef(by) ?? { id: by, name: 'Unknown user' };
}

export function customerRef(id) {
  const c = byId('customers', id);
  return c ? { id: c.id, name: c.name } : null;
}

export function subscriptionRef(id) {
  const s = byId('subscriptions', id);
  return s ? { id: s.id, number: s.number } : null;
}

export function invoiceRef(id) {
  const i = byId('invoices', id);
  return i ? { id: i.id, number: i.number } : null;
}

export const variantLabel = (v) => (v ? `${v.attribute}: ${v.value}` : null);
