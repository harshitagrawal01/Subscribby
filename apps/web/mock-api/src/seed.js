// Deterministic seed (spec section 15). Re-run on every start and on POST /__mock/reset.
// All dates are relative to "today" in Asia/Kolkata, so overdue / expiring cases stay true.
// A seeded PRNG (mulberry32) keeps names, amounts and statuses identical between runs.
import { db, resetStore, newId, nextNumber } from './store.js';
import { today, addDays, addMonths, addYears, periodEndFor, istTimestamp, minDate, maxDate, nowIso } from './dates.js';
import { config } from './config.js';
import { hashPassword } from './auth.js';
import { priceLines, recurringAmounts } from './pricing.js';
import { buildInvoice, reserveDiscountUses } from './domain/invoices.js';
import { defaultUnitPrice } from './domain/subscriptions.js';
import { variantLabel } from './domain/refs.js';
import { CITIES, COMPANIES, FIRST_NAMES, LAST_NAMES } from './seed-data.js';

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seed() {
  resetStore();
  const T = today();
  const rnd = mulberry32(20261031);
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const chance = (p) => rnd() < p;
  const D = (n) => addDays(T, n);
  // Timestamps on "today" never land after the real current time (unless MOCK_TODAY is set).
  const nowTs = nowIso();
  const at = (date, hhmm = '10:00') => {
    const ts = istTimestamp(date, hhmm);
    return !config.mockToday && ts > nowTs ? nowTs : ts;
  };
  const stamp = (date, hhmm = '09:00') => ({ createdAt: at(date, hhmm), updatedAt: at(date, hhmm) });
  const genesis = D(-420);
  const year = Number(T.slice(0, 4));

  // ================================================================ users (staff)
  const addUser = (name, email, password, role, extra = {}) => {
    const u = {
      id: newId(), name, email, passwordHash: hashPassword(password), role, status: 'active',
      mustChangePassword: false, passwordChangedAt: null, tokenEpoch: 0, createdVia: 'seed', createdBy: null,
      customerId: null, lastLoginAt: null, resetTokenHash: null, resetTokenExpiresAt: null, ...stamp(genesis), ...extra,
    };
    db.users.push(u);
    return u;
  };
  const admin = addUser('Neha Kapoor', 'admin@brightloop.test', 'Admin@2026!', 'admin', { lastLoginAt: at(D(-1), '09:15') });
  const riya = addUser('Riya Sharma', 'riya@brightloop.test', 'Staff@2026!', 'staff', { lastLoginAt: at(D(-1), '10:05') });
  const meera = addUser('Meera Nair', 'meera@brightloop.test', 'Finance@2026!', 'finance', { lastLoginAt: at(D(-1), '11:20') });
  const sanjay = addUser('Sanjay Verma', 'sanjay@brightloop.test', 'Staff@2026!', 'staff', { lastLoginAt: at(D(-3), '16:40'), ...stamp(D(-300)) });
  addUser('Karan Malhotra', 'karan@brightloop.test', 'Staff@2026!', 'staff', { status: 'disabled', createdVia: 'admin', createdBy: admin.id, ...stamp(D(-250)) });
  addUser('Rohan Das', 'new.staff@brightloop.test', 'Welcome@2026!', 'staff', { mustChangePassword: true, createdVia: 'admin', createdBy: admin.id, ...stamp(D(-1), '12:00') });

  // ================================================================ catalog
  const addProduct = (name, type, salesPrice, costPrice, notes, variants = [], extra = {}) => {
    const p = {
      id: newId(), name, type, salesPrice, costPrice, notes,
      variants: variants.map(([attribute, value, extraPrice]) => ({ id: newId(), attribute, value, extraPrice })),
      isActive: true, ...stamp(genesis), ...extra,
    };
    db.products.push(p);
    return p;
  };
  const crm = addProduct('CRM Suite', 'service', 400000, 90000, 'Core CRM seat', [['Brand', 'Odoo', 56000], ['Brand', 'Generic', 0]]);
  const [odoo, generic] = crm.variants;
  const analytics = addProduct('Analytics add-on', 'addon', 600000, 150000, 'Dashboards and scheduled reports');
  const storage = addProduct('Extra storage add-on', 'addon', 150000, 30000, '100 GB of extra document storage');
  const kit = addProduct('Onboarding kit', 'physical', 250000, 120000, 'Printed playbooks and a welcome hamper, shipped');
  addProduct('Legacy SMS pack', 'addon', 50000, 20000, 'Discontinued in favour of WhatsApp alerts', [], { isActive: false });

  const addPlan = (name, product, price, billingPeriod, minQuantity, rules, description, extra = {}) => {
    const p = {
      id: newId(), name, productId: product.id, price, billingPeriod, minQuantity,
      availableFrom: `${year - 3}-01-01`, availableUntil: null, rules, description, isActive: true, ...stamp(genesis), ...extra,
    };
    db.plans.push(p);
    return p;
  };
  const rules = (autoClose, closable, pausable, renewable) => ({ autoClose, closable, pausable, renewable });
  const proYearly = addPlan('Pro Yearly', crm, 400000, 'yearly', 10, rules(true, false, false, true), 'Yearly contract for teams of 10+');
  const basicMonthly = addPlan('Basic Monthly', crm, 300000, 'monthly', 1, rules(false, true, true, true), 'Month to month, pause or cancel any time');
  const proMonthly = addPlan('Pro Monthly', crm, 450000, 'monthly', 5, rules(true, true, false, true), 'Monthly billing for teams of 5+');
  const starterWeekly = addPlan('Starter Weekly', crm, 90000, 'weekly', 1, rules(true, true, true, false), 'Weekly billing for pilots and small teams');
  const dayPass = addPlan('Day Pass', crm, 18000, 'daily', 1, rules(true, true, false, false), 'Per-day seats for events and audits');
  const analyticsMonthly = addPlan('Analytics Monthly', analytics, 600000, 'monthly', 1, rules(false, true, true, true), 'Analytics without the CRM');
  addPlan('Legacy Monthly', crm, 250000, 'monthly', 1, rules(false, true, false, false), 'Old price plan, no longer sold', {
    availableFrom: `${year - 4}-01-01`, availableUntil: D(-60),
  });

  // ================================================================ taxes & discounts
  const addTax = (name, rate, appliesTo, isActive = true) =>
    db.taxes.push({ id: newId(), name, type: 'percentage', rate, appliesTo: { productTypes: [], productIds: [], ...appliesTo }, isActive, ...stamp(genesis) });
  addTax('GST 18%', 18, { kind: 'productTypes', productTypes: ['service', 'addon'] });
  addTax('GST 12%', 12, { kind: 'productTypes', productTypes: ['physical'] });
  addTax('Service Tax 15% (pre-GST)', 15, { kind: 'all' }, false);

  const addDiscount = (o, createdOn) => {
    const d = {
      id: newId(), minPurchaseAmount: null, minQuantity: null, usageLimit: null, usedCount: 0, isActive: true,
      ...o, appliesTo: { productIds: [], ...o.appliesTo }, ...stamp(createdOn),
    };
    db.discounts.push(d);
    return d;
  };
  addDiscount({ name: 'Early bird 5%', type: 'percentage', value: 5, startDate: D(-200), endDate: D(100), appliesTo: { kind: 'subscription' }, isActive: false }, D(-210));
  addDiscount({ name: 'Launch ₹500 off', type: 'fixed', value: 50000, minPurchaseAmount: 200000, startDate: D(-150), endDate: D(90), appliesTo: { kind: 'subscription' } }, D(-155));
  addDiscount({ name: 'Festive 8% off', type: 'percentage', value: 8, minPurchaseAmount: 1000000, startDate: D(-100), endDate: D(-40), appliesTo: { kind: 'subscription' } }, D(-105));
  const storageDeal = addDiscount({ name: 'Storage 20% off', type: 'percentage', value: 20, startDate: D(-90), endDate: D(30), usageLimit: 5, appliesTo: { kind: 'products', productIds: [storage.id] } }, D(-92));
  addDiscount({ name: 'Bulk seats 10%', type: 'percentage', value: 10, minQuantity: 20, startDate: D(-45), endDate: D(60), usageLimit: 50, appliesTo: { kind: 'products', productIds: [crm.id] } }, D(-46));
  addDiscount({ name: 'New Year 15% off', type: 'percentage', value: 15, minQuantity: 5, startDate: D(20), endDate: D(60), usageLimit: 100, appliesTo: { kind: 'products', productIds: [crm.id] } }, D(-2));

  // ================================================================ templates
  const addTemplate = (name, plan, validityDays, paymentTermDays, lines, notes) => {
    const t = {
      id: newId(), name, planId: plan.id, validityDays, paymentTermDays,
      lines: lines.map(([p, v, quantity]) => ({ productId: p.id, variantId: v?.id ?? null, quantity })),
      notes, isActive: true, ...stamp(genesis),
    };
    db.templates.push(t);
    return t;
  };
  const proStd = addTemplate('Pro Yearly – Standard', proYearly, 14, 30, [[crm, odoo, 10], [analytics, null, 1]], 'Prices exclude GST. Billed yearly in advance.');
  const basicStarter = addTemplate('Basic Monthly – Starter', basicMonthly, 7, 15, [[crm, generic, 1]], 'Billed monthly in advance. Pause or cancel any time.');
  addTemplate('Pro Monthly – Team', proMonthly, 10, 15, [[crm, odoo, 5], [storage, null, 2]], 'Billed monthly in advance. Minimum 5 seats.');

  // ================================================================ customers (+ their logins)
  const customers = COMPANIES.map(([name, cityKey], i) => {
    const city = CITIES[cityKey];
    const slug = name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
    const contactName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const letters = () => Array.from({ length: 5 }, () => String.fromCharCode(65 + int(0, 25))).join('');
    const c = {
      id: newId(), name, contactName, email: `accounts@${slug}.test`,
      phone: `+91 ${int(70000, 99999)} ${String(int(0, 99999)).padStart(5, '0')}`,
      billingAddress: {
        line1: `${int(1, 240)}, ${pick(city.streets)}`, line2: chance(0.4) ? `${pick(['2nd', '3rd', '4th', 'Ground'])} Floor` : '',
        city: city.city, state: city.state, postalCode: city.postalCode, country: 'IN',
      },
      taxId: `${city.gst}${letters()}${int(1000, 9999)}${String.fromCharCode(65 + int(0, 25))}1Z${int(1, 9)}`,
      notes: '', userId: null, isActive: true, ...stamp(addDays(genesis, int(0, 15)), '12:00'),
    };
    if (i === 0) Object.assign(c, { contactName: 'Vikram Iyer', email: 'billing@acme.test', phone: '+91 98450 00000', taxId: '29ABCDE1234F1Z5', billingAddress: { line1: '12 MG Road', line2: '', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001', country: 'IN' } });
    if (i === 1) Object.assign(c, { contactName: 'Asha Rao', email: 'asha@kite.test', phone: '+91 98220 12345' });
    if (i === 2) Object.assign(c, { contactName: 'Pooja Jain' });
    if (i === 49) Object.assign(c, { isActive: false, notes: 'Studio closed; archived' });
    db.customers.push(c);
    return c;
  });
  const c = customers;
  const addLogin = (customer, name, signedUpOn, extra = {}) => {
    const u = addUser(name, customer.email, 'Customer@2026!', 'customer', {
      createdVia: 'signup', customerId: customer.id, ...stamp(signedUpOn, '18:00'), lastLoginAt: at(D(-2), '19:30'), ...extra,
    });
    customer.userId = u.id;
    return u;
  };
  addLogin(c[0], 'Vikram Iyer', D(-30));
  addLogin(c[1], 'Asha Rao', D(-110));
  addLogin(c[2], 'Pooja Jain', D(-40), { status: 'disabled', lastLoginAt: at(D(-21), '10:00') });

  // ================================================================ subscriptions
  const subs = [];
  const loginFor = (customer, onDate) => {
    const u = customer.userId ? db.users.find((x) => x.id === customer.userId) : null;
    return u && u.createdAt <= at(onDate, '15:00') ? u : null;
  };

  /**
   * o: { customer, plan, template, lines: [[product, variant, qty, unitPrice?]], start, expiry, term, status,
   *      created, sentOn, validUntil, confirmedOn, pausedOn, closedOn, closeReason, note,
   *      billUntil, billCount, fates: [...], cancelIdx }
   */
  function mkSub(o) {
    const plan = o.plan;
    const tpl = o.template || null;
    const start = o.start;
    const expiry = o.expiry ?? addDays(addYears(start, 1), -1);
    const sp = o.salesperson ?? pick([riya, riya, sanjay, admin]);
    const created = o.created ?? addDays(minDate(start, T), -int(6, 14));
    const sub = {
      id: newId(), number: null, customerId: o.customer.id, planId: plan.id, templateId: tpl?.id ?? null,
      salespersonId: sp.id, status: o.status, startDate: start, expiryDate: expiry, quotationValidUntil: null,
      paymentTermDays: o.term ?? tpl?.paymentTermDays ?? 30,
      lines: o.lines.map(([p, v, quantity, unitPrice]) => ({
        id: newId(), productId: p.id, productName: p.name, variantId: v?.id ?? null, variantLabel: variantLabel(v),
        quantity, unitPrice: unitPrice ?? defaultUnitPrice(p, v, plan),
      })),
      nextInvoiceDate: null, recurringTotal: 0, recurringNet: 0, pausedAt: null, closedAt: null, closeReason: null,
      notes: o.notes ?? '', history: [], createdAt: at(created, '10:00'), updatedAt: at(created, '10:00'),
    };
    const h = (date, hhmm, by, action, from, to, note = null) => sub.history.push({ at: at(date, hhmm), by, action, from, to, note });
    h(created, '10:00', sp.id, 'create', null, 'draft');

    let billFrom = null; // period generation window
    let billUntil = null;
    if (o.status !== 'draft') {
      const sentOn = o.sentOn ?? addDays(created, 1);
      sub.quotationValidUntil = o.validUntil ?? addDays(sentOn, tpl ? tpl.validityDays : 14);
      h(sentOn, '11:00', sp.id, 'send', 'draft', 'quotation');
      const close = (date, hhmm, by, action, from, note) => {
        h(date, hhmm, by, action, from, 'closed', note);
        sub.closedAt = at(date, hhmm);
        sub.closeReason = o.closeReason;
      };
      if (o.closeReason === 'quotation_expired') close(addDays(sub.quotationValidUntil, 1), '00:30', 'system', 'close', 'quotation', 'Quotation expired');
      else if (o.closeReason === 'rejected') close(o.closedOn, '16:00', loginFor(o.customer, o.closedOn)?.id ?? sp.id, 'reject', 'quotation', 'Rejected in portal');
      else if (o.closeReason === 'cancelled') close(o.closedOn, '12:00', sp.id, 'cancel', 'quotation', o.note ?? null);
      else if (o.status !== 'quotation') {
        const confirmedOn = o.confirmedOn ?? minDate(addDays(sentOn, int(1, 3)), sub.quotationValidUntil);
        const login = loginFor(o.customer, confirmedOn);
        const actor = login ? login.id : sp.id;
        h(confirmedOn, '15:00', actor, 'confirm', 'quotation', 'confirmed', login ? 'Accepted in portal' : 'Accepted by email');
        if (o.status !== 'confirmed') {
          if (start <= confirmedOn) h(confirmedOn, '15:01', actor, 'activate', 'confirmed', 'active', 'Start date reached');
          else h(start, '00:30', 'system', 'activate', 'confirmed', 'active');
          billFrom = start;
          billUntil = o.billUntil ?? T;
          if (o.status === 'paused') {
            h(o.pausedOn, '14:00', sp.id, 'pause', 'active', 'paused', o.note ?? null);
            sub.pausedAt = at(o.pausedOn, '14:00');
            billUntil = o.pausedOn;
          }
          if (o.closeReason === 'expired') {
            const closedOn = addDays(expiry, 1);
            close(closedOn, '00:30', 'system', 'close', 'active', 'Expired');
            billUntil = expiry;
          }
          if (o.closeReason === 'closed_early') {
            close(o.closedOn, '17:00', sp.id, 'close', 'active', o.note ?? null);
            billUntil = o.closedOn;
          }
        }
      }
    }
    sub.updatedAt = sub.history[sub.history.length - 1].at;

    // Billing periods already invoiced (in advance, one invoice per period, invoiceDate = periodStart)
    const periods = [];
    if (billFrom) {
      let s = billFrom;
      while (s <= billUntil && s <= expiry && (o.billCount === undefined || periods.length < o.billCount)) {
        const e = periodEndFor(s, plan.billingPeriod);
        periods.push({ periodStart: s, periodEnd: e });
        s = addDays(e, 1);
      }
      if (['active', 'paused'].includes(o.status)) sub.nextInvoiceDate = s;
    }
    db.subscriptions.push(sub);
    subs.push({ sub, o, periods, created });
    return sub;
  }

  const L = (...lines) => lines;
  // ---- the two test cases (section 14)
  mkSub({ customer: c[0], plan: proYearly, template: proStd, lines: L([crm, odoo, 25], [analytics, null, 1]), start: D(-15), status: 'active', salesperson: riya, created: D(-25), sentOn: D(-24), confirmedOn: D(-20), term: 30, notes: 'Test case 1: total 1,28,148.00 per year', fates: [{ kind: 'partial', amount: 5000000, method: 'bank_transfer', note: 'Part payment, UTR 88213', payOn: D(-5) }] });
  mkSub({ customer: c[1], plan: basicMonthly, template: basicStarter, lines: L([crm, generic, 1]), start: addMonths(D(-5), -3), status: 'active', salesperson: sanjay, notes: 'Test case 2: total 2,950.00 per month', fates: ['paid', 'paid', 'paid', 'confirmed'] });
  // ---- Acme and Kite extras (portal demos)
  mkSub({ customer: c[0], plan: basicMonthly, lines: L([crm, generic, 3], [storage, null, 2]), start: D(-59), status: 'active', term: 30, fates: ['overdue'] }); // overdue 29 days
  mkSub({ customer: c[0], plan: proMonthly, lines: L([crm, odoo, 6]), start: D(10), status: 'draft', created: D(-1) });
  mkSub({ customer: c[1], plan: proMonthly, lines: L([crm, odoo, 5], [analytics, null, 1]), start: D(7), status: 'quotation', created: D(-3), sentOn: D(-2), validUntil: D(12), salesperson: sanjay });
  // ---- quotations
  mkSub({ customer: c[3], plan: proYearly, template: proStd, lines: L([crm, odoo, 12], [analytics, null, 1]), start: D(15), status: 'quotation', created: D(-14), sentOn: D(-13), notes: 'Expires tomorrow' });
  mkSub({ customer: c[4], plan: basicMonthly, template: basicStarter, lines: L([crm, generic, 2]), start: D(5), status: 'quotation', created: D(-10), sentOn: D(-9) }); // past validity: next billing run expires it
  mkSub({ customer: c[5], plan: proMonthly, lines: L([crm, generic, 8], [storage, null, 3]), start: D(14), status: 'quotation', created: D(-5), sentOn: D(-4) });
  mkSub({ customer: c[6], plan: starterWeekly, lines: L([crm, generic, 3]), start: D(3), status: 'quotation', created: D(-2), sentOn: D(-1) });
  // ---- drafts
  mkSub({ customer: c[7], plan: proYearly, template: proStd, lines: L([crm, odoo, 10], [analytics, null, 1]), start: D(30), status: 'draft', created: D(-2) });
  mkSub({ customer: c[8], plan: basicMonthly, lines: L([crm, generic, 1], [kit, null, 1]), start: D(7), status: 'draft', created: D(-1) });
  // ---- confirmed
  mkSub({ customer: c[9], plan: proYearly, lines: L([crm, odoo, 15]), start: D(5), status: 'confirmed', created: D(-10), sentOn: D(-8), confirmedOn: D(-4) });
  mkSub({ customer: c[10], plan: basicMonthly, lines: L([crm, generic, 2], [analytics, null, 1]), start: D(12), status: 'confirmed', created: D(-7), sentOn: D(-6), confirmedOn: D(-3) });
  mkSub({ customer: c[11], plan: basicMonthly, lines: L([crm, generic, 4]), start: D(-2), status: 'confirmed', created: D(-10), sentOn: D(-9), confirmedOn: D(-5) }); // start passed: next run activates
  // ---- paused
  mkSub({ customer: c[12], plan: basicMonthly, lines: L([crm, odoo, 2], [storage, null, 1]), start: D(-150), status: 'paused', pausedOn: D(-20), note: 'Seasonal shutdown' });
  mkSub({ customer: c[13], plan: starterWeekly, lines: L([crm, generic, 2]), start: D(-60), status: 'paused', pausedOn: D(-10), term: 15, note: 'Pilot on hold' });
  // ---- expiry cases
  mkSub({ customer: c[14], plan: basicMonthly, lines: L([crm, generic, 5]), start: addDays(addYears(T, -1), -10), status: 'active', notes: 'Past expiry, plan has no auto-close' });
  mkSub({ customer: c[15], plan: proMonthly, lines: L([crm, generic, 6]), start: addDays(addYears(T, -1), -5), status: 'active' }); // auto-close plan past expiry: next run closes it
  // ---- overdue invoices (5 and 75 days; Acme's 29-day one is above)
  mkSub({ customer: c[16], plan: proMonthly, lines: L([crm, odoo, 6], [storage, null, 1]), start: D(-105), status: 'active', term: 30, fates: ['overdue', 'partial', 'paid'] });
  mkSub({ customer: c[17], plan: starterWeekly, lines: L([crm, generic, 2]), start: D(-20), status: 'active', term: 15, fates: ['overdue', 'paid'] });
  // ---- due for billing (so a billing run has work to do)
  mkSub({ customer: c[18], plan: starterWeekly, lines: L([crm, odoo, 1]), start: D(-62), status: 'active', term: 15, billUntil: D(-21), notes: '3 weekly periods behind (catch-up demo)' });
  mkSub({ customer: c[19], plan: basicMonthly, lines: L([crm, generic, 2], [analytics, null, 1]), start: addMonths(T, -2), status: 'active', billCount: 2 });
  mkSub({ customer: c[20], plan: analyticsMonthly, lines: L([analytics, null, 1]), start: addMonths(T, -1), status: 'active', billCount: 1, term: 15 });
  mkSub({ customer: c[21], plan: dayPass, lines: L([crm, generic, 2]), start: D(-6), status: 'active', term: 0, billUntil: D(-1), fates: ['paid', 'paid', 'paid', 'paid', 'paid', 'draft'] });
  // ---- closed in every way
  mkSub({ customer: c[22], plan: proMonthly, lines: L([crm, generic, 5]), start: D(-20), status: 'closed', closeReason: 'cancelled', created: D(-42), sentOn: D(-40), closedOn: D(-30), note: 'Customer chose another vendor' });
  mkSub({ customer: c[2], plan: basicMonthly, lines: L([crm, generic, 3]), start: D(-10), status: 'closed', closeReason: 'rejected', created: D(-27), sentOn: D(-25), closedOn: D(-20) });
  mkSub({ customer: c[23], plan: proYearly, template: proStd, lines: L([crm, odoo, 10], [analytics, null, 1]), start: D(-30), status: 'closed', closeReason: 'quotation_expired', created: D(-62), sentOn: D(-60) });
  mkSub({ customer: c[24], plan: proMonthly, lines: L([crm, odoo, 5]), start: addDays(addYears(T, -1), -35), status: 'closed', closeReason: 'expired' });
  mkSub({ customer: c[49], plan: basicMonthly, lines: L([crm, generic, 2]), start: D(-200), status: 'closed', closeReason: 'closed_early', closedOn: D(-45), note: 'Business closed' });

  // ---- regular active subscriptions for the rest
  const randomPlans = [proYearly, proYearly, basicMonthly, basicMonthly, basicMonthly, proMonthly, proMonthly, proMonthly, starterWeekly, analyticsMonthly];
  let randomCount = 0;
  for (let i = 25; i <= 45; i++) {
    const n = i % 3 === 0 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const plan = pick(randomPlans);
      const lines = [];
      if (plan.productId === crm.id) {
        const qty = plan === proYearly ? int(10, 30) : plan === proMonthly ? int(5, 15) : int(1, 6);
        const variant = chance(0.55) ? odoo : generic;
        // One negotiated price (staff override while it was a quotation)
        const override = randomCount === 0 ? defaultUnitPrice(crm, variant, plan) - 20000 : undefined;
        lines.push([crm, variant, qty, override]);
        if (chance(0.4)) lines.push([analytics, null, 1]);
      } else lines.push([analytics, null, int(1, 3)]);
      if (chance(0.35)) lines.push([storage, null, int(1, 4)]);
      if (chance(0.1)) lines.push([kit, null, 1]);
      const startBack = plan.billingPeriod === 'yearly' ? int(20, 330) : plan.billingPeriod === 'weekly' ? int(10, 70) : int(25, 185);
      mkSub({
        customer: c[i], plan, lines, start: D(-startBack), status: 'active', term: pick([15, 30, 30, 45]),
        cancelIdx: randomCount % 4 === 1 ? 1 : undefined,
      });
      randomCount++;
    }
  }

  // ---- numbers in creation order (per year)
  subs.sort((a, b) => (a.sub.createdAt < b.sub.createdAt ? -1 : a.sub.createdAt > b.sub.createdAt ? 1 : 0));
  for (const s of subs) s.sub.number = nextNumber('SUB', s.created.slice(0, 4));

  // ================================================================ invoices + payments
  const entries = [];
  for (const { sub, o, periods } of subs) {
    periods.forEach((p, idx) => {
      const isLast = idx === periods.length - 1;
      const e = { sub, ...p, invoiceDate: p.periodStart, fate: o.fates?.[idx] ?? null, isLast };
      if (o.cancelIdx === idx && periods.length > 2 && p.periodStart <= D(-5)) {
        entries.push({ sub, ...p, invoiceDate: p.periodStart, fate: 'cancelled' });
        e.invoiceDate = addDays(p.periodStart, 1); // re-issued the next day
      }
      entries.push(e);
    });
  }
  entries.sort((a, b) =>
    a.invoiceDate !== b.invoiceDate ? (a.invoiceDate < b.invoiceDate ? -1 : 1) : a.sub.number !== b.sub.number ? (a.sub.number < b.sub.number ? -1 : 1) : a.fate === 'cancelled' ? -1 : 1,
  );

  const METHODS = ['bank_transfer', 'bank_transfer', 'bank_transfer', 'upi', 'upi', 'upi', 'card', 'card', 'cheque', 'cash', 'other'];
  const noteFor = (m) =>
    ({
      bank_transfer: `NEFT UTR ${int(10000000, 99999999)}`,
      upi: `UPI ref ${int(100000000, 999999999)}${int(100, 999)}`,
      card: `Card ending ${int(1000, 9999)}`,
      cheque: `Cheque #${String(int(1, 999999)).padStart(6, '0')}`,
      cash: 'Cash received at Bengaluru office',
      other: 'Adjusted against credit note',
    })[m];
  const addPayment = (inv, amount, date, method = pick(METHODS), note = noteFor(method)) => {
    db.payments.push({
      id: newId(), invoiceId: inv.id, customerId: inv.customerId, subscriptionId: inv.subscriptionId, method, amount,
      paymentDate: date, note, recordedBy: pick([admin, riya, meera, meera]).id, ...stamp(date, '15:00'),
    });
    inv.amountPaid += amount;
    inv.balance -= amount;
    inv.updatedAt = at(date, '15:00');
  };
  const clampDate = (d, lo, hi) => maxDate(lo, minDate(d, hi));

  for (const e of entries) {
    const { sub } = e;
    const pricing = priceLines(sub.lines, e.invoiceDate);
    const inv = buildInvoice(sub, {
      periodStart: e.periodStart, periodEnd: e.periodEnd, invoiceDate: e.invoiceDate, pricing,
      createdBy: 'system', createdAt: at(e.invoiceDate, '00:30'),
    });
    db.invoices.push(inv);
    const kind = typeof e.fate === 'object' && e.fate ? e.fate.kind : e.fate ?? defaultFate(e);
    if (kind === 'cancelled') {
      const cancelOn = minDate(addDays(e.invoiceDate, 1), T);
      Object.assign(inv, { status: 'cancelled', isVoid: true, confirmedAt: at(e.invoiceDate, '11:00'), cancelledAt: at(cancelOn, '10:00'), notes: 'Wrong seat count; re-issued', updatedAt: at(cancelOn, '10:00') });
      continue; // a cancelled invoice gives its discount use back
    }
    reserveDiscountUses(inv.appliedDiscountIds);
    if (kind === 'draft') continue;

    const confirmOn = minDate(addDays(e.invoiceDate, int(0, 1)), T);
    Object.assign(inv, { status: 'confirmed', confirmedAt: at(confirmOn, '11:00'), sentAt: at(confirmOn, '11:30'), sentCount: 1, updatedAt: at(confirmOn, '11:30') });
    if (kind === 'overdue') {
      const reminder = minDate(addDays(inv.dueDate, 3), T);
      Object.assign(inv, { sentAt: at(reminder, '10:00'), sentCount: 2, updatedAt: at(reminder, '10:00') });
    } else if (kind === 'partial') {
      const amount = e.fate?.amount ?? Math.max(10000, Math.round((inv.total * int(30, 60)) / 100 / 10000) * 10000);
      const date = e.fate?.payOn ?? clampDate(addDays(e.invoiceDate, int(3, 20)), e.invoiceDate, T);
      if (amount < inv.total) addPayment(inv, amount, date, e.fate?.method, e.fate?.note);
    } else if (kind === 'paid') {
      const term = sub.paymentTermDays;
      const first = clampDate(addDays(e.invoiceDate, int(0, Math.max(2, term + 5))), e.invoiceDate, T);
      if (chance(0.15) && inv.total > 20000) {
        const half = Math.round(inv.total / 2 / 100) * 100;
        addPayment(inv, half, first);
        addPayment(inv, inv.total - half, clampDate(addDays(first, int(3, 15)), first, T));
      } else addPayment(inv, inv.total, first);
      inv.status = 'paid';
      inv.paidAt = db.payments[db.payments.length - 1].createdAt;
    }
  }

  function defaultFate(e) {
    const due = addDays(e.invoiceDate, e.sub.paymentTermDays);
    if (e.isLast && e.invoiceDate >= D(-2)) return chance(0.6) ? 'draft' : 'confirmed';
    if (due >= T) return chance(0.4) ? 'paid' : 'confirmed';
    const r = rnd();
    return r < 0.9 ? 'paid' : r < 0.95 ? 'partial' : 'confirmed';
  }

  // ================================================================ derived values
  for (const { sub } of subs) Object.assign(sub, recurringAmounts(priceLines(sub.lines, T)));
  // Keep the "exhausted" discount exhausted whatever the random mix produced.
  if (storageDeal.usedCount > 0 && storageDeal.usedCount < storageDeal.usageLimit) storageDeal.usageLimit = storageDeal.usedCount;

  return {
    users: db.users.length,
    customers: db.customers.length,
    products: db.products.length,
    plans: db.plans.length,
    subscriptions: db.subscriptions.length,
    invoices: db.invoices.length,
    payments: db.payments.length,
  };
}
