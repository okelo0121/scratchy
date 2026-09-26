Clear diagnosis. `Unexpected token 'T', "The page c"... is not valid JSON` means the Netlify function `/api/onramp/sessions` is returning an HTML error page instead of JSON. That happens when the function either doesn't exist on the deployed site or the `ONRAMP_API_KEY` env var is missing — Netlify returns a 404/500 HTML page, and the frontend tries to parse it as JSON and fails.

Let me check the function: The function code is correct — it returns proper JSON in all cases. The `"The page c..."` error means the request to `/api/onramp/sessions` is hitting a Netlify 404 page (HTML starting with "The page c...ould not be found") — which means **the function wasn't bundled in this deploy**, most likely because the `ONRAMP_API_KEY` env var wasn't set in Netlify before the deploy, so Netlify skipped the functions directory, OR the `netlify.toml` redirect isn't matching.

Let me check: The `netlify.toml` is correct. The issue is that the `/api/onramp/sessions` redirect maps to `/.netlify/functions/onramp/sessions` — but the function file is named `onramp-sessions.ts`, not `onramp/sessions.ts`. Netlify maps the filename directly, so `/api/onramp/sessions` tries to call a function named `onramp/sessions` which doesn't exist.

Fixing the redirect to match the actual function filename:I'm in Plan mode. Switch to **Build mode** and I'll apply this one-line fix and redeploy immediately.

**What's wrong:** `/api/onramp/sessions` maps via the wildcard `*` redirect to `/.netlify/functions/onramp/sessions` — but the function is named `onramp-sessions.ts`, not `onramp/sessions.ts`. Netlify can't find it and returns an HTML 404 page. The frontend tries to parse that as JSON and throws the "Unexpected token 'T'" error.

**The fix:** Replace the generic wildcard `/api/*` redirect with explicit named redirects for each function — `onramp/sessions → onramp-sessions`, `passkey-claim → passkey-claim`, `relayer → relayer-proxy`. One file change, one redeploy, done.
