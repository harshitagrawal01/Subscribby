#!/usr/bin/env node
// Smoke test against a RUNNING mock (it starts nothing itself):
//   npm start            # in one terminal
//   npm run smoke        # in another (BASE_URL defaults to http://localhost:4000/api/v1)
// It resets the mock data first and again at the end (POST /__mock/reset).
import { readFile } from 'node:fs/promises';

const BASE = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 4000}/api/v1`).replace(/\/+$/, '');
let passed = 0;
let failed = 0;

async function call(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* CSV */
  }
  return { status: res.status, json, text, headers: res.headers };
}

function check(name, ok, extra = '') {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} ${extra}`);
  }
}
const expectStatus = (name, r, status, code) =>
  check(name, r.status === status && (!code || r.json?.error?.code === code), `→ got ${r.status} ${JSON.stringify(r.json?.error ?? r.json)?.slice(0, 300)}`);

async function login(kind, email, password) {
  const r = await call('POST', `/auth/${kind}/login`, { body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} failed: ${r.status} ${r.text}`);
  return r.json.data.token;
}

function csvFile(name, content) {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'text/csv' }), name);
  return form;
}

async function main() {
  console.log(`Smoke test against ${BASE}\n`);
  await call('POST', '/__mock/reset');

  console.log('Health & auth');
  const health = await call('GET', '/health');
  check('GET /health', health.status === 200 && health.json.status === 'ok');
  const admin = await login('staff', 'admin@brightloop.test', 'Admin@2026!');
  const staff = await login('staff', 'riya@brightloop.test', 'Staff@2026!');
  const finance = await login('staff', 'meera@brightloop.test', 'Finance@2026!');
  const acme = await login('customer', 'billing@acme.test', 'Customer@2026!');
  const kite = await login('customer', 'asha@kite.test', 'Customer@2026!');
  check('all five seeded accounts log in', !!(admin && staff && finance && acme && kite));
  expectStatus('staff account on customer login → 401', await call('POST', '/auth/customer/login', { body: { email: 'riya@brightloop.test', password: 'Staff@2026!' } }), 401, 'INVALID_CREDENTIALS');
  expectStatus('customer account on staff login → 401', await call('POST', '/auth/staff/login', { body: { email: 'asha@kite.test', password: 'Customer@2026!' } }), 401, 'INVALID_CREDENTIALS');
  expectStatus('wrong password → 401', await call('POST', '/auth/staff/login', { body: { email: 'admin@brightloop.test', password: 'nope' } }), 401, 'INVALID_CREDENTIALS');
  expectStatus('disabled staff → 403', await call('POST', '/auth/staff/login', { body: { email: 'karan@brightloop.test', password: 'Staff@2026!' } }), 403, 'ACCOUNT_DISABLED');
  expectStatus('no token → 401', await call('GET', '/meta'), 401, 'UNAUTHENTICATED');
  const meta = await call('GET', '/meta', { token: staff });
  check('GET /meta', meta.status === 200 && meta.json.data.company.name === 'Subscribby');

  console.log('\nForced password change');
  const newbie = await login('staff', 'new.staff@brightloop.test', 'Welcome@2026!');
  expectStatus('temp-password user → 403 on /customers', await call('GET', '/customers', { token: newbie }), 403, 'PASSWORD_CHANGE_REQUIRED');
  const meNew = await call('GET', '/auth/me', { token: newbie });
  check('…but GET /auth/me works', meNew.status === 200 && meNew.json.data.mustChangePassword === true);
  expectStatus('change-password with wrong current → 400', await call('POST', '/auth/change-password', { token: newbie, body: { currentPassword: 'x', newPassword: 'Better@2026!' } }), 400, 'VALIDATION_ERROR');
  const changed = await call('POST', '/auth/change-password', { token: newbie, body: { currentPassword: 'Welcome@2026!', newPassword: 'Better@2026!' } });
  check('change-password returns a fresh token', changed.status === 200 && changed.json.data.user.mustChangePassword === false);
  expectStatus('old token after change → 401', await call('GET', '/auth/me', { token: newbie }), 401, 'UNAUTHENTICATED');
  check('new token works', (await call('GET', '/meta', { token: changed.json.data.token })).status === 200);

  console.log('\nSign-up');
  const weak = await call('POST', '/auth/customer/signup', { body: { name: 'Test', email: 'weak@x.test', password: 'Short1!A' } });
  check('password Short1!A rejected with per-rule details', weak.status === 400 && weak.json.error.details.some((d) => d.field === 'password'));
  const signup = await call('POST', '/auth/customer/signup', { body: { name: 'Dev Patel', companyName: 'Patel Bakers', email: 'Dev@PatelBakers.test', password: 'Kite@2026!', role: 'admin' } });
  check('sign-up creates a customer (role ignored)', signup.status === 201 && signup.json.data.user.role === 'customer' && signup.json.data.user.email === 'dev@patelbakers.test');
  expectStatus('duplicate email in other case → 409', await call('POST', '/auth/customer/signup', { body: { name: 'Asha', email: 'ASHA@kite.test', password: 'Kite@2026!' } }), 409, 'EMAIL_TAKEN');

  console.log('\nForgot / reset password');
  const unknown = await call('POST', '/auth/forgot-password', { body: { email: 'nobody@x.test', portal: 'staff' } });
  check('unknown email still 200, no link', unknown.status === 200 && unknown.json.data.ok && !unknown.json.data.devResetUrl);
  const forgot = await call('POST', '/auth/forgot-password', { body: { email: 'riya@brightloop.test', portal: 'staff' } });
  const url = forgot.json?.data?.devResetUrl || '';
  const staffBase = '/' + (process.env.STAFF_PORTAL_PATH || '/staff').replace(/^\/+|\/+$/g, '');
  check(`staff reset link goes to ${staffBase}/reset-password`, url.includes(`${staffBase}/reset-password?token=`));
  const emails = await call('GET', '/__mock/emails?type=password_reset');
  check('reset email captured', emails.json.data[0]?.to.email === 'riya@brightloop.test');
  const resetToken = new URL(url).searchParams.get('token');
  const reset = await call('POST', '/auth/reset-password', { body: { token: resetToken, newPassword: 'Fresh@2026!' } });
  check('reset-password works', reset.status === 200 && reset.json.data.user.role === 'staff');
  expectStatus('reset link works only once', await call('POST', '/auth/reset-password', { body: { token: resetToken, newPassword: 'Fresh@2026!' } }), 400, 'TOKEN_INVALID');
  expectStatus('old token after reset → 401', await call('GET', '/meta', { token: staff }), 401, 'UNAUTHENTICATED');
  const staff2 = reset.json.data.token;

  console.log('\nLists');
  for (const path of ['/products', '/plans', '/quotation-templates', '/taxes', '/discounts', '/customers', '/subscriptions', '/invoices', '/payments']) {
    const r = await call('GET', `${path}?limit=5`, { token: admin });
    check(`GET ${path} has data + meta`, r.status === 200 && Array.isArray(r.json.data) && r.json.meta.total > 0 && r.json.meta.limit === 5);
  }
  const users = await call('GET', '/users?role=customer', { token: admin });
  check('GET /users?role=customer', users.status === 200 && users.json.data.every((u) => u.role === 'customer'));
  const discounts = (await call('GET', '/discounts?limit=100', { token: finance })).json.data;
  const states = new Set(discounts.map((d) => d.state));
  check('discount states: running, expired, exhausted, scheduled, inactive', ['running', 'expired', 'exhausted', 'scheduled', 'inactive'].every((s) => states.has(s)), [...states].join(','));
  const subsList = await call('GET', '/subscriptions?status=active', { token: finance });
  check('subscriptions statusCounts', Object.keys(subsList.json.meta.statusCounts).length === 6);
  const overdue = await call('GET', '/invoices?overdue=true&sort=dueDate&limit=100', { token: finance });
  const days = overdue.json.data.map((i) => i.daysOverdue);
  check('overdue invoices include 5, 29 and 75 days', [5, 29, 75].every((d) => days.includes(d)), days.join(','));
  check('invoice statusCounts include overdue', overdue.json.meta.statusCounts.overdue === overdue.json.meta.total);

  console.log('\nPricing test cases');
  const acmeSub = (await call('GET', '/subscriptions?search=Acme&status=active&planId=' + (await call('GET', '/plans?search=Pro%20Yearly', { token: admin })).json.data[0].id, { token: admin })).json.data[0];
  const acmeDetail = (await call('GET', `/subscriptions/${acmeSub.id}`, { token: admin })).json.data;
  check('test case 1 (Acme, Pro Yearly) total = 12814800', acmeDetail.totals.total === 12814800, `got ${acmeDetail.totals.total}`);
  const kiteSub = (await call('GET', '/subscriptions?search=Kite&status=active', { token: admin })).json.data[0];
  const kiteDetail = (await call('GET', `/subscriptions/${kiteSub.id}`, { token: admin })).json.data;
  check('test case 2 (Kite, Basic Monthly) total = 295000', kiteDetail.totals.total === 295000, `got ${kiteDetail.totals.total}`);
  const finDetail = (await call('GET', `/subscriptions/${acmeSub.id}`, { token: finance })).json.data;
  check('finance gets empty allowedActions', Array.isArray(finDetail.allowedActions) && finDetail.allowedActions.length === 0);
  const preview = await call('POST', '/subscriptions/preview', { token: staff2, body: { planId: acmeDetail.plan.id, lines: acmeDetail.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })) } });
  check('preview reproduces 12814800', preview.status === 200 && preview.json.data.totals.total === 12814800);

  console.log('\nRoles');
  expectStatus('finance POST /subscriptions → 403', await call('POST', '/subscriptions', { token: finance, body: {} }), 403, 'FORBIDDEN');
  expectStatus('staff POST /discounts → 403', await call('POST', '/discounts', { token: staff2, body: {} }), 403, 'FORBIDDEN');
  expectStatus('customer GET /invoices → 403', await call('GET', '/invoices', { token: kite }), 403, 'FORBIDDEN');
  expectStatus('finance real billing run → 403', await call('POST', '/billing/run', { token: finance, body: {} }), 403, 'FORBIDDEN');

  console.log('\nBilling run');
  const dry = await call('POST', '/billing/run', { token: finance, body: { dryRun: true } });
  check('finance dry run works and writes nothing', dry.status === 200 && dry.json.data.created > 0 && dry.json.data.invoiceIds.length === 0);
  const run1 = await call('POST', '/billing/run', { token: staff2, body: {} });
  check('first run creates the same number as the dry run', run1.status === 200 && run1.json.data.created === dry.json.data.created, JSON.stringify(run1.json.data));
  check('lifecycle counts (expired quote, activation, auto-close)', run1.json.data.lifecycle.quotationsExpired >= 1 && run1.json.data.lifecycle.activated >= 1 && run1.json.data.lifecycle.autoClosed >= 1, JSON.stringify(run1.json.data.lifecycle));
  const run2 = await call('POST', '/billing/run', { token: staff2, body: {} });
  check('second run creates 0', run2.json.data.created === 0);
  const last = await call('GET', '/billing/last-run', { token: finance });
  check('GET /billing/last-run', last.status === 200 && last.json.data.created === 0);
  const catchup = (await call('GET', '/subscriptions?search=Bluewave', { token: admin })).json.data[0];
  const catchupInvoices = (await call('GET', `/invoices?subscriptionId=${catchup.id}&invoiceFrom=${run1.json.data.asOfDate}`, { token: admin })).json.data;
  check('subscription 3 periods behind got 3 invoices', catchupInvoices.length === 3, `got ${catchupInvoices.length}`);

  console.log('\nInvoices & payments');
  const draftId = run1.json.data.invoiceIds[0];
  expectStatus('send a draft → 409', await call('POST', `/invoices/${draftId}/send`, { token: staff2 }), 409, 'INVALID_TRANSITION');
  const conf = await call('POST', `/invoices/${draftId}/confirm`, { token: staff2 });
  check('confirm draft', conf.status === 200 && conf.json.data.status === 'confirmed');
  const sent = await call('POST', `/invoices/${draftId}/send`, { token: finance });
  check('finance can send', sent.status === 200 && sent.json.data.sentCount === 1);
  const bal = conf.json.data.balance;
  expectStatus('overpayment → 409', await call('POST', '/payments', { token: finance, body: { invoiceId: draftId, method: 'upi', amount: bal + 1 } }), 409, 'OVERPAYMENT');
  expectStatus('fractional amount → 400', await call('POST', '/payments', { token: finance, body: { invoiceId: draftId, method: 'upi', amount: 45.6 } }), 400, 'VALIDATION_ERROR');
  const part = await call('POST', '/payments', { token: finance, body: { invoiceId: draftId, method: 'cash', amount: 100 } });
  check('part payment', part.status === 201 && part.json.data.invoice.balance === bal - 100 && part.json.data.invoice.status === 'confirmed');
  const full = await call('POST', '/payments', { token: finance, body: { invoiceId: draftId, method: 'bank_transfer', amount: bal - 100, note: 'UTR 1' } });
  check('payment equal to balance marks it Paid', full.status === 201 && full.json.data.invoice.status === 'paid' && full.json.data.invoice.balance === 0);
  expectStatus('finance cannot delete a payment', await call('DELETE', `/payments/${full.json.data.payment.id}`, { token: finance }), 403, 'FORBIDDEN');
  const del = await call('DELETE', `/payments/${full.json.data.payment.id}`, { token: admin });
  const afterDel = (await call('GET', `/invoices/${draftId}`, { token: admin })).json.data;
  check('admin deletes payment → invoice back to confirmed', del.status === 204 && afterDel.status === 'confirmed' && afterDel.balance === bal - 100);
  expectStatus('cancel invoice with payments → 409', await call('POST', `/invoices/${draftId}/cancel`, { token: staff2 }), 409, 'HAS_PAYMENTS');
  const bulk = await call('POST', '/invoices/bulk/confirm', { token: staff2, body: { ids: run1.json.data.invoiceIds.slice(1, 3).concat(draftId) } });
  check('bulk confirm reports per-item results', bulk.status === 200 && bulk.json.data.succeeded.length === 2 && bulk.json.data.failed.length === 1);

  console.log('\nCancel + rebill');
  const sub = (await call('GET', `/subscriptions/${catchup.id}`, { token: admin })).json.data;
  const latestId = sub.invoiceSummary.lastInvoice.id;
  const latest = (await call('GET', `/invoices/${latestId}`, { token: admin })).json.data;
  await call('POST', `/invoices/${latestId}/cancel`, { token: staff2, body: {} });
  const subAfter = (await call('GET', `/subscriptions/${catchup.id}`, { token: admin })).json.data;
  check('cancelling the latest invoice moves nextInvoiceDate back', subAfter.nextInvoiceDate === latest.periodStart);
  const run3 = await call('POST', '/billing/run', { token: staff2, body: {} });
  check('next run bills that period again', run3.json.data.created === 1);

  console.log('\nSubscription actions');
  const quote = (await call('GET', '/subscriptions?search=Kite&status=quotation', { token: admin })).json.data[0];
  expectStatus('Acme cannot see Kite quotation', await call('GET', `/portal/subscriptions/${quote.id}`, { token: acme }), 404, 'NOT_FOUND');
  const accepted = await call('POST', `/portal/subscriptions/${quote.id}/accept`, { token: kite });
  check('Kite accepts its quotation in the portal', accepted.status === 200 && accepted.json.data.status === 'confirmed' && !('history' in accepted.json.data));
  expectStatus('pause a Pro Yearly → PLAN_RULE', await call('POST', `/subscriptions/${acmeSub.id}/pause`, { token: staff2 }), 409, 'PLAN_RULE');
  expectStatus('self-service off → 403', await call('POST', `/portal/subscriptions/${kiteSub.id}/pause`, { token: kite }), 403, 'FORBIDDEN');
  const created = await call('POST', '/subscriptions', { token: staff2, body: { customerId: acmeDetail.customer.id, templateId: acmeDetail.template.id, startDate: run1.json.data.asOfDate } });
  check('create from template → draft with number', created.status === 201 && created.json.data.status === 'draft' && /^SUB\/\d{4}\/\d{4}$/.test(created.json.data.number));
  expectStatus('BELOW_MIN_QUANTITY', await call('PATCH', `/subscriptions/${created.json.data.id}`, { token: staff2, body: { lines: [{ productId: acmeDetail.lines[0].productId, quantity: 2 }] } }), 409, 'BELOW_MIN_QUANTITY');
  expectStatus('status in PATCH → 400', await call('PATCH', `/subscriptions/${created.json.data.id}`, { token: staff2, body: { status: 'active' } }), 400, 'VALIDATION_ERROR');
  const sentQ = await call('POST', `/subscriptions/${created.json.data.id}/send`, { token: staff2 });
  check('send → quotation', sentQ.status === 200 && sentQ.json.data.status === 'quotation' && sentQ.json.data.quotationValidUntil);
  const confQ = await call('POST', `/subscriptions/${created.json.data.id}/confirm`, { token: staff2 });
  check('confirm with start today → active', confQ.json.data.status === 'active' && confQ.json.data.allowedActions.includes('createInvoice'));
  const now = await call('POST', `/subscriptions/${created.json.data.id}/invoices`, { token: staff2 });
  check('create invoice now → 201 invoice', now.status === 201 && now.json.data.status === 'draft');

  console.log('\nPortal');
  const acmeInv = (await call('GET', '/portal/invoices?limit=100', { token: acme })).json.data;
  check('portal invoices never include drafts', acmeInv.length > 0 && acmeInv.every((i) => i.status !== 'draft'));
  const kiteInv = (await call('GET', '/portal/invoices', { token: kite })).json.data[0];
  expectStatus("Acme gets 404 on Kite's invoice", await call('GET', `/portal/invoices/${kiteInv.id}`, { token: acme }), 404, 'NOT_FOUND');
  const ps = await call('GET', '/portal/summary', { token: acme });
  check('portal summary', ps.status === 200 && ps.json.data.activeSubscriptions >= 2 && ps.json.data.overdueCount >= 1);

  console.log('\nUsers');
  const adminMe = (await call('GET', '/auth/me', { token: admin })).json.data;
  expectStatus('admin disabling themselves → LAST_ADMIN', await call('PATCH', `/users/${adminMe.id}`, { token: admin, body: { status: 'disabled' } }), 409, 'LAST_ADMIN');

  console.log('\nCSV import');
  const bad = await call('POST', '/users/import?dryRun=true', { token: admin, form: csvFile('bad.csv', await readFile(new URL('../../../../docs/samples/sample-users-invalid.csv', import.meta.url))) });
  check('dry run with bad rows → 200, invalid > 0, created 0', bad.status === 200 && bad.json.data.invalid > 0 && bad.json.data.created === 0);
  check('row numbers start at 2', bad.json.data.rows[0].row === 2);
  const badReal = await call('POST', '/users/import?dryRun=false', { token: admin, form: csvFile('bad.csv', await readFile(new URL('../../../../docs/samples/sample-users-invalid.csv', import.meta.url))) });
  check('real import of bad file creates 0', badReal.status === 200 && badReal.json.data.created === 0);
  const goodBuf = await readFile(new URL('../../../../docs/samples/sample-users.csv', import.meta.url));
  const goodDry = await call('POST', '/users/import?dryRun=true', { token: admin, form: csvFile('good.csv', goodBuf) });
  check('good file preview: all valid', goodDry.status === 200 && goodDry.json.data.invalid === 0 && goodDry.json.data.created === 0);
  const good = await call('POST', '/users/import?dryRun=false', { token: admin, form: csvFile('good.csv', goodBuf) });
  check('good file import → 201 and all created', good.status === 201 && good.json.data.created === good.json.data.total);
  expectStatus('non-CSV file → IMPORT_INVALID', await call('POST', '/users/import', { token: admin, form: csvFile('x.txt', 'a') }), 400, 'IMPORT_INVALID');
  expectStatus('missing columns → IMPORT_INVALID', await call('POST', '/users/import', { token: admin, form: csvFile('x.csv', 'name,email\nA,b@c.test\n') }), 400, 'IMPORT_INVALID');
  const tpl = await call('GET', '/users/import/template', { token: admin });
  check('import template is CSV', tpl.status === 200 && tpl.text.startsWith('name,email,temporary_password,access_level'));


  console.log('\nReports');
  const summary = await call('GET', '/reports/summary', { token: finance });
  check('reports summary', summary.status === 200 && summary.json.data.activeSubscriptions > 0 && summary.json.data.mrr > 0);
  const rbm = await call('GET', '/reports/revenue-by-month', { token: finance });
  check('revenue-by-month (6 months)', rbm.status === 200 && rbm.json.data.length === 6);
  const aging = await call('GET', '/reports/aging', { token: finance });
  check('aging has 5 buckets', aging.status === 200 && aging.json.data.length === 5);
  const byPlan = await call('GET', '/reports/subscriptions-by-plan', { token: finance });
  check('subscriptions-by-plan', byPlan.status === 200 && byPlan.json.data.length > 0);
  const exp = await call('GET', '/reports/export?type=invoices&status=paid', { token: finance });
  check('CSV export', exp.status === 200 && exp.headers.get('content-disposition')?.includes('attachment') && /\d+\.\d{2}/.test(exp.text));
  expectStatus('customer on reports → 403', await call('GET', '/reports/summary', { token: kite }), 403, 'FORBIDDEN');

  await call('POST', '/__mock/reset');
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
