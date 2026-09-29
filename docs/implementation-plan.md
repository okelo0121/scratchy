# Passkey claim — known issues and diagnosis

## 1. `ERR_BLOCKED_BY_CLIENT` on Arc RPC endpoints

The browser's ad blocker blocks `rpc.testnet.arc.io`, `rpc.drpc.testnet.arc.io`,
`rpc.quicknode.testnet.arc.io`, `rpc.blockdaemon.testnet.arc.io`. Not an app bug —
disable the ad blocker on the app's domain and retry. Unrelated to the passkey error below.

## 2. `Received object [object Object] did not match the provided type [object Object]`

**Not a Zod error and not caused by the ad blocker.** It is thrown by
`Spec.nativeToScVal` in `@stellar/stellar-sdk/contract/spec.js`, before any RPC call.

### Root cause: two incompatible copies of `@stellar/stellar-sdk` in one bundle

- `passkey-kit@0.19.1` pins `@stellar/stellar-sdk ^16.3.0` (js-xdr 4, class-based XDR:
  `ty.switch()`, `new xdr.ScSpecTypeUdt(...)`).
- The project previously depended on `@stellar/stellar-sdk ^17.1.0` (js-xdr 5, plain-object
  XDR: `ty.type`, `ScVal.is()`). bun hoisted v17 and nested v16 under `passkey-kit`.
- `passkey-kit-sdk` (the generated contract bindings) has peer range `>=16.0.0` and is hoisted,
  so it resolved to **v17** while `passkey-kit` itself ran on **v16**.

Inside `kit.createWallet`, `createBindingProof` builds a type descriptor with the v16 `xdr`
classes and hands it to a v17 `Spec`. v17 reads `ty.type`, gets `undefined`, skips the UDT
branch, and falls through to the generic `Received object … did not match` throw. Both
`${val}` and `${ty}` are objects, hence `[object Object]` twice.

### Fix

Single SDK version. `package.json` now pins `@stellar/stellar-sdk ^16.3.0` in both
`dependencies` and `overrides`, so `passkey-kit`, `passkey-kit-sdk`, `sac-sdk` and app code all
share one hoisted copy. Do **not** bump the SDK to 17 until passkey-kit publishes a release that
targets it (0.19.1 is `latest` and explicitly targets stellar-sdk 16.3).

Project code only uses classic SDK APIs (`Keypair`, `TransactionBuilder`, `Operation.payment`,
`Asset`, `Memo`, `Horizon.Server`), which are unchanged between 16 and 17.

### Also fixed

`api/relayer.ts` now checks `result.success` from `PasskeyServer.send()` (which never throws)
and returns the relayer's real error with HTTP 502 instead of a silent `{ hash: "" }`. A missing
`OZ_RELAYER_API_KEY` will now show up as the actual relayer message.

## 3. Chrome warning: `pubKeyCredParams is missing … ES256 and RS256`

Emitted by Chrome for the WebAuthn registration inside passkey-kit. Harmless warning, not an error.
