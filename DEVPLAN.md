# Dev plan — reference-site parity for alexandruhera.com

Teardown of a reference portfolio site (reviewed 2026-07-13) mapped onto this Astro
project. Goal: match its *feel* — dark-first, mono-accented, quietly animated security
consultant site — without adopting its stack weight.

## 1. How the reference site is constructed (teardown)

**Stack** (from HTML shell + `assets/index-*.js` / `index-*.css`):

- Manus-generated **React SPA** (Vite build), client-side routing. Routes: `/`, `/about`,
  `/services`, `/blog`, `/contact` (+ project outlinks). No SSR/prerender — one JS bundle
  (~1 MB) does everything. We already beat this with static Astro; keep it that way.
- **Tailwind v4 + shadcn/ui token system** — oklch custom properties on `:root` (light)
  with a `.dark` class override: `--background: oklch(12% .02 260)` dark /
  `oklch(98% .002 240)` light, `--card: oklch(15% .02 260)`, `--primary: oklch(60% .15 240)`,
  `--border: oklch(90%/26% .01-.02 240-260)`, `--muted-foreground: oklch(50% .02 260)`.
  → Our `global.css` tokens are already these values. **Parity: done.**
- **Fonts**: Google Fonts — Inter 300–700 (body/headings) + JetBrains Mono 400/500/700
  (eyebrows, nav, code, terminal). → We self-host both via @fontsource. **Parity: done**
  (and CSP-clean; the reference site leaks to fonts.googleapis.com).
- **Icons**: lucide-react (sun/moon theme toggle, arrows, social marks). Also Radix UI
  primitives (tooltip) and framer-motion for animation, react-markdown + highlight.js
  for blog posts, and a small newsletter subscribe/unsubscribe API.
- **Theme**: dark by default, sun/moon toggle, localStorage persistence. → Ours: same
  behavior with a ~10-line inline script. **Parity: done** (toggle glyph is ◐ — see §3.2).

**Page anatomy** (strings recovered from the bundle):

- **Nav**: sticky header — wordmark left; Home / About / Services / Blog / Contact;
  theme toggle right.
- **Hero**: eyebrow (`DEFENDPOINT CONSULTING` in mono caps), name + role headline, and an
  **animated terminal/SOC vignette**: typed `whoami`, a Sigma rule fragment
  (`CommandLine|contains: 'vbscript:'`), a `C2 Beacon Established` alert card — a small
  scripted detection story. CTAs to Contact/About.
- **Services grid**: bordered cards — "Deep DFIR Expertise", "Detection Engineering",
  "Threat Hunting", "Telemetry Analysis", "Custom Sigma & YARA Rule Development",
  "Detection Logic Development".
- **Projects & Research cards**: EDR Telemetry Project ("Analyzing telemetry capabilities
  of 20+ EDR solutions."), EDR Comparison, Threat Hunting Labs — external links.
- **"Beyond the Keyboard"**: personal cards (street photography, electronic music) —
  humanizing section.
- **Availability strip**: "Available for remote engagements worldwide."
- **Blog**: markdown posts with syntax highlighting, "Back to Blog", newsletter subscribe.
- **Contact**: form (name / email / subject / message) + company contact.
- **Footer**: socials (GitHub / Twitter / LinkedIn), Buy Me a Coffee, project links.

## 2. Gap analysis (ours vs theirs)

| Area | Reference | alexandruhera.com today | Gap |
|---|---|---|---|
| Tokens / fonts / theme | shadcn oklch, Google Fonts | same values, self-hosted | none |
| Brand mark | none (text only) | Trail mark + two-tone wordmark | we're ahead |
| Nav | sticky, active states | same | none |
| Hero | animated terminal vignette | static text | **build** |
| Services | 6 icon cards | services.md prose | **build** |
| Projects/research | 3 outlink cards | none | **build** |
| Writing preview on home | yes | check index.astro | **verify/build** |
| Personal section | Beyond the Keyboard | none | **build (optional)** |
| Icons | lucide-react (runtime) | none | **add build-time lucide** |
| Motion | framer-motion | none | **add CSS/IO reveals** |
| Code highlighting | highlight.js (client) | Astro/Shiki (build) | ours better; pick theme |
| Newsletter | subscribe API | RSS only | skip (RSS is the answer) |
| Contact form | form → API | Turnstile + Resend function | ours better; style it |

## 3. Work plan

### Phase A — foundations (small, do first)
1. **Icons**: `npm i -D astro-icon @iconify-json/lucide`; icons render as inline SVG at
   build time — zero client JS, CSP-safe. Standard set: `shield-check`, `radar`,
   `activity`, `file-search`, `siren`, `network`, `arrow-right`, `github`, `linkedin`,
   `rss`, `mail`, `sun`, `moon`.
2. **Card primitives** in `global.css`: `.card` (bg-card, 1px border, radius, hover:
   border-accent + subtle translateY), `.eyebrow` (mono, caps, letter-spacing, accent),
   `.chip` (mono tag pill). These three utilities carry the whole reference look.
3. **Theme toggle**: swap ◐ for lucide sun/moon (two inline SVGs, CSS-toggled by
   `data-theme`) — keeps the no-JS-beyond-toggle approach.

### Phase B — homepage (the visible win)
4. **Hero** (`src/components/Hero.astro`): eyebrow (`SECURITY OPERATIONS · BUCHAREST`),
   h1 name + role, one-paragraph pitch, CTA pair (contact / services).
5. **Terminal vignette** (`src/components/Terminal.astro`): our version of their SOC
   story — mono card, traffic-light dots, typed lines: `$ whoami` → detection rule
   fragment → alert line resolved (accent-brand red for the alert, green for contained).
   Pure CSS keyframes (steps() typing), `prefers-reduced-motion: reduce` → static final
   frame. No runtime JS; if any inline script becomes necessary, re-run
   `scripts/generate-headers.mjs` for CSP hashes.
6. **Services grid** (`src/components/ServiceCard.astro` + data array in `index.astro`):
   6 cards, lucide icon + title + two lines. Draft titles: Incident Response & DFIR,
   Detection Engineering, Threat Hunting, SOC Advisory, Compliance Readiness (NIS2/DORA),
   Security Automation.
7. **Writing preview**: latest 3 posts, date in mono, arrow-right hover.
8. **Availability strip**: one-line banner above footer — "Available for remote
   engagements — EU time zones." with status dot in accent-brand.

### Phase C — inner pages
9. **Services page**: rebuild `services.md` → `services.astro` with the same card grid +
   per-service detail sections; keep prose as collection or inline.
10. **About**: add portrait-less layout — bio, certs/chips row (mono chips), timeline
    list. Optional "Beyond the keyboard" two cards at the bottom (personal texture —
    decide what Alex wants to show).
11. **Writing index/post**: mono date column, reading time, Shiki theme aligned to
    tokens (e.g. `css-variables` theme fed by `--bg-card`/`--fg`), "Back to writing"
    link, prev/next.
12. **Contact**: two-column — form card (existing Function wiring) + direct block
    (email, LinkedIn, PGP?, response-time note).

### Phase D — motion & polish
13. **Reveal-on-scroll**: single tiny IntersectionObserver script (external file, no
    inline hash issues) adding `.in-view`; CSS transitions on cards/sections;
    `prefers-reduced-motion` kills it.
14. **Hover micro-interactions**: card lift, arrow nudge, link underline slide — CSS only.
15. **QA pass**: Lighthouse ≥95 all categories, keyboard nav, focus-visible states,
    axe check, CSP re-hash (`npm run build` regenerates `_headers`), OG image with the
    new mark (add `og-image` generation to `brand/make-pack.mjs` or a static export).

## 4. Deliberate divergences from the reference site

- **Static Astro over SPA**: keep. Their 1 MB hydration bundle buys nothing we need.
- **No newsletter backend**: RSS + contact form covers it; revisit only with real demand.
- **Self-hosted fonts**: keep (CSP + GDPR cleaner than Google Fonts).
- **Brand system**: we have a mark + accent-brand (red) they don't; use it in hero,
  favicon (done), OG image, and terminal vignette accents.
- **Highlighting at build time** (Shiki) instead of client highlight.js.

## 5. Suggested order & effort

| Step | Effort |
|---|---|
| A1–A3 icons/cards/toggle | ~1 session |
| B4–B8 homepage | 1–2 sessions |
| C9–C12 inner pages | 1–2 sessions |
| D13–D15 motion + QA | ~1 session |

Launch gate unchanged: `SETUP.md` manual steps (DNS/Proton records, Turnstile, Resend)
are independent of all of the above.
