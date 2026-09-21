# Dashboard Redesign — Navy + Sky Blue

## Palette (strictly two colours)

| Token | Hex | Role |
|---|---|---|
| Navy deep | `#0F172A` | Header gradient, button shadows |
| Navy | `#1E293B` | Body text, card borders, headings |
| Sky | `#38BDF8` | All action buttons, active states, accents |
| Sky dark | `#0284C7` | Button bottom-shadow, focus rings |
| Sky light | `#E0F2FE` | Panel backgrounds, input backgrounds |
| Slate | `#F8FAFC` | Card body backgrounds, row backgrounds |
| White | `#FFFFFF` | Card surfaces, text on dark |

No coral, no lavender, no mint, no orange anywhere in Dashboard.tsx.

---

## Layout (full rewrite of Dashboard.tsx)

Three cards stacked vertically, stagger-in on mount (delay 0 / 0.08 / 0.16s).

---

### Card 1 — Create Gift Shortcut

Full-width card, sky blue gradient header (`linear-gradient(135deg, #38BDF8, #0EA5E9)`), navy bottom-shadow (`0 8px 0 0 #0F172A`), border `3px solid #38BDF8`.

Inside: two-column flex.
- Left: festive Ollie mascot (MascotSVG size=56, festive=true)
- Right: `font-display text-2xl text-white "🎁 Send a Scratch Gift"` + `font-body text-sm text-white/75 "USDC arrives in under a second"`
- Full card is a button → calls `onCreateGift()`

---

### Card 2 — Wallet Balance

Border: `3px solid #1E293B`, shadow: `0 8px 0 0 #0F172A`, background white.

#### Header strip — deep navy gradient
`background: linear-gradient(160deg, #1E293B 0%, #0F172A 100%)`

Content:
- Top row: `font-body text-xs font-800 text-white/50 uppercase tracking-widest` → "MY WALLET · ARC TESTNET"
- Balance: `font-display text-5xl text-white` — `{balanceUsdc}` + `font-body text-lg font-800 text-white/60 mb-1` → "USDC"
- Sub-row: `font-body text-sm text-white/50` → "Hi, {displayName}"

#### Address row (inside white body)
Rounded pill: slate background, navy/20 border. Monospace address truncated. Copy button: sky light background, sky dark text.

#### QR Code section
Centred below address. Generate QR from `walletAddress` using `qrcode` package (`qrcode.toDataURL(address)`). Show as `<img>` 140×140px, rounded-2xl, white background with 8px padding, navy/10 border. Label underneath: `font-body text-xs text-navy/40` → "Scan to receive USDC".

If `walletAddress` is undefined, show a 140×140 placeholder skeleton (animated pulse, sky-light bg).

#### Action buttons row
Two equal buttons, both navy deep background with sky bottom-shadow:

```
background: linear-gradient(135deg, #1E293B, #0F172A)
boxShadow: 0 5px 0 0 #0284C7
color: white
border: 2px solid #38BDF8
```

- `📤 Send` — toggles send panel
- `🏦 Withdraw` — toggles withdraw panel
- Active state (panel open): `background: #38BDF8`, `color: #0F172A`, `boxShadow: 0 5px 0 0 #0284C7`

#### Send panel (AnimatePresence slide-down)
Background: `#E0F2FE` (sky light), border: `2px solid #BAE6FD`.

- Label: "Recipient address" — `font-body text-xs font-800 text-navy/60 uppercase tracking-wider`
- Input: white bg, focus border `#38BDF8`, valid border `#0284C7`, invalid border stays sky (no red — just muted)
- Quick-pick pills ($1/$5/$10): active = `#38BDF8` bg white text, inactive = white bg sky text sky border
- Send button: `background: linear-gradient(135deg,#38BDF8,#0EA5E9)`, `boxShadow: 0 5px 0 0 #0284C7`
- TxStatusBadge (sky/navy themed)
- "Send another" link

#### Withdraw panel (AnimatePresence slide-down)
Same sky-light background as send panel.

- Saved address chips: active = navy bg white text, inactive = sky-light bg navy text sky border
- Toggle switch: off = slate, on = `#38BDF8`
- Max button: sky-light bg, sky-dark text
- Withdraw button: same as Send button style
- Address book label input: white bg, sky border

---

### Card 3 — Gift History

Border: `3px solid #1E293B`, shadow: `0 8px 0 0 #0F172A`, background white.

#### Tab header — deep navy
`background: linear-gradient(160deg, #1E293B, #0F172A)`

Two tab pills:
- Active: white bg, navy text, `boxShadow: 0 3px 0 0 #0284C7`
- Inactive: `rgba(255,255,255,0.12)` bg, white/70 text

#### Gift rows
Each row: `background: #F8FAFC`, `border: 2px solid #E2E8F0`, `rounded-2xl`.
- Emoji badge (28px)
- Label + `{amount} USDC · {date}` in navy/50
- Status pill:
  - Pending → `background: #E0F2FE, color: #0369A1, border: 1.5px solid #38BDF8`
  - Claimed → `background: #1E293B, color: white`
  - Expired → `background: #F1F5F9, color: #94A3B8`

#### Empty state
MascotSVG (thinking, 64px) + display text + "🎁 Create Gift" button in sky blue.

---

## QR code implementation

Install `qrcode` (already in most Vite scaffolds; if missing, add `bun add qrcode` + `bun add -D @types/qrcode`).

```ts
import QRCode from 'qrcode'

// In component:
const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
useEffect(() => {
  if (!walletAddress) return
  QRCode.toDataURL(walletAddress, { width: 140, margin: 1, color: { dark: '#0F172A', light: '#FFFFFF' } })
    .then(setQrDataUrl)
    .catch(() => setQrDataUrl(null))
}, [walletAddress])
```

---

## Files to edit

| File | Change |
|---|---|
| `src/components/Dashboard.tsx` | Full rewrite — navy+sky palette, QR code, Create Gift shortcut card |
| `package.json` / install | `bun add qrcode` + `bun add -D @types/qrcode` if not present |

No other files change.

---

## Done when

- [ ] Dashboard uses ONLY navy + sky blue — no coral, lavender, mint, or orange
- [ ] Create Gift shortcut card at top (sky gradient, festive Ollie)
- [ ] Balance card: deep navy header, large USDC amount, QR code for wallet address
- [ ] Send + Withdraw action buttons styled navy with sky blue border + shadow
- [ ] Send panel opens inline, all inputs sky-light themed
- [ ] Withdraw panel opens inline, saved address chips navy/sky themed
- [ ] Gift history card: navy header, tabs, sky/navy status pills
- [ ] `bun run check` passes zero errors
