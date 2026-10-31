const Product = require("../models/Product");
const Tax = require("../models/Tax");
const { Discount } = require("../models/Discount");
const { todayIST } = require("../utils/date");

/**
 * Section 14: Single canonical pricing function used across preview, subscription detail,
 * billing run, and "Create invoice now".
 *
 * @param {Object} subscription - Subscription doc or preview object with lines[]
 * @param {string} onDate - "YYYY-MM-DD" date to check running discounts against
 * @param {Array<string>} excludedDiscountIds - Discount IDs that failed reservation in race conditions
 */
async function priceLines(subscription, onDate = todayIST(), excludedDiscountIds = []) {
  const rawLines = subscription.lines || [];
  if (rawLines.length === 0) {
    return {
      lines: [],
      orderDiscount: null,
      totals: {
        untaxedAmount: 0,
        discountTotal: 0,
        taxTotal: 0,
        total: 0,
      },
      recurringTotal: 0,
      recurringNet: 0,
      appliedDiscountIds: [],
    };
  }

  const productIds = rawLines.map((l) => l.productId);
  const [products, activeTaxes, candidateDiscounts] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).lean(),
    Tax.find({ isActive: true }).lean(),
    Discount.find({
      isActive: true,
      startDate: { $lte: onDate },
      endDate: { $gte: onDate },
    }).lean(),
  ]);

  const prodMap = new Map(products.map((p) => [String(p._id), p]));
  const excludedSet = new Set(excludedDiscountIds.map(String));

  // Filter discounts that still have remaining uses on onDate
  const runningDiscounts = candidateDiscounts.filter((d) => {
    if (excludedSet.has(String(d._id))) return false;
    if (d.usageLimit !== null && d.usageLimit !== undefined && d.usedCount >= d.usageLimit) {
      return false;
    }
    return true;
  });

  const productDiscounts = runningDiscounts.filter(
    (d) => d.appliesTo && d.appliesTo.kind === "products"
  );
  const subDiscounts = runningDiscounts.filter(
    (d) => d.appliesTo && d.appliesTo.kind === "subscription"
  );

  // Step 1: Compute line subtotals and total quantity
  const workingLines = rawLines.map((l) => {
    const subtotal = l.unitPrice * l.quantity;
    return {
      id: l._id ? String(l._id) : l.id ? String(l.id) : undefined,
      productId: String(l.productId),
      productName: l.productName,
      variantId: l.variantId ? String(l.variantId) : null,
      variantLabel: l.variantLabel || null,
      description: l.variantLabel
        ? `${l.productName} · ${l.variantLabel}`
        : l.productName,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      subtotal,
      discount: null,
      lineDiscountAmount: 0,
      orderDiscountShare: 0,
      taxes: [],
      taxAmount: 0,
      total: 0,
    };
  });

  const untaxedAmount = workingLines.reduce((sum, l) => sum + l.subtotal, 0);
  const totalQuantity = workingLines.reduce((sum, l) => sum + l.quantity, 0);

  // Step 2: Line discounts (appliesTo.kind = "products")
  for (const line of workingLines) {
    let bestDiscount = null;
    let bestAmount = 0;

    for (const d of productDiscounts) {
      const targetIds = (d.appliesTo.productIds || []).map(String);
      if (!targetIds.includes(line.productId)) continue;
      if (d.minQuantity !== null && d.minQuantity !== undefined && line.quantity < d.minQuantity) {
        continue;
      }
      if (
        d.minPurchaseAmount !== null &&
        d.minPurchaseAmount !== undefined &&
        untaxedAmount < d.minPurchaseAmount
      ) {
        continue;
      }

      const amt =
        d.type === "percentage"
          ? Math.round((line.subtotal * d.value) / 100)
          : Math.min(d.value, line.subtotal);

      if (amt > bestAmount) {
        bestAmount = amt;
        bestDiscount = d;
      }
    }

    if (bestDiscount && bestAmount > 0) {
      line.discount = {
        discountId: String(bestDiscount._id),
        name: bestDiscount.name,
        amount: bestAmount,
      };
      line.lineDiscountAmount = bestAmount;
    }
  }

  // Step 3: Subscription discount (appliesTo.kind = "subscription")
  // Rule (Page 45): "discounts never stack."
  // Compare total line discounts vs best subscription discount and keep whichever is larger.
  const totalLineDiscountsSoFar = workingLines.reduce(
    (sum, l) => sum + l.lineDiscountAmount,
    0
  );
  const netAfterLineDiscounts = untaxedAmount;

  let orderDiscount = null;
  let bestSubDiscount = null;
  let bestSubAmount = 0;

  for (const d of subDiscounts) {
    if (d.minQuantity !== null && d.minQuantity !== undefined && totalQuantity < d.minQuantity) {
      continue;
    }
    if (
      d.minPurchaseAmount !== null &&
      d.minPurchaseAmount !== undefined &&
      netAfterLineDiscounts < d.minPurchaseAmount
    ) {
      continue;
    }

    const amt =
      d.type === "percentage"
        ? Math.round((netAfterLineDiscounts * d.value) / 100)
        : Math.min(d.value, netAfterLineDiscounts);

    if (amt > bestSubAmount) {
      bestSubAmount = amt;
      bestSubDiscount = d;
    }
  }

  // Discounts never stack: only apply subscription discount if it beats total line discounts
  if (
    bestSubDiscount &&
    bestSubAmount > totalLineDiscountsSoFar &&
    netAfterLineDiscounts > 0
  ) {
    // Clear any smaller line discounts so discounts do not stack
    for (const l of workingLines) {
      l.discount = null;
      l.lineDiscountAmount = 0;
    }

    orderDiscount = {
      discountId: String(bestSubDiscount._id),
      name: bestSubDiscount.name,
      amount: bestSubAmount,
    };

    // Split across lines in proportion to their net amounts; rounding remainder goes to largest line
    let allocated = 0;
    let largestIdx = 0;
    let largestNet = -1;

    workingLines.forEach((l, idx) => {
      const net = l.subtotal;
      if (net > largestNet) {
        largestNet = net;
        largestIdx = idx;
      }
      const share = Math.round((bestSubAmount * net) / netAfterLineDiscounts);
      l.orderDiscountShare = share;
      allocated += share;
    });

    const remainder = bestSubAmount - allocated;
    if (remainder !== 0 && workingLines[largestIdx]) {
      workingLines[largestIdx].orderDiscountShare += remainder;
    }
  }

  // Step 4: Taxes per line on (subtotal - lineDiscount - orderDiscountShare)
  for (const line of workingLines) {
    const prod = prodMap.get(line.productId);
    const prodType = prod ? prod.type : "service";
    const taxableBase = Math.max(
      0,
      line.subtotal - line.lineDiscountAmount - line.orderDiscountShare
    );

    const matchingTaxes = activeTaxes.filter((t) => {
      if (!t.appliesTo) return false;
      if (t.appliesTo.kind === "all") return true;
      if (t.appliesTo.kind === "productTypes") {
        return (t.appliesTo.productTypes || []).includes(prodType);
      }
      if (t.appliesTo.kind === "products") {
        return (t.appliesTo.productIds || []).map(String).includes(line.productId);
      }
      return false;
    });

    let lineTaxSum = 0;
    line.taxes = matchingTaxes.map((t) => {
      const amt =
        t.type === "percentage"
          ? Math.round((taxableBase * t.rate) / 100)
          : t.rate * line.quantity;
      lineTaxSum += amt;
      return {
        taxId: String(t._id),
        name: t.name,
        type: t.type,
        rate: t.rate,
        amount: amt,
      };
    });

    line.taxAmount = lineTaxSum;
    line.total = taxableBase + lineTaxSum;
  }

  // Step 5: Totals
  const lineDiscountSum = workingLines.reduce((sum, l) => sum + l.lineDiscountAmount, 0);
  const subDiscountAmt = orderDiscount ? orderDiscount.amount : 0;
  const discountTotal = lineDiscountSum + subDiscountAmt;
  const taxTotal = workingLines.reduce((sum, l) => sum + l.taxAmount, 0);
  const total = untaxedAmount - discountTotal + taxTotal;
  const recurringNet = untaxedAmount - discountTotal;

  // Collect unique applied discount IDs (1 use per invoice per discount)
  const appliedSet = new Set();
  for (const l of workingLines) {
    if (l.discount && l.discount.discountId) {
      appliedSet.add(l.discount.discountId);
    }
    delete l.lineDiscountAmount;
  }
  if (orderDiscount && orderDiscount.discountId) {
    appliedSet.add(orderDiscount.discountId);
  }

  return {
    lines: workingLines,
    orderDiscount,
    totals: {
      untaxedAmount,
      discountTotal,
      taxTotal,
      total,
    },
    recurringTotal: total,
    recurringNet,
    appliedDiscountIds: Array.from(appliedSet),
  };
}

module.exports = { priceLines };
