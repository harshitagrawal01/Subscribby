const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { connectDB } = require("../config/db");
const { Counter } = require("../models/Counter");
const User = require("../models/User");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const Plan = require("../models/Plan");
const QuotationTemplate = require("../models/QuotationTemplate");
const Tax = require("../models/Tax");
const { Discount } = require("../models/Discount");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const BillingRun = require("../models/BillingRun");
const { priceLines } = require("../services/pricing");
const { todayIST, addDaysStr } = require("../utils/date");

async function seedDatabase({ isLarge = false } = {}) {
  console.log(`[SEED] Wiping and seeding database (large=${isLarge})...`);

  await Promise.all([
    Counter.deleteMany({}),
    User.deleteMany({}),
    Customer.deleteMany({}),
    Product.deleteMany({}),
    Plan.deleteMany({}),
    QuotationTemplate.deleteMany({}),
    Tax.deleteMany({}),
    Discount.deleteMany({}),
    Subscription.deleteMany({}),
    Invoice.deleteMany({}),
    Payment.deleteMany({}),
    BillingRun.deleteMany({}),
  ]);

  const today = todayIST();
  const year = parseInt(today.slice(0, 4), 10);

  // 1. Seed Accounts (Page 51) - skip forced password change
  const [adminHash, staffHash, financeHash, custHash] = await Promise.all([
    bcrypt.hash("Admin@2026!", 10),
    bcrypt.hash("Staff@2026!", 10),
    bcrypt.hash("Finance@2026!", 10),
    bcrypt.hash("Customer@2026!", 10),
  ]);

  const [adminUser, staffUser, financeUser] = await User.create([
    {
      name: "Arjun Mehta (Admin)",
      email: "admin@brightloop.test",
      passwordHash: adminHash,
      role: "admin",
      status: "active",
      mustChangePassword: false,
      createdVia: "seed",
    },
    {
      name: "Riya Sharma",
      email: "riya@brightloop.test",
      passwordHash: staffHash,
      role: "staff",
      status: "active",
      mustChangePassword: false,
      createdVia: "seed",
    },
    {
      name: "Meera Nair",
      email: "meera@brightloop.test",
      passwordHash: financeHash,
      role: "finance",
      status: "active",
      mustChangePassword: false,
      createdVia: "seed",
    },
  ]);

  // 2. Customers (Acme Ltd, Kite Stores + 48 more)
  const acmeCustomer = await Customer.create({
    name: "Acme Ltd",
    contactName: "Vikram Iyer",
    email: "billing@acme.test",
    phone: "+91 98450 00001",
    billingAddress: {
      line1: "12 MG Road",
      line2: "",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      country: "IN",
    },
    taxId: "29ABCDE1234F1Z5",
    isActive: true,
  });

  const kiteCustomer = await Customer.create({
    name: "Kite Stores",
    contactName: "Asha Rao",
    email: "asha@kite.test",
    phone: "+91 98220 00002",
    billingAddress: {
      line1: "45 FC Road",
      line2: "",
      city: "Pune",
      state: "Maharashtra",
      postalCode: "411004",
      country: "IN",
    },
    taxId: "27KITES5678G1Z2",
    isActive: true,
  });

  const [acmeUser, kiteUser] = await User.create([
    {
      name: "Vikram Iyer",
      email: "billing@acme.test",
      passwordHash: custHash,
      role: "customer",
      status: "active",
      mustChangePassword: false,
      createdVia: "seed",
      customerId: acmeCustomer._id,
    },
    {
      name: "Asha Rao",
      email: "asha@kite.test",
      passwordHash: custHash,
      role: "customer",
      status: "active",
      mustChangePassword: false,
      createdVia: "seed",
      customerId: kiteCustomer._id,
    },
  ]);

  acmeCustomer.userId = acmeUser._id;
  kiteCustomer.userId = kiteUser._id;
  await Promise.all([acmeCustomer.save(), kiteCustomer.save()]);

  const extraCustomers = [];
  for (let i = 3; i <= 50; i++) {
    extraCustomers.push({
      name: `BrightClient Corp ${i}`,
      contactName: `Contact Person ${i}`,
      email: `client${i}@company.test`,
      phone: `+91 98000 ${String(i).padStart(5, "0")}`,
      billingAddress: {
        line1: `${i} Cyber Park`,
        city: i % 2 === 0 ? "Mumbai" : "Bengaluru",
        state: i % 2 === 0 ? "Maharashtra" : "Karnataka",
        postalCode: "400001",
        country: "IN",
      },
      taxId: `29CORP${String(i).padStart(4, "0")}F1Z5`,
      isActive: true,
    });
  }
  const createdExtraCustomers = await Customer.insertMany(extraCustomers);
  const allCustomers = [acmeCustomer, kiteCustomer, ...createdExtraCustomers];

  // 3. Products (Page 51)
  const odooVariantId = new mongoose.Types.ObjectId();
  const genericVariantId = new mongoose.Types.ObjectId();

  const [crmProduct, analyticsProduct, storageProduct, onboardingProduct] =
    await Product.create([
      {
        name: "Brightloop CRM",
        type: "service",
        salesPrice: 400000, // ₹4,000
        costPrice: 90000,
        notes: "Core CRM seat",
        variants: [
          {
            _id: odooVariantId,
            attribute: "Brand",
            value: "Odoo",
            extraPrice: 56000, // +₹560
          },
          {
            _id: genericVariantId,
            attribute: "Brand",
            value: "Generic",
            extraPrice: 0,
          },
        ],
        isActive: true,
      },
      {
        name: "Analytics add-on",
        type: "addon",
        salesPrice: 600000, // ₹6,000
        costPrice: 120000,
        notes: "Advanced BI reporting",
        variants: [],
        isActive: true,
      },
      {
        name: "Extra storage add-on",
        type: "addon",
        salesPrice: 150000, // ₹1,500
        costPrice: 30000,
        notes: "100 GB extra cloud storage",
        variants: [],
        isActive: true,
      },
      {
        name: "Onboarding kit",
        type: "physical",
        salesPrice: 250000, // ₹2,500
        costPrice: 100000,
        notes: "Welcome hardware & handbook",
        variants: [],
        isActive: true,
      },
    ]);

  // 4. Plans (at least one per billingPeriod: daily, weekly, monthly, yearly)
  const [proYearlyPlan, basicMonthlyPlan, weeklyPlan, dailyPlan] = await Plan.create([
    {
      name: "Pro Yearly",
      productId: crmProduct._id,
      price: 400000, // ₹4,000 per seat
      billingPeriod: "yearly",
      minQuantity: 10,
      availableFrom: "2025-01-01",
      availableUntil: "2028-12-31",
      rules: {
        autoClose: true,
        closable: false,
        pausable: false,
        renewable: true,
      },
      description: "Yearly contract for teams of 10+",
      isActive: true,
    },
    {
      name: "Basic Monthly",
      productId: crmProduct._id,
      price: 300000, // ₹3,000
      billingPeriod: "monthly",
      minQuantity: 1,
      availableFrom: "2025-01-01",
      availableUntil: null,
      rules: {
        autoClose: false,
        closable: true,
        pausable: true,
        renewable: true,
      },
      description: "Flexible monthly CRM plan",
      isActive: true,
    },
    {
      name: "Sprint Weekly",
      productId: crmProduct._id,
      price: 90000, // ₹900
      billingPeriod: "weekly",
      minQuantity: 1,
      availableFrom: "2025-01-01",
      availableUntil: null,
      rules: {
        autoClose: false,
        closable: true,
        pausable: true,
        renewable: false,
      },
      description: "Weekly billed plan",
      isActive: true,
    },
    {
      name: "Sandbox Daily",
      productId: crmProduct._id,
      price: 20000, // ₹200
      billingPeriod: "daily",
      minQuantity: 1,
      availableFrom: "2025-01-01",
      availableUntil: null,
      rules: {
        autoClose: true,
        closable: true,
        pausable: false,
        renewable: false,
      },
      description: "Daily evaluation plan",
      isActive: true,
    },
  ]);

  // 5. Taxes (GST 18% on services & add-ons, GST 12% on physical)
  await Tax.create([
    {
      name: "GST 18%",
      type: "percentage",
      rate: 18,
      appliesTo: {
        kind: "productTypes",
        productTypes: ["service", "addon"],
        productIds: [],
      },
      isActive: true,
    },
    {
      name: "GST 12%",
      type: "percentage",
      rate: 12,
      appliesTo: {
        kind: "productTypes",
        productTypes: ["physical"],
        productIds: [],
      },
      isActive: true,
    },
  ]);

  // 6. Discounts (Bulk seats 10% and Launch ₹500 off running, plus expired, exhausted, scheduled)
  await Discount.create([
    {
      name: "Bulk seats 10%",
      type: "percentage",
      value: 10,
      minPurchaseAmount: null,
      minQuantity: 20,
      startDate: "2025-01-01",
      endDate: "2028-12-31",
      usageLimit: 50,
      usedCount: 2,
      appliesTo: {
        kind: "products",
        productIds: [crmProduct._id],
      },
      isActive: true,
    },
    {
      name: "Launch ₹500 off",
      type: "fixed",
      value: 50000, // ₹500 in paise
      minPurchaseAmount: 200000, // ₹2,000 minimum purchase
      minQuantity: null,
      startDate: "2025-01-01",
      endDate: "2028-12-31",
      usageLimit: 100,
      usedCount: 1,
      appliesTo: {
        kind: "subscription",
        productIds: [],
      },
      isActive: true,
    },
    {
      name: "Monsoon 15% (Expired)",
      type: "percentage",
      value: 15,
      minPurchaseAmount: null,
      minQuantity: 5,
      startDate: "2025-06-01",
      endDate: "2025-08-31",
      usageLimit: 20,
      usedCount: 4,
      appliesTo: { kind: "subscription", productIds: [] },
      isActive: true,
    },
    {
      name: "Early Bird ₹1000 (Exhausted)",
      type: "fixed",
      value: 100000,
      minPurchaseAmount: null,
      minQuantity: 1,
      startDate: "2025-01-01",
      endDate: "2028-12-31",
      usageLimit: 10,
      usedCount: 10,
      appliesTo: { kind: "subscription", productIds: [] },
      isActive: true,
    },
    {
      name: "New Year 2028 Promo (Scheduled)",
      type: "percentage",
      value: 20,
      minPurchaseAmount: null,
      minQuantity: 10,
      startDate: "2028-01-01",
      endDate: "2028-03-31",
      usageLimit: 50,
      usedCount: 0,
      appliesTo: { kind: "subscription", productIds: [] },
      isActive: true,
    },
  ]);

  // 7. Quotation Templates (Page 51)
  const [proTemplate, basicTemplate] = await QuotationTemplate.create([
    {
      name: "Pro Yearly – Standard",
      planId: proYearlyPlan._id,
      validityDays: 14,
      paymentTermDays: 30,
      lines: [
        {
          productId: crmProduct._id,
          variantId: odooVariantId,
          quantity: 10,
        },
        {
          productId: analyticsProduct._id,
          variantId: null,
          quantity: 1,
        },
      ],
      notes: "Prices exclude GST. Billed yearly in advance.",
      isActive: true,
    },
    {
      name: "Basic Monthly – Starter",
      planId: basicMonthlyPlan._id,
      validityDays: 7,
      paymentTermDays: 15,
      lines: [
        {
          productId: crmProduct._id,
          variantId: genericVariantId,
          quantity: 1,
        },
      ],
      notes: "Monthly starter subscription.",
      isActive: true,
    },
  ]);

  // 8. Test Case 1 Subscription (Acme Ltd: 25 x Odoo CRM + 1 x Analytics add-on => 12814800 paise)
  const tc1Lines = [
    {
      productId: crmProduct._id,
      productName: "Brightloop CRM",
      variantId: odooVariantId,
      variantLabel: "Brand: Odoo",
      quantity: 25,
      unitPrice: 456000,
    },
    {
      productId: analyticsProduct._id,
      productName: "Analytics add-on",
      variantId: null,
      variantLabel: null,
      quantity: 1,
      unitPrice: 600000,
    },
  ];
  const tc1Priced = await priceLines({ lines: tc1Lines }, today);

  const acmeSub = await Subscription.create({
    number: `SUB/${year}/0001`,
    customerId: acmeCustomer._id,
    planId: proYearlyPlan._id,
    templateId: proTemplate._id,
    salespersonId: staffUser._id,
    status: "active",
    startDate: `${year}-01-01`,
    expiryDate: `${year}-12-31`,
    paymentTermDays: 30,
    lines: tc1Lines,
    nextInvoiceDate: today,
    recurringTotal: tc1Priced.recurringTotal, // 12814800
    recurringNet: tc1Priced.recurringNet,     // 10860000
    history: [
      {
        at: new Date(),
        by: "system",
        action: "activate",
        from: "confirmed",
        to: "active",
        note: null,
      },
    ],
  });

  // 9. Test Case 2 Subscription (Kite Stores: 1 x Basic Monthly Generic CRM => 295000 paise)
  const tc2Lines = [
    {
      productId: crmProduct._id,
      productName: "Brightloop CRM",
      variantId: genericVariantId,
      variantLabel: "Brand: Generic",
      quantity: 1,
      unitPrice: 300000,
    },
  ];
  const tc2Priced = await priceLines({ lines: tc2Lines }, today);

  const kiteSub = await Subscription.create({
    number: `SUB/${year}/0002`,
    customerId: kiteCustomer._id,
    planId: basicMonthlyPlan._id,
    templateId: basicTemplate._id,
    salespersonId: staffUser._id,
    status: "active",
    startDate: `${year}-01-01`,
    expiryDate: `${year}-12-31`,
    paymentTermDays: 15,
    lines: tc2Lines,
    nextInvoiceDate: today,
    recurringTotal: tc2Priced.recurringTotal, // 295000
    recurringNet: tc2Priced.recurringNet,     // 250000
    history: [
      {
        at: new Date(),
        by: "system",
        action: "activate",
        from: "confirmed",
        to: "active",
        note: null,
      },
    ],
  });

  // Pending quotation for Kite Stores expiring tomorrow (so portal & mobile app can test Accept/Reject)
  await Subscription.create({
    number: `SUB/${year}/0003`,
    customerId: kiteCustomer._id,
    planId: basicMonthlyPlan._id,
    templateId: basicTemplate._id,
    salespersonId: staffUser._id,
    status: "quotation",
    startDate: today,
    expiryDate: `${year + 1}-10-30`,
    quotationValidUntil: addDaysStr(today, 1),
    paymentTermDays: 15,
    lines: tc2Lines,
    nextInvoiceDate: null,
    recurringTotal: tc2Priced.recurringTotal,
    recurringNet: tc2Priced.recurringNet,
    history: [
      {
        at: new Date(),
        by: staffUser._id,
        action: "send",
        from: "draft",
        to: "quotation",
        note: "Sent quotation to customer",
      },
    ],
  });

  // Paused subscription, Draft subscription, Confirmed subscription, and Past-Expiry subscription without auto-close
  await Subscription.create([
    {
      number: `SUB/${year}/0004`,
      customerId: acmeCustomer._id,
      planId: basicMonthlyPlan._id,
      salespersonId: staffUser._id,
      status: "paused",
      startDate: "2026-02-01",
      expiryDate: "2027-01-31",
      paymentTermDays: 15,
      lines: tc2Lines,
      nextInvoiceDate: today,
      recurringTotal: tc2Priced.recurringTotal,
      recurringNet: tc2Priced.recurringNet,
      pausedAt: new Date(),
    },
    {
      number: `SUB/${year}/0005`,
      customerId: acmeCustomer._id,
      planId: basicMonthlyPlan._id,
      salespersonId: staffUser._id,
      status: "active",
      startDate: "2025-01-01",
      expiryDate: addDaysStr(today, -10), // Past expiry without auto-close
      paymentTermDays: 15,
      lines: tc2Lines,
      nextInvoiceDate: addDaysStr(today, -5),
      recurringTotal: tc2Priced.recurringTotal,
      recurringNet: tc2Priced.recurringNet,
    },
    {
      number: `SUB/${year}/0006`,
      customerId: acmeCustomer._id,
      planId: proYearlyPlan._id,
      salespersonId: staffUser._id,
      status: "draft",
      startDate: today,
      expiryDate: `${year + 1}-10-30`,
      paymentTermDays: 30,
      lines: tc1Lines,
      recurringTotal: tc1Priced.recurringTotal,
      recurringNet: tc1Priced.recurringNet,
    },
  ]);

  // Seed sample invoices (overdue by 5, 29 and 75 days, partly paid, paid, draft)
  const sampleInvoices = await Invoice.create([
    {
      number: `INV/${year}/0001`,
      subscriptionId: acmeSub._id,
      customerId: acmeCustomer._id,
      customerSnapshot: {
        name: acmeCustomer.name,
        email: acmeCustomer.email,
        billingAddress: acmeCustomer.billingAddress,
        taxId: acmeCustomer.taxId,
      },
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      invoiceDate: "2026-08-01",
      dueDate: addDaysStr(today, -5), // 5 days overdue
      status: "confirmed",
      isVoid: false,
      lines: tc1Priced.lines,
      untaxedAmount: tc1Priced.totals.untaxedAmount,
      discountTotal: tc1Priced.totals.discountTotal,
      taxTotal: tc1Priced.totals.taxTotal,
      total: tc1Priced.totals.total,
      amountPaid: 5000000,
      balance: tc1Priced.totals.total - 5000000,
      confirmedAt: new Date(),
    },
    {
      number: `INV/${year}/0002`,
      subscriptionId: kiteSub._id,
      customerId: kiteCustomer._id,
      customerSnapshot: {
        name: kiteCustomer.name,
        email: kiteCustomer.email,
        billingAddress: kiteCustomer.billingAddress,
        taxId: kiteCustomer.taxId,
      },
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      invoiceDate: "2026-09-01",
      dueDate: addDaysStr(today, -29), // 29 days overdue
      status: "confirmed",
      isVoid: false,
      lines: tc2Priced.lines,
      orderDiscount: tc2Priced.orderDiscount,
      untaxedAmount: tc2Priced.totals.untaxedAmount,
      discountTotal: tc2Priced.totals.discountTotal,
      taxTotal: tc2Priced.totals.taxTotal,
      total: tc2Priced.totals.total,
      amountPaid: 0,
      balance: tc2Priced.totals.total,
      confirmedAt: new Date(),
    },
    {
      number: `INV/${year}/0003`,
      subscriptionId: acmeSub._id,
      customerId: acmeCustomer._id,
      customerSnapshot: {
        name: acmeCustomer.name,
        email: acmeCustomer.email,
        billingAddress: acmeCustomer.billingAddress,
        taxId: acmeCustomer.taxId,
      },
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      invoiceDate: "2026-06-01",
      dueDate: addDaysStr(today, -75), // 75 days overdue
      status: "confirmed",
      isVoid: false,
      lines: tc2Priced.lines,
      untaxedAmount: tc2Priced.totals.untaxedAmount,
      discountTotal: tc2Priced.totals.discountTotal,
      taxTotal: tc2Priced.totals.taxTotal,
      total: tc2Priced.totals.total,
      amountPaid: 0,
      balance: tc2Priced.totals.total,
      confirmedAt: new Date(),
    },
    {
      number: `INV/${year}/0004`,
      subscriptionId: acmeSub._id,
      customerId: acmeCustomer._id,
      customerSnapshot: {
        name: acmeCustomer.name,
        email: acmeCustomer.email,
        billingAddress: acmeCustomer.billingAddress,
        taxId: acmeCustomer.taxId,
      },
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      invoiceDate: "2026-07-01",
      dueDate: "2026-07-31",
      status: "paid",
      isVoid: false,
      lines: tc1Priced.lines,
      untaxedAmount: tc1Priced.totals.untaxedAmount,
      discountTotal: tc1Priced.totals.discountTotal,
      taxTotal: tc1Priced.totals.taxTotal,
      total: tc1Priced.totals.total,
      amountPaid: tc1Priced.totals.total,
      balance: 0,
      confirmedAt: new Date(),
      paidAt: new Date(),
    },
  ]);

  await Payment.create([
    {
      invoiceId: sampleInvoices[0]._id,
      customerId: acmeCustomer._id,
      subscriptionId: acmeSub._id,
      method: "bank_transfer",
      amount: 5000000,
      paymentDate: today,
      note: "Part payment UTR 88213",
      recordedBy: financeUser._id,
    },
    {
      invoiceId: sampleInvoices[3]._id,
      customerId: acmeCustomer._id,
      subscriptionId: acmeSub._id,
      method: "upi",
      amount: tc1Priced.totals.total,
      paymentDate: "2026-07-15",
      note: "Full payment",
      recordedBy: financeUser._id,
    },
  ]);

  let subSeq = 6;
  let invSeq = 4;

  // Large dataset option: 5,000 subscriptions, 60,000 invoices, 40,000 payments (Page 52)
  if (isLarge) {
    console.log("[SEED] Generating --large dataset (5,000 subscriptions, 60,000 invoices, 40,000 payments)...");
    const bulkSubs = [];
    for (let i = 7; i <= 5000; i++) {
      const cust = allCustomers[i % allCustomers.length];
      const isYearly = i % 3 === 0;
      const plan = isYearly ? proYearlyPlan : basicMonthlyPlan;
      bulkSubs.push({
        _id: new mongoose.Types.ObjectId(),
        number: `SUB/${year}/${String(i).padStart(4, "0")}`,
        customerId: cust._id,
        planId: plan._id,
        salespersonId: staffUser._id,
        status: i % 10 === 0 ? "closed" : "active",
        startDate: "2026-01-01",
        expiryDate: "2026-12-31",
        paymentTermDays: 15,
        lines: tc2Lines,
        nextInvoiceDate: "2026-11-01",
        recurringTotal: tc2Priced.recurringTotal,
        recurringNet: tc2Priced.recurringNet,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    await Subscription.collection.insertMany(bulkSubs);
    subSeq = 5000;

    const months = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
    let bulkInvs = [];
    let bulkPays = [];

    for (let i = 1; i <= 60000; i++) {
      const subObj = bulkSubs[i % bulkSubs.length];
      const m = months[i % months.length];
      const day = String((i % 28) + 1).padStart(2, "0");
      const invId = new mongoose.Types.ObjectId();
      const isPaid = i <= 40000;

      bulkInvs.push({
        _id: invId,
        number: `INV/${year}/${String(i + 4).padStart(5, "0")}`,
        subscriptionId: subObj._id,
        customerId: subObj.customerId,
        periodStart: `${m}-${day}`,
        periodEnd: `${m}-28`,
        invoiceDate: `${m}-${day}`,
        dueDate: `${m}-28`,
        status: isPaid ? "paid" : "confirmed",
        isVoid: false,
        lines: [],
        untaxedAmount: 300000,
        discountTotal: 50000,
        taxTotal: 45000,
        total: 295000,
        amountPaid: isPaid ? 295000 : 0,
        balance: isPaid ? 0 : 295000,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      if (isPaid) {
        bulkPays.push({
          invoiceId: invId,
          customerId: subObj.customerId,
          subscriptionId: subObj._id,
          method: "bank_transfer",
          amount: 295000,
          paymentDate: `${m}-${day}`,
          note: "Bulk seed payment",
          recordedBy: financeUser._id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      if (bulkInvs.length >= 10000) {
        await Invoice.collection.insertMany(bulkInvs);
        bulkInvs = [];
      }
      if (bulkPays.length >= 10000) {
        await Payment.collection.insertMany(bulkPays);
        bulkPays = [];
      }
    }

    if (bulkInvs.length > 0) await Invoice.collection.insertMany(bulkInvs);
    if (bulkPays.length > 0) await Payment.collection.insertMany(bulkPays);
    invSeq = 60004;
  }

  await Counter.create([
    { _id: `SUB-${year}`, seq: subSeq },
    { _id: `INV-${year}`, seq: invSeq },
  ]);

  console.log(`[SEED] Done! Test Case 1 Total = ${tc1Priced.totals.total} paise, Test Case 2 Total = ${tc2Priced.totals.total} paise.`);
}

if (require.main === module) {
  const isLarge = process.argv.includes("--large");
  connectDB()
    .then(() => seedDatabase({ isLarge }))
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error("[SEED ERROR]", err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
