Clear — Vercel is treating the function as Node.js style (`req, res`) not Web API style. The fix is to export a named `POST` function instead of a default export. Fixing all three API files now: All three use `export default async function handler`. Changing all to named `export async function POST` — the correct Vercel Web API signature:You're in Plan mode. Switch to **Build mode** using the mode selector and I'll apply the fix immediately. Here's exactly what changes — one line in each of the three files:

**All three files:** replace `export default async function handler(req: Request)` with named HTTP method exports:

```ts
// BEFORE (broken on Vercel)
export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') { ... }
  if (req.method !== 'POST') { ... }
  // actual logic
}

// AFTER (correct Vercel Web API)
export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(req: Request): Promise<Response> {
  // actual logic — no method checks needed
}
```

Vercel routes each HTTP method to the matching named export. `POST` only handles POST requests, `OPTIONS` only handles CORS preflight. The method-checking `if` blocks inside the handler body are removed since they're no longer needed.

Switch to Build mode and I'll make all three edits and push in one shot.
