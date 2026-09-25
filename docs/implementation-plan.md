Please don't paste the API key in chat — it gets logged in the conversation history. Add it directly to two places only:

**1. Your local `.env` file** (in the Code panel, open `.env` and add):
```
ONRAMP_API_KEY=<your key>
```
No `VITE_` prefix — this key must never reach the browser bundle.

**2. Netlify dashboard** — Site configuration → Environment variables → Add variable:
- Key: `ONRAMP_API_KEY`
- Value: your key
- Scope: **Functions** only (not Builds, not Runtime)

Once you've added it to both places, let me know and I'll write the implementation plan based on your answers to the three questions above.
