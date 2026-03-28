// Auth hook: send_email
// Intercepts all Supabase auth emails and sends them via Resend API.
// Register this as the Send Email hook in:
//   Supabase Dashboard → Authentication → Hooks → Send Email Hook

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  sendEmail,
  buildConfirmationEmail,
  buildPasswordResetEmail,
  buildMagicLinkEmail,
  buildEmailChangeEmail,
  buildInviteEmail,
} from "../_shared/email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// Map Supabase action types to the verify endpoint's `type` param
const VERIFY_TYPE: Record<string, string> = {
  signup: "signup",
  recovery: "recovery",
  magiclink: "magiclink",
  invite: "invite",
  email_change_new: "email_change",
  email_change_current: "email_change",
};

serve(async (req) => {
  let payload: {
    user: { email: string; user_metadata?: Record<string, string> };
    email_data: {
      token: string;
      token_hash: string;
      redirect_to: string;
      email_action_type: string;
    };
  };

  try {
    payload = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const { user, email_data } = payload;
  const { token_hash, redirect_to, email_action_type } = email_data;

  // Build the verification link — always use the Supabase project URL, not
  // email_data.site_url which is the frontend URL, not the auth server URL.
  const type = VERIFY_TYPE[email_action_type] ?? email_action_type;
  const verifyUrl =
    `${SUPABASE_URL}/auth/v1/verify?token=${token_hash}&type=${type}&redirect_to=${encodeURIComponent(redirect_to)}`;

  const name =
    user.user_metadata?.full_name ??
    user.user_metadata?.first_name ??
    "there";

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
    await sendEmail(user.email, subject, html);
  } catch (err) {
    console.error("Failed to send auth email:", err);
    // Return 500 so Supabase knows delivery failed
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({}), {
    headers: { "Content-Type": "application/json" },
  });
});
