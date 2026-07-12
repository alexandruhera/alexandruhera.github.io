---
title: Contact
description: Get in touch with Alexandru Hera for consulting inquiries or anything else.
---

# Contact

Have a question, a consulting inquiry, or just want to talk security operations?
Send me a message — I read everything and reply to anything serious.

<!--
Turnstile sitekey below is Cloudflare's public TEST key (always passes).
Replace with the real sitekey after creating the Turnstile widget (Phase 5.8).
-->

<form class="contact-form" method="POST" action="/api/contact">
  <label for="cf-name">Name</label>
  <input id="cf-name" name="name" type="text" maxlength="200" required>

  <label for="cf-email">Email</label>
  <input id="cf-email" name="email" type="email" maxlength="254" required>

  <label for="cf-message">Message</label>
  <textarea id="cf-message" name="message" rows="8" maxlength="5000" required></textarea>

  <!-- Honeypot: hidden from humans, bots fill it in -->
  <div class="cf-website-field" aria-hidden="true">
    <label for="cf-website">Website</label>
    <input id="cf-website" name="website" type="text" tabindex="-1" autocomplete="off">
  </div>

  <div class="cf-turnstile" data-sitekey="1x00000000000000000000AA"></div>

  <button type="submit" class="md-button md-button--primary">Send message</button>
</form>

<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>

If you prefer email: [alex@alexandruhera.com](mailto:alex@alexandruhera.com)
