/**
 * Contact form handler (Cloudflare Pages Function).
 *
 * Flow: honeypot + size validation → Turnstile server-side verification →
 * email via Resend API → 303 redirect to /contact/thanks/.
 *
 * Secrets (set with `wrangler pages secret put`):
 *   TURNSTILE_SECRET_KEY — Turnstile widget secret
 *   RESEND_API_KEY       — Resend sending-only API key
 */

interface Env {
  TURNSTILE_SECRET_KEY: string;
  RESEND_API_KEY: string;
  // optional overrides (e.g. .dev.vars uses Resend's onboarding sender while
  // send.alexandruhera.com is unverified); production uses the defaults
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
}

const LIMITS = { name: 200, email: 254, subject: 200, message: 5000 } as const;
const TO_ADDRESS = "contact@alexandruhera.com";
const FROM_ADDRESS = "Website contact form <form@send.alexandruhera.com>";

function fail(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "Invalid form submission.");
  }

  // Honeypot: real users never see this field. Pretend success for bots.
  if ((form.get("website") as string)?.trim()) {
    return Response.redirect(new URL("/contact/thanks/", request.url).toString(), 303);
  }

  const name = ((form.get("name") as string) ?? "").trim();
  const email = ((form.get("email") as string) ?? "").trim();
  // optional; collapse whitespace/newlines so it's safe as an email subject
  const subject = ((form.get("subject") as string) ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const message = ((form.get("message") as string) ?? "").trim();

  if (!name || !email || !message) {
    return fail(400, "Name, email, and message are required.");
  }
  if (
    name.length > LIMITS.name ||
    email.length > LIMITS.email ||
    subject.length > LIMITS.subject ||
    message.length > LIMITS.message ||
    !email.includes("@")
  ) {
    return fail(400, "A field is too long or the email address is invalid.");
  }

  // Turnstile verification (server side)
  const token = (form.get("cf-turnstile-response") as string) ?? "";
  const verify = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: request.headers.get("CF-Connecting-IP") ?? "",
      }),
    },
  );
  const outcome = (await verify.json()) as { success: boolean };
  if (!outcome.success) {
    return fail(403, "Human verification failed. Go back and try again.");
  }

  // Send via Resend — plain text only, submitter content never rendered as HTML.
  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.CONTACT_FROM ?? FROM_ADDRESS,
      to: [env.CONTACT_TO ?? TO_ADDRESS],
      reply_to: email,
      subject: subject
        ? `[alexandruhera.com] ${subject}`
        : `[alexandruhera.com] Message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}\n`,
    }),
  });

  if (!send.ok) {
    return fail(502, "Could not send your message right now. Please email me directly.");
  }

  return Response.redirect(new URL("/contact/thanks/", request.url).toString(), 303);
};
