// Auth hook: send_email
// Intercepts all Supabase auth emails and sends them via Resend API.

import {
  sendEmail,
  buildConfirmationEmail,
  buildPasswordResetEmail,
  buildMagicLinkEmail,
  buildEmailChangeEmail,
  buildInviteEmail,
} from "../_shared/email.ts";

const PROJECT_URL = Deno.env.get("PROJECT_URL")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

// Map Supabase action types to the verify endpoint's `type` param
const VERIFY_TYPE: Record<string, string> = {
  signup: "signup",
  recovery: "recovery",
  magiclink: "magiclink",
  invite: "invite",
  email_change_new: "email_change",
  email_change_current: "email_change",
};

Deno.serve(async (req) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  let payload;
  try {
    payload = await req.json();
    console.log("[send-auth-email] Received payload type:", payload?.email_data?.email_action_type);
  } catch (err) {
    console.error("[send-auth-email] Failed to parse payload:", err);
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { user, email_data } = payload;
  const { token_hash, redirect_to, email_action_type } = email_data;

  const type = VERIFY_TYPE[email_action_type] ?? email_action_type;
  const verifyUrl = `${PROJECT_URL}/auth/v1/verify?token=${token_hash}&type=${type}&redirect_to=${encodeURIComponent(redirect_to)}`;

  const name = user.user_metadata?.full_name ?? user.user_metadata?.first_name ?? "there";

  let subject: string;
  let html: string;

  switch (email_action_type) {
    case "signup":
      ({ subject, html } = buildConfirmationEmail(name, verifyUrl));
      break;
    case "recovery":
      ({ subject, html } = buildPasswordResetEmail(name, verifyUrl));
      break;
    case "magiclink":
      ({ subject, html } = buildMagicLinkEmail(name, verifyUrl));
      break;
    case "email_change_new":
    case "email_change_current":
      ({ subject, html } = buildEmailChangeEmail(name, verifyUrl));
      break;
    case "invite":
      ({ subject, html } = buildInviteEmail(name, verifyUrl));
      break;
    default:
      ({ subject, html } = buildConfirmationEmail(name, verifyUrl));
  }

  try {
    console.log(`[send-auth-email] Attempting to send ${email_action_type} to ${user.email}`);
    await sendEmail(user.email, subject, html);
    console.log(`[send-auth-email] Success!`);
    return new Response(JSON.stringify({ status: "success" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[send-auth-email] Error:`, err);
    return new Response(JSON.stringify({ 
      error: String(err),
      details: "Check RESEND_API_KEY and PROJECT_URL secrets."
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
