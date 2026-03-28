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
