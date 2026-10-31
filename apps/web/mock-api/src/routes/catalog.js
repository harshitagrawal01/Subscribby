// Section 6: products, plans, quotation templates.
import { Router } from 'express';
import { db, byId, insert, newId } from '../store.js';
import { errors, send, load, Validator, sendList, queryBool, queryString, queryEnum, queryDate, matchesSearch } from '../http.js';
import { nowIso, today } from '../dates.js';
import { allow } from '../auth.js';
import { variantLabel } from '../domain/refs.js';
import { defaultUnitPrice, planAvailableOn } from '../domain/subscriptions.js';

const router = Router();
const READ = allow('admin', 'staff', 'finance');
const ADMIN = allow('admin');
const PRODUCT_TYPES = ['service', 'addon', 'physical'];
const PERIODS = ['daily', 'weekly', 'monthly', 'yearly'];
const OPEN_STATUSES = ['draft', 'quotation', 'confirmed', 'active', 'paused'];

// ================================================================ products

export function serializeProduct(p) {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    salesPrice: p.salesPrice,
    costPrice: p.costPrice,
    notes: p.notes,
    variants: p.variants.map((v) => ({ ...v })),
    usedInPlans: db.plans.filter((pl) => pl.productId === p.id && pl.isActive).length,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function readProduct(body, partial) {
  const v = new Validator(body, { partial });
  v.str('name', { required: true, min: 1, max: 120 });
  v.oneOf('type', PRODUCT_TYPES, { required: true });
  v.int('salesPrice', { required: true, min: 0, money: true });
  v.int('costPrice', { min: 0, money: true });
  v.str('notes', { max: 2000 });
  v.forbid('isActive', 'Use DELETE to archive');
  const variants = v.array('variants');
  if (variants) {
    variants.forEach((raw, i) => {
      const f = `variants[${i}]`;
      if (!raw || typeof raw !== 'object') return v.error(f, 'Must be an object');
      if (typeof raw.attribute !== 'string' || !raw.attribute.trim()) v.error(`${f}.attribute`, 'Required');
      if (typeof raw.value !== 'string' || !raw.value.trim()) v.error(`${f}.value`, 'Required');
      const extra = raw.extraPrice ?? 0;
      if (!Number.isInteger(extra) || extra < 0) v.error(`${f}.extraPrice`, 'Must be a whole number of paise, 0 or more');
    });
  }
  return v.done();
}

router.get('/products', READ, (req, res) => {
  const search = queryString(req.query, 'search');
  const type = queryEnum(req.query, 'type', PRODUCT_TYPES);
  const isActive = queryBool(req.query, 'isActive');
  const items = db.products
    .filter((p) => matchesSearch(search, p.name) && (!type || p.type === type) && (isActive === undefined || p.isActive === isActive))
    .map(serializeProduct);
  sendList(res, items, req.query, { defaultSort: 'name' });
});

router.post('/products', ADMIN, (req, res) => {
  const b = readProduct(req.body, false);
  const p = insert('products', {
    name: b.name,
    type: b.type,
    salesPrice: b.salesPrice,
    costPrice: b.costPrice ?? 0,
    notes: b.notes ?? '',
    variants: (b.variants || []).map((v) => ({ id: newId(), attribute: v.attribute.trim(), value: v.value.trim(), extraPrice: v.extraPrice ?? 0 })),
    isActive: true,
  });
  send(res, serializeProduct(p), 201);
});

router.get('/products/:id', READ, (req, res) => send(res, serializeProduct(load('products', req.params.id, 'Product'))));

router.patch('/products/:id', ADMIN, (req, res) => {
  const p = load('products', req.params.id, 'Product');
  const b = readProduct(req.body, true);
  if (b.variants) {
    const details = [];
    const next = b.variants.map((v, i) => {
      if (v.id && !p.variants.some((old) => old.id === v.id)) details.push({ field: `variants[${i}].id`, message: 'Variant not found' });
      return { id: v.id || newId(), attribute: v.attribute.trim(), value: v.value.trim(), extraPrice: v.extraPrice ?? 0 };
    });
    if (details.length) throw errors.validation(details);
    const removed = p.variants.filter((old) => !next.some((v) => v.id === old.id));
    for (const old of removed) {
      const inUse = db.subscriptions.some(
        (s) => OPEN_STATUSES.includes(s.status) && s.lines.some((l) => l.variantId === old.id),
      );
      if (inUse) throw errors.notEditable(`Variant "${variantLabel(old)}" is used by an active subscription`);
    }
    p.variants = next;
  }
  for (const k of ['name', 'type', 'salesPrice', 'costPrice', 'notes']) if (b[k] !== undefined) p[k] = b[k];
  p.updatedAt = nowIso();
  send(res, serializeProduct(p));
});

router.delete('/products/:id', ADMIN, (req, res) => {
  const p = load('products', req.params.id, 'Product');
  p.isActive = false;
  p.updatedAt = nowIso();
  res.status(204).end();
});

// ================================================================ plans

export function serializePlan(pl) {
  const product = byId('products', pl.productId);
  return {
    id: pl.id,
    name: pl.name,
    product: product ? { id: product.id, name: product.name, type: product.type, variants: product.variants.map((v) => ({ ...v })) } : null,
    price: pl.price,
    billingPeriod: pl.billingPeriod,
    minQuantity: pl.minQuantity,
    availableFrom: pl.availableFrom,
    availableUntil: pl.availableUntil,
    rules: { ...pl.rules },
    description: pl.description,
    activeSubscriptions: db.subscriptions.filter((s) => s.planId === pl.id && s.status === 'active').length,
    isActive: pl.isActive,
    createdAt: pl.createdAt,
    updatedAt: pl.updatedAt,
  };
}

function readPlan(body, partial, current) {
  const v = new Validator(body, { partial });
  v.str('name', { required: true, min: 1, max: 120 });
  v.ref('productId', 'products', 'Product', { required: true, activeOnly: true });
  v.int('price', { required: true, min: 0, money: true });
  v.oneOf('billingPeriod', PERIODS, { required: true });
  v.int('minQuantity', { min: 1 });
  v.date('availableFrom');
  v.date('availableUntil', { nullable: true });
  v.str('description', { max: 2000 });
  v.forbid('isActive', 'Use DELETE to archive');
  const rules = v.object('rules');
  if (rules) {
    for (const k of Object.keys(rules)) {
      if (!['autoClose', 'closable', 'pausable', 'renewable'].includes(k)) v.error(`rules.${k}`, 'Unknown rule');
      else if (typeof rules[k] !== 'boolean') v.error(`rules.${k}`, 'Must be true or false');
    }
  }
  const out = v.done();
  const from = out.availableFrom ?? current?.availableFrom ?? today();
  const until = out.availableUntil !== undefined ? out.availableUntil : current?.availableUntil ?? null;
  if (until && until < from) throw errors.validation([{ field: 'availableUntil', message: 'Must be on or after availableFrom' }]);
  return out;
}

const defaultRules = { autoClose: false, closable: false, pausable: false, renewable: false };

router.get('/plans', READ, (req, res) => {
  const search = queryString(req.query, 'search');
  const period = queryEnum(req.query, 'billingPeriod', PERIODS);
  const isActive = queryBool(req.query, 'isActive');
  const availableOn = queryDate(req.query, 'availableOn');
  const items = db.plans
    .filter(
      (pl) =>
        matchesSearch(search, pl.name, byId('products', pl.productId)?.name) &&
        (!period || pl.billingPeriod === period) &&
        (isActive === undefined || pl.isActive === isActive) &&
        (!availableOn || planAvailableOn(pl, availableOn)),
    )
    .map(serializePlan);
  sendList(res, items, req.query, { defaultSort: 'name' });
});

router.post('/plans', ADMIN, (req, res) => {
  const b = readPlan(req.body, false);
  const pl = insert('plans', {
    name: b.name,
    productId: b.productId,
    price: b.price,
    billingPeriod: b.billingPeriod,
    minQuantity: b.minQuantity ?? 1,
    availableFrom: b.availableFrom ?? today(),
    availableUntil: b.availableUntil ?? null,
    rules: { ...defaultRules, ...(b.rules || {}) },
    description: b.description ?? '',
    isActive: true,
  });
  send(res, serializePlan(pl), 201);
});

router.get('/plans/:id', READ, (req, res) => send(res, serializePlan(load('plans', req.params.id, 'Plan'))));

router.patch('/plans/:id', ADMIN, (req, res) => {
  const pl = load('plans', req.params.id, 'Plan');
  const b = readPlan(req.body, true, pl);
  for (const k of ['name', 'productId', 'price', 'billingPeriod', 'minQuantity', 'availableFrom', 'availableUntil', 'description']) {
    if (b[k] !== undefined) pl[k] = b[k];
  }
  if (b.rules) pl.rules = { ...pl.rules, ...b.rules };
  pl.updatedAt = nowIso();
  send(res, serializePlan(pl));
});

router.delete('/plans/:id', ADMIN, (req, res) => {
  const pl = load('plans', req.params.id, 'Plan');
  pl.isActive = false;
  pl.updatedAt = nowIso();
  res.status(204).end();
});

// ================================================================ quotation templates

export function serializeTemplate(t) {
  const plan = byId('plans', t.planId);
  return {
    id: t.id,
    name: t.name,
    plan: plan ? { id: plan.id, name: plan.name, billingPeriod: plan.billingPeriod } : null,
    validityDays: t.validityDays,
    paymentTermDays: t.paymentTermDays,
    lines: t.lines.map((l) => {
      const product = byId('products', l.productId);
      const variant = l.variantId ? product?.variants.find((v) => v.id === l.variantId) : null;
      return {
        productId: l.productId,
        productName: product?.name ?? null,
        variantId: l.variantId ?? null,
        variantLabel: variantLabel(variant),
        quantity: l.quantity,
        unitPrice: product ? defaultUnitPrice(product, variant, plan) : null,
      };
    }),
    notes: t.notes,
    usedCount: db.subscriptions.filter((s) => s.templateId === t.id).length,
    isActive: t.isActive,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function readTemplate(body, partial, current) {
  const v = new Validator(body, { partial });
  v.str('name', { required: true, min: 1, max: 120 });
  v.ref('planId', 'plans', 'Plan', { required: true, activeOnly: true });
  v.int('validityDays', { min: 1, max: 365 });
  v.oneOf('paymentTermDays', [0, 15, 30, 45], { required: true });
  v.str('notes', { max: 4000 });
  v.forbid('isActive', 'Use DELETE to archive');
  const lines = v.array('lines');
  const out = v.done();
  const plan = byId('plans', out.planId ?? current?.planId);
  let clean;
  if (lines !== undefined || out.planId !== undefined) {
    const src = lines ?? current?.lines ?? [];
    const details = [];
    clean = src.map((raw, i) => {
      const f = `lines[${i}]`;
      const product = byId('products', raw?.productId);
      if (!product) return details.push({ field: `${f}.productId`, message: 'Product not found' });
      if (!product.isActive) return details.push({ field: `${f}.productId`, message: 'Product is archived' });
      const variantId = raw.variantId ?? null;
      if (variantId && !product.variants.some((x) => x.id === variantId)) {
        return details.push({ field: `${f}.variantId`, message: 'Variant not found on this product' });
      }
      if (!Number.isInteger(raw.quantity) || raw.quantity < 1) {
        return details.push({ field: `${f}.quantity`, message: 'Must be a whole number of 1 or more' });
      }
      return { productId: product.id, variantId, quantity: raw.quantity };
    });
    if (details.length) throw errors.validation(details);
    if (!clean.length) clean = [{ productId: plan.productId, variantId: null, quantity: plan.minQuantity }];
    const qty = clean.filter((l) => l.productId === plan.productId).reduce((s, l) => s + l.quantity, 0);
    if (qty === 0) throw errors.validation([{ field: 'lines', message: "Must include the plan's product" }]);
    if (qty < plan.minQuantity) {
      throw errors.belowMinQuantity(`${plan.name} needs at least ${plan.minQuantity} of its product (got ${qty})`);
    }
  }
  return { ...out, lines: clean };
}

router.get('/quotation-templates', READ, (req, res) => {
  const search = queryString(req.query, 'search');
  const planId = queryString(req.query, 'planId');
  const isActive = queryBool(req.query, 'isActive');
  const items = db.templates
    .filter((t) => matchesSearch(search, t.name) && (!planId || t.planId === planId) && (isActive === undefined || t.isActive === isActive))
    .map(serializeTemplate);
  sendList(res, items, req.query, { defaultSort: 'name' });
});

router.post('/quotation-templates', allow('admin', 'staff'), (req, res) => {
  const b = readTemplate(req.body, false);
  const t = insert('templates', {
    name: b.name,
    planId: b.planId,
    validityDays: b.validityDays ?? 14,
    paymentTermDays: b.paymentTermDays,
    lines: b.lines,
    notes: b.notes ?? '',
    isActive: true,
  });
  send(res, serializeTemplate(t), 201);
});

router.get('/quotation-templates/:id', READ, (req, res) =>
  send(res, serializeTemplate(load('templates', req.params.id, 'Quotation template'))),
);

router.patch('/quotation-templates/:id', allow('admin', 'staff'), (req, res) => {
  const t = load('templates', req.params.id, 'Quotation template');
  const b = readTemplate(req.body, true, t);
  for (const k of ['name', 'planId', 'validityDays', 'paymentTermDays', 'notes']) if (b[k] !== undefined) t[k] = b[k];
  if (b.lines) t.lines = b.lines;
  t.updatedAt = nowIso();
  send(res, serializeTemplate(t));
});

router.delete('/quotation-templates/:id', allow('admin', 'staff'), (req, res) => {
  const t = load('templates', req.params.id, 'Quotation template');
  t.isActive = false;
  t.updatedAt = nowIso();
  res.status(204).end();
});

export default router;
