Good move. Vercel is cleaner than Netlify for this stack. The main things to fix are:

1. **`netlify.toml`** — Vercel ignores it entirely. We need a `vercel.json` with the equivalent redirects.
2. **`netlify/functions/`** — Vercel uses a different functions convention: `api/` directory at the root, each file is a serverless function, and the filename maps directly to the route.
3. **The function runtime** — Netlify used `@netlify/functions` types. Vercel uses plain `Request`/`Response` (Web API) or `req`/`res` (Node.js). We'll use the Web API style since the functions are already written that way.

Let me read the current functions to understand what needs to change: Good — I have everything I need. The functions use Netlify-specific types (`Handler`, `Context`) and the Netlify event API. For Vercel they need to be plain Web API `Request` → `Response` exports named `GET`/`POST` or a default export. Here's what I'm doing: I'm in Plan mode. Switch to **Build mode** and I'll do all of this in one shot. Here's exactly what will happen:

---

**1. Create `vercel.json`**
```json
{
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/api/onramp/sessions", "destination": "/api/onramp/sessions" },
    { "source": "/api/relayer",         "destination": "/api/relayer" },
    { "source": "/api/passkey-claim",   "destination": "/api/passkey-claim" },
    { "source": "/(.*)",                "destination": "/index.html" }
  ]
}
```

**2. Create `api/` directory with 3 Vercel functions**

Vercel uses `api/filename.ts` → route `/api/filename`. For nested routes like `/api/onramp/sessions`, the file lives at `api/onramp/sessions.ts`.

- `api/onramp/sessions.ts` — converted from Netlify `Context` to plain Web API
- `api/relayer.ts` — converted from `Handler` event API to Web API
- `api/passkey-claim.ts` — converted from `Handler` to Web API

**3. Remove the Netlify-specific imports**

Drop `import type { Handler } from '@netlify/functions'` and `import type { Context } from '@netlify/functions'` from all three files. The function signatures change from `handler(event)` → `export default async function handler(req: Request)`.

**4. Push to GitHub**

Vercel auto-deploys on every push to `main`. Once pushed, it's live.

Switch to Build mode now and I'll execute all of this.
