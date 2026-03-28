// Shared email utility using Resend API
// Set RESEND_API_KEY and RESEND_FROM_EMAIL as Supabase Edge Function secrets

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "orders@coloursofnature.com";

// ─── Core sender ──────────────────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ id: string }> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email send");
    return { id: "skipped" };
  }

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Resend email failed (${resp.status}): ${body}`);
  }

  return resp.json();
}

// ─── Shared layout ────────────────────────────────────────────────────────────

function layout(body: string): string {
  return `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #2d2d2d; background: #fff; padding: 32px 24px;">
      <div style="margin-bottom: 28px;">
        <span style="font-size: 1.2em; font-weight: bold; color: #4a5e3a; letter-spacing: 0.04em;">THE COLOURS OF NATURE</span>
      </div>
      ${body}
      <hr style="border: none; border-top: 1px solid #e0ddd6; margin: 32px 0 16px;" />
      <p style="color: #aaa; font-size: 0.75em; margin: 0;">
        The Colours of Nature &middot; <a href="mailto:shop@thecoloursofnature.com" style="color: #aaa;">shop@thecoloursofnature.com</a>
      </p>
    </div>
  `;
}

function ctaButton(url: string, label: string): string {
  return `
    <a href="${url}" style="
      display: inline-block;
      background: #4a5e3a;
      color: #fff;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 4px;
      font-family: Georgia, serif;
      font-size: 0.95em;
      margin: 20px 0;
    ">${label}</a>
  `;
}

// ─── Auth email templates ─────────────────────────────────────────────────────

export function buildConfirmationEmail(
  name: string,
  confirmUrl: string,
): { subject: string; html: string } {
  return {
    subject: "Confirm your email — The Colours of Nature",
    html: layout(`
      <h2 style="color: #4a5e3a; margin-top: 0;">Welcome, ${name}!</h2>
      <p>Thank you for creating an account. Please confirm your email address to get started.</p>
      ${ctaButton(confirmUrl, "Confirm Email")}
      <p style="color: #888; font-size: 0.85em;">
        If you didn't create an account, you can safely ignore this email.<br/>
        This link expires in 1 hour.
      </p>
      <p style="color: #bbb; font-size: 0.8em; word-break: break-all;">
        Or copy this link: <a href="${confirmUrl}" style="color: #4a5e3a;">${confirmUrl}</a>
      </p>
    `),
  };
}

export function buildPasswordResetEmail(
  name: string,
  resetUrl: string,
): { subject: string; html: string } {
  return {
    subject: "Reset your password — The Colours of Nature",
    html: layout(`
      <h2 style="color: #4a5e3a; margin-top: 0;">Password Reset</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one.</p>
      ${ctaButton(resetUrl, "Reset Password")}
      <p style="color: #888; font-size: 0.85em;">
        If you didn't request a password reset, you can safely ignore this email.<br/>
        This link expires in 1 hour.
      </p>
      <p style="color: #bbb; font-size: 0.8em; word-break: break-all;">
        Or copy this link: <a href="${resetUrl}" style="color: #4a5e3a;">${resetUrl}</a>
      </p>
    `),
  };
}

export function buildMagicLinkEmail(
  name: string,
  magicUrl: string,
): { subject: string; html: string } {
  return {
    subject: "Your sign-in link — The Colours of Nature",
    html: layout(`
      <h2 style="color: #4a5e3a; margin-top: 0;">Sign In</h2>
      <p>Hi ${name},</p>
      <p>Here is your magic link to sign in. This link can only be used once.</p>
      ${ctaButton(magicUrl, "Sign In")}
      <p style="color: #888; font-size: 0.85em;">
        If you didn't request this, you can safely ignore this email.<br/>
        This link expires in 1 hour.
      </p>
    `),
  };
}

export function buildEmailChangeEmail(
  name: string,
  confirmUrl: string,
): { subject: string; html: string } {
  return {
    subject: "Confirm your new email — The Colours of Nature",
    html: layout(`
      <h2 style="color: #4a5e3a; margin-top: 0;">Confirm Email Change</h2>
      <p>Hi ${name},</p>
      <p>Please confirm this email address to complete your email change.</p>
      ${ctaButton(confirmUrl, "Confirm New Email")}
      <p style="color: #888; font-size: 0.85em;">
        If you didn't request this change, please contact us immediately at shop@thecoloursofnature.com.<br/>
        This link expires in 1 hour.
      </p>
    `),
  };
}

export function buildInviteEmail(
  name: string,
  inviteUrl: string,
): { subject: string; html: string } {
  return {
    subject: "You've been invited — The Colours of Nature",
    html: layout(`
      <h2 style="color: #4a5e3a; margin-top: 0;">You're Invited</h2>
      <p>Hi ${name},</p>
      <p>You've been invited to create an account with The Colours of Nature. Click below to accept the invitation and set your password.</p>
      ${ctaButton(inviteUrl, "Accept Invitation")}
      <p style="color: #888; font-size: 0.85em;">This link expires in 24 hours.</p>
    `),
  };
}

// ─── Transactional email templates ───────────────────────────────────────────

export function buildOrderConfirmationEmail(
  customerName: string,
  orderRef: string,
  items: Array<{ name: string; quantity: number; unit_price: number }>,
  total: number,
): { subject: string; html: string } {
  const itemRows = items.map((i) =>
    `<tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #f0ede8;">${i.name}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #f0ede8; text-align: center;">${i.quantity}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #f0ede8; text-align: right;">£${(i.unit_price * i.quantity).toFixed(2)}</td>
    </tr>`
  ).join("");
  return {
    subject: `Order Confirmed — #${orderRef}`,
    html: layout(`
      <h2 style="color: #4a5e3a; margin-top: 0;">Thank you, ${customerName}!</h2>
      <p>Your order has been confirmed and is being prepared. We'll let you know when it's on its way.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 0.9em;">
        <thead>
          <tr style="border-bottom: 2px solid #4a5e3a;">
            <th style="text-align: left; padding: 8px 0;">Item</th>
            <th style="text-align: center; padding: 8px 0;">Qty</th>
            <th style="text-align: right; padding: 8px 0;">Price</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding: 12px 0 0; font-weight: bold;">Total</td>
            <td style="padding: 12px 0 0; text-align: right; font-weight: bold;">£${total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <p style="color: #888; font-size: 0.85em;">Order reference: <strong>#${orderRef}</strong></p>
      <p style="color: #888; font-size: 0.85em;">
        Questions? Contact us at <a href="mailto:shop@thecoloursofnature.com" style="color: #4a5e3a;">shop@thecoloursofnature.com</a>
      </p>
    `),
  };
}

export function buildOrderShippedEmail(
  customerName: string,
  orderRef: string,
  carrier: string,
  trackingNumber: string,
): { subject: string; html: string } {
  return {
    subject: `Your order is on its way — #${orderRef}`,
    html: layout(`
      <h2 style="color: #4a5e3a; margin-top: 0;">Your order has been shipped!</h2>
      <p>Dear ${customerName},</p>
      <p>Great news — your order <strong>#${orderRef}</strong> is on its way to you.</p>
      <div style="background: #f5f3ef; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 8px;"><strong>Carrier:</strong> ${carrier}</p>
        <p style="margin: 0;"><strong>Tracking Number:</strong> ${trackingNumber}</p>
      </div>
      <p style="color: #888; font-size: 0.85em;">
        Questions? Contact us at <a href="mailto:shop@thecoloursofnature.com" style="color: #4a5e3a;">shop@thecoloursofnature.com</a>
      </p>
    `),
  };
}

export function buildReturnRejectedEmail(
  customerName: string,
  orderRef: string,
  adminNote: string | null,
): { subject: string; html: string } {
  return {
    subject: `Return Request Update — Order #${orderRef}`,
    html: layout(`
      <h2 style="color: #4a5e3a; margin-top: 0;">Return Request Update</h2>
      <p>Dear ${customerName},</p>
      <p>Unfortunately, your return request for order <strong>#${orderRef}</strong> could not be approved at this time.</p>
      ${adminNote ? `<div style="background: #f5f3ef; padding: 16px; border-radius: 8px; margin: 20px 0;"><p style="margin: 0;">${adminNote}</p></div>` : ""}
      <p>If you have questions, please contact us at <a href="mailto:shop@thecoloursofnature.com" style="color: #4a5e3a;">shop@thecoloursofnature.com</a></p>
    `),
  };
}

export function buildReturnCompletedEmail(
  customerName: string,
  orderRef: string,
): { subject: string; html: string } {
  return {
    subject: `Return Completed — Order #${orderRef}`,
    html: layout(`
      <h2 style="color: #4a5e3a; margin-top: 0;">Return Completed</h2>
      <p>Dear ${customerName},</p>
      <p>Your return for order <strong>#${orderRef}</strong> has been fully processed.</p>
      <p>If a refund was agreed, please allow 3–5 business days for it to appear on your original payment method.</p>
      <p style="color: #888; font-size: 0.85em;">
        Questions? Contact us at <a href="mailto:shop@thecoloursofnature.com" style="color: #4a5e3a;">shop@thecoloursofnature.com</a>
      </p>
    `),
  };
}

export function buildReturnApprovalEmail(
  customerName: string,
  orderRef: string,
  instructions: string,
): { subject: string; html: string } {
  return {
    subject: `Return Approved — Order #${orderRef}`,
    html: layout(`
      <h2 style="color: #4a5e3a; margin-top: 0;">Return Request Approved</h2>
      <p>Dear ${customerName},</p>
      <p>Your return request for order <strong>#${orderRef}</strong> has been approved.</p>
      <div style="background: #f5f3ef; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #4a5e3a;">Return Instructions</h3>
        <p style="white-space: pre-wrap; margin: 0;">${instructions}</p>
      </div>
      <p>Once you have shipped the item, please log in to your account and mark the return as shipped.</p>
      <p style="color: #888; font-size: 0.85em;">
        If you have any questions, reply to this email or contact us at shop@thecoloursofnature.com
      </p>
    `),
  };
}
