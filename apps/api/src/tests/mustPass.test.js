const assert = require("assert");
const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const { seedDatabase } = require("../seed/seed");
const app = require("../app");

async function runTests() {
  await connectDB();
  await seedDatabase({ isLarge: false });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  async function api(path, { method = "GET", token = null, body = undefined } = {}) {
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    return { status: res.status, data };
  }

  try {
    console.log("[TEST] Running Page 54 Must-Pass Checks...");

    // 1. Sign-up with existing email in different case returns 409 EMAIL_TAKEN
    const dupRes = await api("/auth/customer/signup", {
      method: "POST",
      body: {
        name: "Asha Duplicate",
        email: "ASHA@kite.test",
        password: "Kite@2026!",
      },
    });
    assert.strictEqual(dupRes.status, 409);
    assert.strictEqual(dupRes.data.error.code, "EMAIL_TAKEN");
    console.log("  [✓] 1. Case-insensitive duplicate email returns 409 EMAIL_TAKEN");

    // 2. Sign-up with "role": "admin" still creates a customer
    const signupRes = await api("/auth/customer/signup", {
      method: "POST",
      body: {
        name: "Test Customer",
        companyName: "Test Corp",
        email: "testcust@corp.test",
        password: "Kite@2026!",
        role: "admin",
      },
    });
    assert.strictEqual(signupRes.status, 201);
    assert.strictEqual(signupRes.data.data.user.role, "customer");
    console.log("  [✓] 2. Sign-up with role: 'admin' still creates a customer");

    // 3. Staff account on /auth/customer/login and Customer on /auth/staff/login get 401 INVALID_CREDENTIALS
    const wrongPortal1 = await api("/auth/customer/login", {
      method: "POST",
      body: { email: "admin@brightloop.test", password: "Admin@2026!" },
    });
    const wrongPortal2 = await api("/auth/staff/login", {
      method: "POST",
      body: { email: "asha@kite.test", password: "Customer@2026!" },
    });
    assert.strictEqual(wrongPortal1.status, 401);
    assert.strictEqual(wrongPortal2.status, 401);
    assert.strictEqual(wrongPortal1.data.error.code, "INVALID_CREDENTIALS");
    console.log("  [✓] 3. Wrong login portal returns 401 INVALID_CREDENTIALS");

    // 4. Password Short1!A (8 chars) is rejected; Kite@2026! is accepted
    const shortPass = await api("/auth/customer/signup", {
      method: "POST",
      body: {
        name: "Short Pass",
        email: "short@corp.test",
        password: "Short1!A",
      },
    });
    assert.strictEqual(shortPass.status, 400);
    assert.strictEqual(shortPass.data.error.code, "VALIDATION_ERROR");
    console.log("  [✓] 4. 8-char password Short1!A is rejected");

    // Login as Admin, Staff, Finance, Customer A (Acme), Customer B (Kite)
    const adminLogin = await api("/auth/staff/login", {
      method: "POST",
      body: { email: "admin@brightloop.test", password: "Admin@2026!" },
    });
    const staffLogin = await api("/auth/staff/login", {
      method: "POST",
      body: { email: "riya@brightloop.test", password: "Staff@2026!" },
    });
    const financeLogin = await api("/auth/staff/login", {
      method: "POST",
      body: { email: "meera@brightloop.test", password: "Finance@2026!" },
    });
    const acmeLogin = await api("/auth/customer/login", {
      method: "POST",
      body: { email: "billing@acme.test", password: "Customer@2026!" },
    });
    const kiteLogin = await api("/auth/customer/login", {
      method: "POST",
      body: { email: "asha@kite.test", password: "Customer@2026!" },
    });

    const adminToken = adminLogin.data.data.token;
    const staffToken = staffLogin.data.data.token;
    const financeToken = financeLogin.data.data.token;
    const acmeToken = acmeLogin.data.data.token;
    const kiteToken = kiteLogin.data.data.token;

    // 5. Temporary password user gets 403 PASSWORD_CHANGE_REQUIRED except /auth/me & /auth/change-password
    const tempUserCreate = await api("/users", {
      method: "POST",
      token: adminToken,
      body: {
        name: "Temp Staff",
        email: "tempstaff@brightloop.test",
        role: "staff",
        temporaryPassword: "Welcome@2026!",
      },
    });
    assert.strictEqual(tempUserCreate.status, 201);

    const tempLogin = await api("/auth/staff/login", {
      method: "POST",
      body: { email: "tempstaff@brightloop.test", password: "Welcome@2026!" },
    });
    const tempToken = tempLogin.data.data.token;

    const blockedCall = await api("/products", { token: tempToken });
    assert.strictEqual(blockedCall.status, 403);
    assert.strictEqual(blockedCall.data.error.code, "PASSWORD_CHANGE_REQUIRED");
    console.log("  [✓] 5. Temporary password user gets 403 PASSWORD_CHANGE_REQUIRED");

    // 6. After password change, old token gets 401
    const changedRes = await api("/auth/change-password", {
      method: "POST",
      token: tempToken,
      body: {
        currentPassword: "Welcome@2026!",
        newPassword: "NewPass@2026!",
      },
    });
    assert.strictEqual(changedRes.status, 200);
    const oldTokenCheck = await api("/auth/me", { token: tempToken });
    assert.strictEqual(oldTokenCheck.status, 401);
    console.log("  [✓] 6. Old JWT token rejected with 401 after password change");

    // 7. Staff calling POST /discounts gets 403; Finance calling POST /subscriptions gets 403
    const staffDiscount = await api("/discounts", {
      method: "POST",
      token: staffToken,
      body: { name: "No" },
    });
    const finSub = await api("/subscriptions", {
      method: "POST",
      token: financeToken,
      body: {},
    });
    assert.strictEqual(staffDiscount.status, 403);
    assert.strictEqual(finSub.status, 403);
    console.log("  [✓] 7. Role boundaries enforced (403 FORBIDDEN)");

    // 8. Test Case 1 total = 12814800 paise; Test Case 2 total = 295000 paise
    const subsList = await api("/subscriptions", { token: adminToken });
    const tc1Sub = subsList.data.data.find((s) => s.number.endsWith("/0001"));
    const tc2Sub = subsList.data.data.find((s) => s.number.endsWith("/0002"));
    assert.strictEqual(tc1Sub.recurringTotal, 12814800);
    assert.strictEqual(tc2Sub.recurringTotal, 295000);
    console.log("  [✓] 8. Pricing Engine Test Case 1 = 12814800 & Test Case 2 = 295000 paise");

    // 9. Customer A requesting Customer B's invoice gets 404
    const kiteInvs = await api("/portal/invoices", { token: kiteToken });
    const kiteInvId = kiteInvs.data.data[0].id;
    const probeRes = await api(`/portal/invoices/${kiteInvId}`, { token: acmeToken });
    assert.strictEqual(probeRes.status, 404);
    console.log("  [✓] 9. Customer A requesting Customer B's invoice gets 404 NOT_FOUND");

    // 10. Running billing twice for the same date: second run creates 0 invoices
    const run1 = await api("/billing/run", {
      method: "POST",
      token: staffToken,
      body: {},
    });
    assert.strictEqual(run1.status, 200);
    assert.ok(run1.data.data.created >= 2);

    const run2 = await api("/billing/run", {
      method: "POST",
      token: staffToken,
      body: {},
    });
    assert.strictEqual(run2.status, 200);
    assert.strictEqual(run2.data.data.created, 0);
    console.log("  [✓] 10. Running billing twice creates 0 duplicate invoices");

    // 11. Overpayment returns 409 OVERPAYMENT; exact balance payment marks invoice Paid
    const overPay = await api("/payments", {
      method: "POST",
      token: financeToken,
      body: {
        invoiceId: kiteInvId,
        method: "upi",
        amount: 99999999,
      },
    });
    assert.strictEqual(overPay.status, 409);
    assert.strictEqual(overPay.data.error.code, "OVERPAYMENT");

    const exactPay = await api("/payments", {
      method: "POST",
      token: financeToken,
      body: {
        invoiceId: kiteInvId,
        method: "upi",
        amount: 295000,
      },
    });
    assert.strictEqual(exactPay.status, 201);
    assert.strictEqual(exactPay.data.data.invoice.status, "paid");
    assert.strictEqual(exactPay.data.data.invoice.balance, 0);
    console.log("  [✓] 11. Overpayment returns 409 OVERPAYMENT; exact payment marks invoice Paid");

    console.log("\n[ALL MUST-PASS CHECKS PASSED SUCCESSFULLY!]");
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("[TEST FAILED]", err);
  process.exit(1);
});
