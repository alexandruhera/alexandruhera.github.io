# Launch checklist — alexandruhera.com

Everything code-side is done and committed. The remaining steps need your
accounts and credentials. Work top to bottom; each step says who does it.

## 1. GitHub (~5 min)

- [ ] **YOU:** `gh auth login` (GitHub.com, HTTPS, browser; scopes: repo + workflow)
- [ ] **CLAUDE (after auth):** create repo + push, enable branch protection,
      secret scanning, Dependabot; set `CLOUDFLARE_API_TOKEN` /
      `CLOUDFLARE_ACCOUNT_ID` secrets (values from step 2)
- [ ] **YOU (optional):** change git identity if you prefer the GitHub noreply
      address: `git config user.email "<id>+alexandruhera@users.noreply.github.com"`

## 2. Cloudflare account + DNS (~30 min — the careful part)

- [ ] **YOU:** create free account at dash.cloudflare.com, enable 2FA
- [ ] **YOU:** at your current DNS host (wherever alexandruhera.com's records
      live today — check your registrar), export/screenshot **every** DNS record.
      Must capture: 4× GitHub Pages A records, `www` CNAME, **Proton MX ×2,
      SPF TXT, 3× `protonmail*._domainkey` DKIM CNAMEs, `_dmarc` TXT,
      `protonmail-verification` TXT** — paste them into `docs-internal/dns-export.txt`
      here so Claude can verify the reconciliation
- [ ] **YOU:** Cloudflare → Add site → alexandruhera.com → Free plan. Compare
      the auto-imported records against your export; add anything missing.
      Mail-related records: **DNS only (grey cloud)**. Keep GH Pages records
      for now — old site stays up until cutover.
- [ ] **YOU:** if DNSSEC is enabled at the current host, disable it and wait
      for TTL expiry BEFORE the next step (skip if never enabled)
- [ ] **YOU:** at the registrar, switch nameservers to the two Cloudflare ones
- [ ] **YOU:** Cloudflare → My Profile → API Tokens → Create custom token:
      permission "Account → Cloudflare Pages → Edit" only. Save token + your
      Account ID (dashboard right sidebar) — give both to Claude for step 1

## 3. Cloudflare Pages project (~10 min)

- [ ] **CLAUDE (or you):** `npx wrangler pages project create alexandruhera-com
      --production-branch main` then push to main → CI deploys; verify
      `https://alexandruhera-com.pages.dev`
- [ ] **YOU:** dashboard → Turnstile → Add widget (domains: alexandruhera.com,
      alexandruhera-com.pages.dev), Managed mode → copy the **sitekey** into
      `docs/contact.md` (replace the `1x00…AA` test key) and run:
      `npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name alexandruhera-com`
- [ ] **YOU:** resend.com → free account → Domains → add `send.alexandruhera.com`
      → add the 3 DNS records it shows into Cloudflare DNS → verify → create
      **sending-only** API key → 
      `npx wrangler pages secret put RESEND_API_KEY --project-name alexandruhera-com`

## 4. Cutover (~15 min, after `dig NS alexandruhera.com` shows Cloudflare)

- [ ] **YOU:** send + receive a test email on alex@alexandruhera.com (Proton
      settings → domain checks all green) — do not proceed until this works
- [ ] **YOU:** Pages project → Custom domains → add `alexandruhera.com` and
      `www.alexandruhera.com`
- [ ] **YOU:** SSL/TLS → Overview → **Full (strict)**; Edge Certificates →
      **Always Use HTTPS** on
- [ ] **YOU:** verify https://alexandruhera.com serves the new site and
      https://www.alexandruhera.com 301-redirects to apex
- [ ] **YOU:** decommission the old site: old GitHub Pages repo → Settings →
      Pages → remove custom domain, then archive or delete the repo
- [ ] **YOU:** Cloudflare → DNS → DNSSEC → Enable → add the DS record at the
      registrar

## 5. Post-launch verification (Claude can drive most of this)

- [ ] securityheaders.com → target A/A+; SSL Labs → A+
- [ ] Contact form end-to-end: real submit arrives with correct Reply-To;
      JS-off submit works; tampered Turnstile token → 403
- [ ] Email still perfect: external round-trip, Authentication-Results shows
      SPF/DKIM/DMARC pass
- [ ] /feed.xml passes the W3C feed validator; sitemap lists all pages
- [ ] CAA records added (Cloudflare Universal SSL CAs — verify current list:
      letsencrypt.org, pki.goog, ssl.com) + iodef mailto
- [ ] After 1 clean week: raise HSTS max-age to 31536000 in `static/_headers`
- [ ] After 2–4 weeks of DMARC reports: tighten `_dmarc` p=none → quarantine → reject

## Day-to-day authoring (after launch)

```bash
# new post
git switch -c post/my-topic
$EDITOR src/content/writing/my-topic.md   # front matter: title, date, description (+ draft: true while writing)
npm run dev                      # local preview with drafts at :4321
git push → open PR → CI comments preview URL → merge → live in ~2 min
```

Zensical is alpha: upgrades arrive as Dependabot PRs — check the preview URL
before merging. If a release breaks things, the config is Material-shaped, so
falling back to Material for MkDocs is a contained change.
