// Section 7 (part 1): taxes and discounts.
import { Router } from 'express';
import { db, byId, insert } from '../store.js';
import { errors, send, load, Validator, sendList, queryBool, queryEnum, queryString, matchesSearch } from '../http.js';
import { nowIso, today } from '../dates.js';
import { allow } from '../auth.js';

const router = Router();
const READ = allow('admin', 'staff', 'finance');
const ADMIN = allow('admin');
const PRODUCT_TYPES = ['service', 'addon', 'physical'];

function checkProductIds(v, field, ids) {
  if (!Array.isArray(ids)) return v.error(field, 'Must be a list of product ids');
  ids.forEach((id, i) => {
    if (!byId('products', id)) v.error(`${field}[${i}]`, 'Product not found');
  });
}

// ================================================================ taxes

export function serializeTax(t) {
  return {
    id: t.id,
    name: t.name,
    type: t.type,
    rate: t.rate,
    appliesTo: { kind: t.appliesTo.kind, productTypes: [...t.appliesTo.productTypes], productIds: [...t.appliesTo.productIds] },
    isActive: t.isActive,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function readTax(body, partial, current) {
  const v = new Validator(body, { partial });
  v.str('name', { required: true, min: 1, max: 80 });
  const type = v.oneOf('type', ['percentage', 'fixed'], { required: true }) ?? current?.type;
  if (v.has('rate')) {
    if (type === 'fixed') v.int('rate', { min: 0, money: true });
    else v.num('rate', { min: 0, max: 100, decimals: 2 });
  } else if (!partial) v.error('rate', 'Required');
  v.bool('isActive');
  const a = v.object('appliesTo', { required: true });
  if (a) {
    if (!['all', 'productTypes', 'products'].includes(a.kind)) v.error('appliesTo.kind', 'Must be one of: all, productTypes, products');
    if (a.kind === 'productTypes') {
      if (!Array.isArray(a.productTypes) || !a.productTypes.length || a.productTypes.some((t) => !PRODUCT_TYPES.includes(t))) {
        v.error('appliesTo.productTypes', `Must list one or more of: ${PRODUCT_TYPES.join(', ')}`);
      }
    }
    if (a.kind === 'products') checkProductIds(v, 'appliesTo.productIds', a.productIds);
  }
  const out = v.done();
  if (out.appliesTo) {
    out.appliesTo = {
      kind: a.kind,
      productTypes: a.kind === 'productTypes' ? [...a.productTypes] : [],
      productIds: a.kind === 'products' ? [...a.productIds] : [],
    };
  }
  return out;
}

router.get('/taxes', READ, (req, res) => {
  const isActive = queryBool(req.query, 'isActive');
  const items = db.taxes.filter((t) => isActive === undefined || t.isActive === isActive).map(serializeTax);
  sendList(res, items, req.query, { defaultSort: 'name' });
});

router.post('/taxes', ADMIN, (req, res) => {
  const b = readTax(req.body, false);
  const t = insert('taxes', { name: b.name, type: b.type, rate: b.rate, appliesTo: b.appliesTo, isActive: b.isActive ?? true });
  send(res, serializeTax(t), 201);
});

router.patch('/taxes/:id', ADMIN, (req, res) => {
  const t = load('taxes', req.params.id, 'Tax');
  const b = readTax(req.body, true, t);
  if (b.type && b.type !== t.type && b.rate === undefined) {
    throw errors.validation([{ field: 'rate', message: 'Send a rate when changing the type' }]);
  }
  for (const k of ['name', 'type', 'rate', 'appliesTo', 'isActive']) if (b[k] !== undefined) t[k] = b[k];
  t.updatedAt = nowIso();
  send(res, serializeTax(t));
});

router.delete('/taxes/:id', ADMIN, (req, res) => {
  const t = load('taxes', req.params.id, 'Tax');
  t.isActive = false;
  t.updatedAt = nowIso();
  res.status(204).end();
});

// ================================================================ discounts

export const DISCOUNT_STATES = ['inactive', 'scheduled', 'running', 'expired', 'exhausted'];

export function discountState(d, on = today()) {
  if (!d.isActive) return 'inactive';
  if (on > d.endDate) return 'expired';
  if (on < d.startDate) return 'scheduled';
  if (d.usageLimit != null && d.usedCount >= d.usageLimit) return 'exhausted';
  return 'running';
}

export function serializeDiscount(d) {
  return {
    id: d.id,
    name: d.name,
    type: d.type,
    value: d.value,
    minPurchaseAmount: d.minPurchaseAmount,
    minQuantity: d.minQuantity,
    startDate: d.startDate,
    endDate: d.endDate,
    usageLimit: d.usageLimit,
    usedCount: d.usedCount,
    remainingUses: d.usageLimit == null ? null : Math.max(0, d.usageLimit - d.usedCount),
    state: discountState(d),
    appliesTo: { kind: d.appliesTo.kind, productIds: [...d.appliesTo.productIds] },
    isActive: d.isActive,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function readDiscount(body, partial, current) {
  const v = new Validator(body, { partial });
  v.str('name', { required: true, min: 1, max: 80 });
  const type = v.oneOf('type', ['percentage', 'fixed'], { required: true }) ?? current?.type;
  if (v.has('value')) {
    if (type === 'fixed') v.int('value', { min: 1, money: true });
    else v.num('value', { min: 0, max: 100, decimals: 2 });
  } else if (!partial) v.error('value', 'Required');
  v.int('minPurchaseAmount', { min: 0, nullable: true, money: true });
  v.int('minQuantity', { min: 1, nullable: true });
  v.date('startDate', { required: true });
  v.date('endDate', { required: true });
  v.int('usageLimit', { min: 1, nullable: true });
  v.bool('isActive');
  const a = v.object('appliesTo', { required: true });
  if (a) {
    if (!['products', 'subscription'].includes(a.kind)) v.error('appliesTo.kind', 'Must be one of: products, subscription');
    if (a.kind === 'products') {
      checkProductIds(v, 'appliesTo.productIds', a.productIds);
      if (Array.isArray(a.productIds) && !a.productIds.length) v.error('appliesTo.productIds', 'Pick at least one product');
    }
  }
  // usedCount changes only through invoices; it is ignored here.
  const out = v.done();
  const start = out.startDate ?? current?.startDate;
  const end = out.endDate ?? current?.endDate;
  if (start && end && end < start) throw errors.validation([{ field: 'endDate', message: 'Must be on or after the start date' }]);
  if (current && out.usageLimit != null && out.usageLimit < current.usedCount) {
    throw errors.validation([{ field: 'usageLimit', message: `Can't be below the ${current.usedCount} uses already made` }]);
  }
  if (out.appliesTo) out.appliesTo = { kind: a.kind, productIds: a.kind === 'products' ? [...a.productIds] : [] };
  return out;
}

router.get('/discounts', READ, (req, res) => {
  const state = queryEnum(req.query, 'state', DISCOUNT_STATES);
  const search = queryString(req.query, 'search');
  const items = db.discounts
    .filter((d) => matchesSearch(search, d.name) && (!state || discountState(d) === state))
    .map(serializeDiscount);
  sendList(res, items, req.query, { defaultSort: '-createdAt' });
});

router.post('/discounts', ADMIN, (req, res) => {
  const b = readDiscount(req.body, false);
  const d = insert('discounts', {
    name: b.name,
    type: b.type,
    value: b.value,
    minPurchaseAmount: b.minPurchaseAmount ?? null,
    minQuantity: b.minQuantity ?? null,
    startDate: b.startDate,
    endDate: b.endDate,
    usageLimit: b.usageLimit ?? null,
    usedCount: 0,
    appliesTo: b.appliesTo,
    isActive: b.isActive ?? true,
  });
  send(res, serializeDiscount(d), 201);
});

router.get('/discounts/:id', READ, (req, res) => send(res, serializeDiscount(load('discounts', req.params.id, 'Discount'))));

router.patch('/discounts/:id', ADMIN, (req, res) => {
  const d = load('discounts', req.params.id, 'Discount');
  const b = readDiscount(req.body, true, d);
  if (b.type && b.type !== d.type && b.value === undefined) {
    throw errors.validation([{ field: 'value', message: 'Send a value when changing the type' }]);
  }
  for (const k of ['name', 'type', 'value', 'minPurchaseAmount', 'minQuantity', 'startDate', 'endDate', 'usageLimit', 'appliesTo', 'isActive']) {
    if (b[k] !== undefined) d[k] = b[k];
  }
  d.updatedAt = nowIso();
  send(res, serializeDiscount(d));
});

router.post('/discounts/:id/stop', ADMIN, (req, res) => {
  const d = load('discounts', req.params.id, 'Discount');
  d.isActive = false;
  d.updatedAt = nowIso();
  send(res, serializeDiscount(d));
});

export default router;
