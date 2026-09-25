# Landing Page Redesign — Full-Width, Editorial Layout

## Summary
Rebuild the Scratch & Split landing page to fill the full browser width — distinct full-bleed sections with generous whitespace and real content density, matching sorted.io's structural layout. Keep the existing colour palette and sky background. Tone pulls slightly cleaner: less emoji in body copy, more whitespace, more editorial feel. Visitor and authenticated states are preserved.

---

## What is wrong right now
The entire landing page is wrapped in `max-w-sm` (384px) — it looks like a narrow mobile column on any screen wider than 400px. The fix is layout-level: widen the container and restructure the hero into a 2-column layout on desktop.

---

## Architecture
- Blockchain: Arc Testnet — no contract changes
- Frontend: React + Tailwind + framer-motion
- Wallet: Privy (existing, no changes)
- New components: StatsBar, UseCaseSection, FaqSection
- Modified components: LandingHero, HowItWorks, FooterCard, Layout

---

## Section Map (top to bottom)

### 1. Nav bar (already in Layout.tsx)
Already full-width. No change needed.

### 2. Hero — full-width 2-col on desktop
- Left col: headline, sub, CTA buttons, visitor carousel OR occasion cards
- Right col: scratch card visual mockup (CSS-drawn, no image dependency)
- On mobile: stacks to single column, visual drops below CTA
- Max width: `max-w-7xl mx-auto px-6 lg:px-20`
- Background: existing sky gradient + clouds from Layout (no change)

### 3. Stats bar — new `StatsBar.tsx`
Full-width strip with subtle top/bottom border:
- 1B+ USDC settled on Arc
- Sub-second finality
- No wallet needed to open
- Free to claim on testnet

### 4. Use case rows — new `UseCaseSection.tsx`
3 alternating rows (text left/visual right, then flip):
1. "Send a birthday surprise" — photo + message under foil
2. "Buy someone a coffee" — $1 USDC, 30 seconds, any phone
3. "Cross-border family gifts" — USDC lands instantly, no exchange rate

Each row: large headline, 2–3 lines of editorial body copy, coloured accent, a simple illustrative element (CSS card mock or emoji-based visual block).

### 5. How It Works — widened `HowItWorks.tsx`
Already has 4 step cards. Remove any narrow wrapper — let it use the full `max-w-7xl` column. Heading gets slightly larger on desktop.

### 6. FAQ accordion — new `FaqSection.tsx`
6 questions, framer-motion `height` animation on expand/collapse, chevron rotates:
1. Does the recipient need a crypto wallet?
2. How long does the USDC stay locked?
3. What is Arc and why does it matter?
4. Can I send to someone in another country?
5. What happens if the gift isn't claimed?
6. Is the photo private?

### 7. Footer CTA band — rewrite `FooterCard.tsx`
Full-bleed dark navy (`#1E293B`) band:
- Large headline: "Ready to send your first gift?"
- Sub: "It takes 30 seconds. No crypto experience needed."
- Sign-in button (sky blue) for visitors / "Create a gift" button for authenticated users
- 3-column footer links below the CTA (Brand | Links | Chain stats) — keep existing content, just go full-width

---

## Files to Create / Modify

1. `src/components/Layout.tsx` — widen content column; replace `max-w-sm` / narrow wrapper with `max-w-7xl mx-auto px-6 lg:px-20`
2. `src/components/LandingHero.tsx` — 2-col hero on desktop; text/CTA left, scratch card mockup right; all downstream sections wired inside
3. `src/components/HowItWorks.tsx` — remove narrow container, full `max-w-7xl` width
4. `src/components/FooterCard.tsx` — full-bleed navy CTA band + 3-col footer, goes full-width
5. `src/components/StatsBar.tsx` — new: 4 stats horizontal strip
6. `src/components/UseCaseSection.tsx` — new: 3 alternating text + visual rows
7. `src/components/FaqSection.tsx` — new: accordion, 6 questions, framer-motion height

---

## Build Sequence

1. Widen `Layout.tsx` — swap narrow wrapper for `max-w-7xl`; confirm sky background still full-bleed
2. Rewrite hero in `LandingHero.tsx` — 2-col desktop layout, text+CTA left, visual right; preserve visitor carousel + auth occasion cards; wire new sections below
3. Write `StatsBar.tsx` and add it below the hero
4. Write `UseCaseSection.tsx` — 3 alternating rows
5. Widen `HowItWorks.tsx` — remove narrow wrapper
6. Write `FaqSection.tsx` — accordion
7. Rewrite `FooterCard.tsx` — full-bleed navy band + CTA + 3-col footer
8. Lint + typecheck (`bun run check`)
9. Fix any errors
10. Deploy to Netlify

---

## User Answers (confirmed)
- Layout: full-width sections, edge to edge with wide padding (like sorted.io)
- New sections: use case rows + FAQ accordion + big footer CTA
- Tone: slightly cleaner — less emoji, more whitespace, more editorial feel

## Done When
- [ ] Landing page content spans edge to edge on a 1440px desktop — no narrow mobile column
- [ ] Hero is 2-col on desktop: text/CTA left, scratch card visual right
- [ ] Stats bar shows 4 stats in a clean horizontal strip
- [ ] 3 use case rows with alternating text/visual layout, editorial copy
- [ ] How It Works uses full page width
- [ ] FAQ accordion opens/closes with smooth height animation
- [ ] Footer CTA band is full-bleed dark navy with sign-in/create button
- [ ] Visitor carousel still works; authenticated occasion cards still work
- [ ] `bun run check` zero errors
- [ ] Live at tutorquest.okelo.tech
