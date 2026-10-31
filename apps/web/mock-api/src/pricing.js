// The one pricing function (spec section 14). Used by preview, subscription detail,
// "Create invoice now", the billing run and the seed, so screens and invoices always match.
import { db } from './store.js';

/** Running on a date: active, within its dates, and not used up. */
export function isDiscountRunning(d, date) {
  return (
    d.isActive &&
    d.startDate <= date &&
    date <= d.endDate &&
    (d.usageLimit == null || d.usedCount < d.usageLimit)
  );
}

export function discountAmount(d, base) {
  if (base <= 0) return 0;
  return d.type === 'percentage' ? Math.round((base * d.value) / 100) : Math.min(d.value, base);
}

function taxApplies(tax, product) {
  const a = tax.appliesTo || { kind: 'all' };
  if (a.kind === 'all') return true;
  if (a.kind === 'productTypes') return (a.productTypes || []).includes(product?.type);
  if (a.kind === 'products') return (a.productIds || []).includes(product?.id);
  return false;
}

/**
 * priceLines(lines, onDate)
 * lines: [{ id, productId, productName, variantId, variantLabel, quantity, unitPrice }]
 * returns { lines: [...priced], orderDiscount, totals, appliedDiscountIds }
 */
export function priceLines(lines, onDate) {
  const products = new Map(db.products.map((p) => [p.id, p]));
  const running = db.discounts
    .filter((d) => isDiscountRunning(d, onDate))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  const taxes = db.taxes.filter((t) => t.isActive);

  // 1. Line subtotals
  const priced = lines.map((l) => ({
    id: l.id ?? null,
    productId: l.productId,
    productName: l.productName,
    variantId: l.variantId ?? null,
    variantLabel: l.variantLabel ?? null,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    subtotal: l.unitPrice * l.quantity,
    discount: null,
    orderDiscountShare: 0,
    taxes: [],
    taxAmount: 0,
    total: 0,
  }));
  const sumSubtotal = priced.reduce((s, l) => s + l.subtotal, 0);

  // 2–3. ONE discount per invoice (agreed rule, "option b"): of every discount that qualifies,
  //      apply only the one that saves the most in total. Nothing else applies.
  //      - A product discount applies to every line it qualifies for (line quantity >= minQuantity,
  //        invoice subtotal >= minPurchaseAmount).
  //      - A subscription discount qualifies on total quantity and invoice subtotal, and is split
  //        across lines in proportion to their subtotals.
  //      Ties: a product discount beats a subscription discount, then the older discount wins.
  const totalQty = priced.reduce((s, l) => s + l.quantity, 0);
  let winner = null; // { discount, kind, savings }
  const consider = (discount, kind, savings) => {
    if (savings <= 0) return;
    const better =
      !winner ||
      savings > winner.savings ||
      (savings === winner.savings && kind === 'products' && winner.kind === 'subscription');
    if (better) winner = { discount, kind, savings };
  };
  for (const d of running) {
    if (d.minPurchaseAmount != null && d.minPurchaseAmount > sumSubtotal) continue;
    if (d.appliesTo?.kind === 'products') {
      const savings = priced
        .filter((l) => (d.appliesTo.productIds || []).includes(l.productId) && (d.minQuantity == null || d.minQuantity <= l.quantity))
        .reduce((sum, l) => sum + discountAmount(d, l.subtotal), 0);
      consider(d, 'products', savings);
    } else if (d.appliesTo?.kind === 'subscription') {
      if (d.minQuantity != null && d.minQuantity > totalQty) continue;
      consider(d, 'subscription', discountAmount(d, sumSubtotal));
    }
  }

  let orderDiscount = null;
  if (winner?.kind === 'products') {
    const d = winner.discount;
    for (const l of priced) {
      if ((d.appliesTo.productIds || []).includes(l.productId) && (d.minQuantity == null || d.minQuantity <= l.quantity)) {
        const amount = discountAmount(d, l.subtotal);
        if (amount > 0) l.discount = { discountId: d.id, name: d.name, amount };
      }
    }
  } else if (winner?.kind === 'subscription') {
    const d = winner.discount;
    orderDiscount = { discountId: d.id, name: d.name, amount: winner.savings };
    let allocated = 0;
    let largest = 0;
    priced.forEach((l, i) => {
      l.orderDiscountShare = sumSubtotal > 0 ? Math.round((orderDiscount.amount * l.subtotal) / sumSubtotal) : 0;
      allocated += l.orderDiscountShare;
      if (l.subtotal > priced[largest].subtotal) largest = i;
    });
    if (priced.length) priced[largest].orderDiscountShare += orderDiscount.amount - allocated;
  }

  // 4. Taxes per line on (subtotal − line discount − order discount share); no tax on tax.
  for (const l of priced) {
    const base = l.subtotal - (l.discount?.amount || 0) - l.orderDiscountShare;
    const product = products.get(l.productId);
    l.taxes = taxes
      .filter((t) => taxApplies(t, product))
      .map((t) => ({
        taxId: t.id,
        name: t.name,
        type: t.type,
        rate: t.rate,
        amount: t.type === 'percentage' ? Math.round((base * t.rate) / 100) : t.rate * l.quantity,
      }));
    l.taxAmount = l.taxes.reduce((s, t) => s + t.amount, 0);
    l.total = base + l.taxAmount;
  }

  // 5. Totals
  const lineDiscounts = priced.reduce((s, l) => s + (l.discount?.amount || 0), 0);
  const untaxedAmount = sumSubtotal;
  const discountTotal = lineDiscounts + (orderDiscount?.amount || 0);
  const taxTotal = priced.reduce((s, l) => s + l.taxAmount, 0);
  const total = untaxedAmount - discountTotal + taxTotal;

  const appliedDiscountIds = [
    ...new Set([...priced.filter((l) => l.discount).map((l) => l.discount.discountId), orderDiscount?.discountId]),
  ].filter(Boolean);

  return {
    lines: priced,
    orderDiscount,
    totals: { untaxedAmount, discountTotal, taxTotal, total },
    appliedDiscountIds,
  };
}

/** What subscriptions store: one period's total incl. tax, and net after discounts before tax. */
export function recurringAmounts(pricing) {
  return {
    recurringTotal: pricing.totals.total,
    recurringNet: pricing.totals.untaxedAmount - pricing.totals.discountTotal,
  };
}
