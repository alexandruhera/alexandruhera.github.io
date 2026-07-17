# Launch checklist — alexandruhera.com

Everything code-side is done and committed. The remaining steps need your
accounts and credentials. Work top to bottom; each step says who does it.

Launch is two-phase: **V1 goes live now on GitHub Pages** (DNS already points
there from the old site, so no DNS work), **V2 moves hosting to Cloudflare**
(contact form backend, security headers, previews) on its own timeline.

## V1. Go live on GitHub Pages — DONE 2026-07-17

- [x] **YOU:** `gh auth login` (GitHub.com, HTTPS, browser; scopes: repo + workflow)
- [x] **CLAUDE:** pushed into the EXISTING `alexandruhera.github.io` repo
      instead of creating a new one — the custom domain, verified-domain
      status, and HTTPS cert (apex + www) carried over untouched, so cutover
      was zero-downtime. Old site preserved on the `legacy-site` branch.
      (`src/pages/lab/` and `/lab/` are gitignored so no PII shipped.)
- [x] **CLAUDE:** verified live: all pages 200, www→apex 301, feed.xml,
      sitemap, 404, /lab/* absent, contact shows the mailto card
- [x] **CLAUDE:** branch protection, secret scanning + push protection,
      Dependabot security updates
- [ ] **YOU (optional):** change git identity if you prefer the GitHub noreply
      address: `git config user.email "<id>+alexandruhera@users.noreply.github.com"`

Accepted V1 limitations (all fixed by V2): contact page shows a mailto card
instead of the form (`PUBLIC_DEPLOY_TARGET=gh-pages` in deploy-gh-pages.yml —
GitHub Pages can't run the /api/contact function), `static/_headers` security
headers don't apply, no PR preview deploys (preview.yml still builds and
link-checks; the deploy steps skip until Cloudflare secrets exist).

## V2 begins here — Cloudflare cutover, when ready

At cutover: set `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` repo secrets,
restore the `push` trigger in deploy.yml, delete deploy-gh-pages.yml, and
remove the Pages custom domain + disable GitHub Pages on the repo (step 4).

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
      `src/pages/contact.astro` (replace the `1x00…AA` test key) and run:
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
- [ ] **YOU:** decommission V1 hosting: this repo → Settings → Pages → remove
      custom domain and disable Pages; delete deploy-gh-pages.yml and restore
      the push trigger in deploy.yml (drops the mailto fallback — form goes live)
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

## 6. Grant Radar (post-launch feature — the venture funnel)

RAG-verified, plain-Romanian alerts for open EU funding calls in cyber/
digitalization. Funnel + authority for the annex-consultancy venture
(see `~/business_ideas/eu-grants-venture-plan-a-z.md`), never the product
itself. Every entry cites the official source and carries an
"informare, nu consultanță" disclaimer.

**Stage 1 — content collection + RSS (no backend, ship first):**

- [ ] New collection `src/content/radar/` — schema: `title`, `program`
      (PoCIDIF | PR-BI | Digital Europe | NCC-RO | other), `callId`, `status`
      (deschis/urmează/închis), `deadline`, `amounts`, `cofinancing`,
      `eligibility` (bullets), `sources` (official URLs, required),
      `verifiedDate`, `draft`
- [ ] `/radar` index page: open calls first, sorted by deadline; entry pages
      link the official ghid — never mirror it
- [ ] `/radar.xml` RSS (reuse the `feed.xml.js` pattern); link from the
      services page
- [ ] Workflow per edition (weekly): Claude Code session — fetch the official
      sources (mfe.gov.ro/PoCIDIF, oportunitati-ue.gov.ro, PR București-Ilfov,
      ncc.gov.ro, EC Funding & Tenders portal) → RAG-check the draft entry
      against the actual ghid PDF → **human verifies every date/amount against
      the cited source** → publish via the normal PR flow

**Stage 2 — email digest (only after ~4 editions exist):**

- [ ] Subscribe endpoint as a Pages Function (Turnstile-protected, same
      pattern as the contact form), storing to Resend Audiences
- [ ] Weekly digest via Resend broadcast — keep `send.alexandruhera.com`
      reputation clean; consider a separate `radar.` sending subdomain for
      broadcasts
- [ ] Double opt-in + one-click unsubscribe (GDPR)

**Validation KPI (from the council):** after 4–6 weekly editions, count
subscribers + inbound inquiries. That number settles the "discovery gap"
thesis cheaply — if it's ~zero, the Radar stays a personal monitoring tool
and the funnel bet is closed.

## Day-to-day authoring (after launch)

```bash
# new post
git switch -c post/my-topic
$EDITOR src/content/writing/my-topic.md   # front matter: title, date, description (+ draft: true while writing)
npm run dev                      # local preview with drafts at :4321
git push → open PR → CI comments preview URL → merge → live in ~2 min
```

Dependency upgrades (Astro included) arrive as weekly Dependabot PRs — check
the preview URL before merging.
