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
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean(),
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

  // Step 1: Compute line subtotals and total quantity
  const workingLines = rawLines.map((l) => {
    const subtotal = l.unitPrice * l.quantity;
    return {
      id: l._id ? String(l._id) : l.id ? String(l.id) : null,
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

  // Step 2 & 3: ONE discount per invoice (Page 45: "discounts never stack").
  // Evaluate every running discount across qualifying lines or subscription subtotal,
  // and apply only the single discount that saves the most in total.
  // Ties: product discount beats subscription discount; then older discount wins.
  const calcDiscountAmt = (d, base) => {
    if (base <= 0) return 0;
    return d.type === "percentage"
      ? Math.round((base * d.value) / 100)
      : Math.min(d.value, base);
  };

  let winner = null; // { discount, kind, savings }
  const consider = (discount, kind, savings) => {
    if (savings <= 0) return;
    const better =
      !winner ||
      savings > winner.savings ||
      (savings === winner.savings && kind === "products" && winner.kind === "subscription");
    if (better) {
      winner = { discount, kind, savings };
    }
  };

  for (const d of runningDiscounts) {
    if (
      d.minPurchaseAmount !== null &&
      d.minPurchaseAmount !== undefined &&
      untaxedAmount < d.minPurchaseAmount
    ) {
      continue;
    }

    const kind = d.appliesTo && d.appliesTo.kind;
    if (kind === "products") {
      const targetIds = (d.appliesTo.productIds || []).map(String);
      const savings = workingLines
        .filter(
          (l) =>
            targetIds.includes(l.productId) &&
            (d.minQuantity === null || d.minQuantity === undefined || l.quantity >= d.minQuantity)
        )
        .reduce((sum, l) => sum + calcDiscountAmt(d, l.subtotal), 0);
      consider(d, "products", savings);
    } else if (kind === "subscription") {
      if (
        d.minQuantity !== null &&
        d.minQuantity !== undefined &&
        totalQuantity < d.minQuantity
      ) {
        continue;
      }
      consider(d, "subscription", calcDiscountAmt(d, untaxedAmount));
    }
  }

  let orderDiscount = null;
  if (winner && winner.kind === "products") {
    const d = winner.discount;
    const targetIds = (d.appliesTo.productIds || []).map(String);
    for (const l of workingLines) {
      if (
        targetIds.includes(l.productId) &&
        (d.minQuantity === null || d.minQuantity === undefined || l.quantity >= d.minQuantity)
      ) {
        const amount = calcDiscountAmt(d, l.subtotal);
        if (amount > 0) {
          l.discount = {
            discountId: String(d._id),
            name: d.name,
            amount,
          };
          l.lineDiscountAmount = amount;
        }
      }
    }
  } else if (winner && winner.kind === "subscription" && untaxedAmount > 0) {
    const d = winner.discount;
    orderDiscount = {
      discountId: String(d._id),
      name: d.name,
      amount: winner.savings,
    };

    // Split across lines in proportion to their subtotals; rounding remainder goes to largest line
    let allocated = 0;
    let largestIdx = 0;
    workingLines.forEach((l, idx) => {
      const share = Math.round((orderDiscount.amount * l.subtotal) / untaxedAmount);
      l.orderDiscountShare = share;
      allocated += share;
      if (l.subtotal > workingLines[largestIdx].subtotal) {
        largestIdx = idx;
      }
    });
    const remainder = orderDiscount.amount - allocated;
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
