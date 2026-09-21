Reading the current Dashboard fully before making changes. Good, I have everything I need. Now making all targeted changes: **Change 1 — Rewrite mobile top nav**: remove owl, "scratch & split", "+ Create Gift", "↓ Receive / ↑ Withdraw", red "Sign out" text. Replace with a clean 3-item bar: balance display left, clock icon centre, profile chip right (with dropdown for sign out):This session is still in Plan mode. I can see you clicked "proceed" but the mode selector needs to be manually switched to **Build mode** — look for the toggle in the top-right of the Arc Studio interface and switch from "Plan" to "Build".

Here is the complete, precise list of every change ready to execute the moment you switch:

---

**Six changes — all targeted edits to Dashboard.tsx:**

**1. Mobile nav — clean rebuild**
Remove: owl icon, "scratch & split" text, "+ Create Gift" button, "↓ Receive / ↑ Withdraw" button, red "Sign out" text link.
Replace with a 3-zone bar:
- Left: balance display (large number + USDC label, or `••••` when hidden)
- Centre: eye-toggle button (circle icon, 32×32) + clock-activity toggle button (same size)
- Right: profile chip (avatar initial + name truncated + `▾`) → tapping opens dropdown with name, short address, "Copy address", divider, "Sign out" (with logout SVG icon). Dropdown opens downward on mobile (not upward).

**2. Move Receive/Withdraw into left sidebar**
On desktop sidebar: after the sub-accounts block, add a `Receive/Withdraw` segmented control + the `receivePanelJsx`/`withdrawPanelJsx` inline (same as the right panel Card A, but now inside the sidebar). The drawer button on mobile shows this same panel.

**3. Remove "LIVE ON ARC" pill from hero card**
Find and remove the `<span>` / `<div>` containing `LIVE ON ARC` or `Live on Arc` from the hero card JSX.

**4. Fix hero card button overlap on mobile**
The hero card uses `flex-1` and the button is `absolute` positioned. On mobile it sits on top of the Ollie mascot. Fix: change the hero card layout to `flex flex-col gap-6 justify-between` and make the CTA button `w-full` below the headline text — not absolutely positioned. On desktop keep the existing positioning.

**5. Remove "LIVE ON ARC" / "Live on Arc" from desktop hero too** (same pill).

**6. Right column Card A** — only shows on desktop, already removed from mobile (which now uses sidebar). Keep Card A on desktop as-is.

Switch to **Build mode** now using the mode selector.
