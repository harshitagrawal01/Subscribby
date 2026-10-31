// Stand-in for Brevo: every "sent" email is captured in memory and listed by
// GET /api/v1/__mock/emails (newest first). Nothing leaves the machine.
import { db, newId } from './store.js';
import { nowIso } from './dates.js';
import { config } from './config.js';

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function capture({ type, to, subject, text, params }) {
  const email = {
    id: newId(),
    messageId: `<mock-${Date.now()}-${db.emails.length + 1}@brevo.mock>`,
    type,
    to,
    from: { name: 'Brightloop', email: 'no-reply@brightloop.test' },
    subject,
    text,
    params,
    createdAt: nowIso(),
  };
  db.emails.push(email);
  console.log(`[mailer] ${type} → ${to.email} (${email.messageId})`);
  return email;
}

export function sendPasswordReset(user, resetUrl) {
  return capture({
    type: 'password_reset',
    to: { email: user.email, name: user.name },
    subject: 'Reset your Brightloop password',
    text: `Hi ${user.name},\n\nUse this link to set a new password. It works once and expires in 30 minutes:\n${resetUrl}\n`,
    params: { name: user.name, resetUrl, expiresInMinutes: 30 },
  });
}

export function sendQuotation(sub, customer, user) {
  const url = `${config.webUrl}/portal/subscriptions/${sub.id}`;
  return capture({
    type: 'quotation',
    to: { email: user.email, name: user.name },
    subject: `Quotation ${sub.number} from ${config.company.name}`,
    text: `Hi ${user.name},\n\nYour quotation ${sub.number} for ${customer.name} is ready (valid until ${sub.quotationValidUntil}), ${rupees(sub.recurringTotal)} per period incl. tax.\nReview and accept it here: ${url}\n`,
    params: {
      name: user.name,
      subscriptionNumber: sub.number,
      validUntil: sub.quotationValidUntil,
      recurringTotal: sub.recurringTotal,
      url,
    },
  });
}

export function sendInvoice(inv) {
  const url = `${config.webUrl}/portal/invoices/${inv.id}`;
  const to = { email: inv.customerSnapshot.email, name: inv.customerSnapshot.name };
  return capture({
    type: 'invoice',
    to,
    subject: `Invoice ${inv.number} from ${config.company.name}`,
    text: `Hello ${to.name},\n\nInvoice ${inv.number} for ${rupees(inv.total)} is due on ${inv.dueDate}. Balance: ${rupees(inv.balance)}.\nView it here: ${url}\n`,
    params: { invoiceNumber: inv.number, total: inv.total, balance: inv.balance, dueDate: inv.dueDate, url },
  });
}
