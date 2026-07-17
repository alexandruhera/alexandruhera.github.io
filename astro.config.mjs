// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";

/** Dev-only stand-in for the Cloudflare Pages Function at /api/contact
 * (functions/api/contact.ts), which only runs on Cloudflare. Lets the contact
 * form be exercised locally: logs the submission, redirects to the thanks
 * page. The route is injected only under `astro dev` — no effect on builds.
 * @type {import("astro").AstroIntegration} */
const devContactStub = {
  name: "dev-contact-stub",
  hooks: {
    "astro:server:setup"({ server }) {
      const stub = {
        route: "",
        handle(req, res, next) {
          if (req.method !== "POST" || !req.url?.startsWith("/api/contact")) {
            return next();
          }
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", () => {
            const form = new URLSearchParams(body);
            console.log("[dev-contact-stub] form submission:", {
              name: form.get("name"),
              email: form.get("email"),
              subject: form.get("subject"),
              message: form.get("message"),
            });
            res.statusCode = 303;
            res.setHeader("Location", "/contact/thanks/");
            res.end();
          });
        },
      };
      // Astro unshifts its route-guard/trailing-slash middlewares AFTER
      // integration hooks run, and its guards 404 the unknown /api/contact
      // route before anything added here via use(). Deferring our unshift to
      // the listening event puts the stub at the true front of the stack.
      const front = () => server.middlewares.stack.unshift(stub);
      if (server.httpServer?.listening) front();
      else if (server.httpServer) server.httpServer.once("listening", front);
      else setTimeout(front, 0);
    },
  },
};

export default defineConfig({
  site: "https://alexandruhera.com",
  trailingSlash: "always",
  integrations: [sitemap(), icon(), devContactStub],
  markdown: {
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    },
  },
});
