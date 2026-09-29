Two separate issues visible in this screenshot:

**1. `ERR_BLOCKED_BY_CLIENT`** on all Arc RPC endpoints — your browser's ad blocker is blocking the RPC calls. These are `rpc.testnet.arc.io`, `rpc.drpc.testnet.arc.io`, `rpc.quicknode.testnet.arc.io`, `rpc.blockdaemon.testnet.arc.io`. Not your app's fault — disable the ad blocker on `scratchy.okelo.tech` and retry.

**2. The `[object Object]` Zod error** — still inside `kit.createWallet`. The RPC block above is actually causing this — passkey-kit calls Stellar's Soroban RPC to simulate the wallet deployment transaction, and if that call is blocked by the ad blocker too, it gets back `undefined` or a network error object instead of the expected Soroban response. The Zod validator throws `[object Object] did not match [object Object]`.

**Also visible:** `pubKeyCredParams is missing ES256 and RS256` — this is a Chrome warning about the WebAuthn call inside passkey-kit. It's a warning not an error, but it hints the library version may have a quirk with Chrome's newer WebAuthn spec enforcement.

---

## What to do right now

**Step 1 — Disable the ad blocker**
On `scratchy.okelo.tech`, click your ad blocker extension icon → disable for this site. The `ERR_BLOCKED_BY_CLIENT` errors will disappear and the RPC calls will go through.

**Step 2 — Retry the passkey claim**
With the ad blocker off, the Soroban RPC simulation will succeed and the Zod error should resolve.

**Step 3 — Report back**
If you still get the `[object Object]` error with the ad blocker disabled, the issue is genuinely in the WASM hash or the Soroban RPC endpoint. At that point I'll switch to a direct Horizon/Soroban RPC call instead of relying on passkey-kit's internal simulation.

Try with the ad blocker off first — that's almost certainly the root cause here.
