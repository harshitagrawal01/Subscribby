const env = require("../config/env");

async function callBrevo(payload) {
  if (env.EMAIL_PROVIDER === "console" || !env.BREVO_API_KEY) {
    console.log(`[MAILER:CONSOLE] To=${JSON.stringify(payload.to)} Subject="${payload.subject || `Template ${payload.templateId}`}"`);
    return { messageId: "console-mock-id" };
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: env.BREVO_SENDER_NAME,
          email: env.BREVO_SENDER_EMAIL,
        },
        ...payload,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`[BREVO ERROR status=${res.status}]`, data);
      return null;
    }
    console.log(`[BREVO SENT] messageId=${data.messageId}`);
    return data;
  } catch (err) {
    console.error("[BREVO FETCH ERROR]", err.message);
    return null;
  }
}

async function sendPasswordReset({ toEmail, toName, resetUrl, expiresInMinutes = 30 }) {
  if (env.EMAIL_PROVIDER === "console") {
    console.log(`[PASSWORD RESET LINK for ${toEmail}]: ${resetUrl}`);
    return { messageId: "console-reset" };
  }

  const body = {
    to: [{ email: toEmail, name: toName || toEmail }],
    params: {
      name: toName || toEmail,
      resetUrl,
      expiresInMinutes,
    },
  };

  if (env.BREVO_TEMPLATE_RESET_ID) {
    body.templateId = env.BREVO_TEMPLATE_RESET_ID;
  } else {
    body.subject = "Reset your Brightloop password";
    body.htmlContent = `<p>Hi ${toName || "there"},</p><p>Click the link below to reset your password (valid for ${expiresInMinutes} minutes):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`;
  }

  return callBrevo(body);
}

async function sendQuotation({ toEmail, toName, subscriptionNumber, totalPaise, validUntil }) {
  const portalUrl = `${env.WEB_URL}/portal/subscriptions`;
  const amountInr = (totalPaise / 100).toFixed(2);
  return callBrevo({
    to: [{ email: toEmail, name: toName || toEmail }],
    subject: `Quotation ${subscriptionNumber} from ${env.COMPANY.name}`,
    htmlContent: `<p>Hello ${toName || ""},</p><p>Your quotation <strong>${subscriptionNumber}</strong> for ₹${amountInr} is ready and valid until ${validUntil}.</p><p><a href="${portalUrl}">View and accept in your customer portal</a></p>`,
  });
}

async function sendInvoice({ toEmail, toName, invoiceNumber, totalPaise, balancePaise, dueDate }) {
  const portalUrl = `${env.WEB_URL}/portal/invoices`;
  const totalInr = (totalPaise / 100).toFixed(2);
  const balanceInr = (balancePaise / 100).toFixed(2);
  return callBrevo({
    to: [{ email: toEmail, name: toName || toEmail }],
    subject: `Invoice ${invoiceNumber} from ${env.COMPANY.name}`,
    htmlContent: `<p>Hello ${toName || ""},</p><p>Invoice <strong>${invoiceNumber}</strong> (Total: ₹${totalInr}, Balance Due: ₹${balanceInr}, Due Date: ${dueDate}) is available.</p><p><a href="${portalUrl}">View your invoice online</a></p>`,
  });
}

module.exports = {
  sendPasswordReset,
  sendQuotation,
  sendInvoice,
};
