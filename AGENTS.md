# Scratch & Split — USDC Gift Cards on Arc

## Deployed Contracts

| Contract | Chain | Address |
|----------|-------|---------|
| ScratchAndSplit v2 | Arc Testnet (5042002) | 0x0b612a742aab5ed55b84c181af4258204e0d6dfc |
| ScratchAndSplit v1 (legacy) | Arc Testnet (5042002) | 0x5cc65165570799bdde45f0307fd8be8186e2f6ba |
| TutorQuestSubscription (legacy) | Arc Testnet (5042002) | 0xdb0e1558161f89599530c0874359fea9b9c1f75a |

- ScratchAndSplit explorer: https://explorer.testnet.arc.io/address/0x0b612a742aab5ed55b84c181af4258204e0d6dfc
- USDC: 0x3600000000000000000000000000000000000000 (6-decimal ERC-20 / 18-decimal native, same asset on Arc)
- Commit-reveal: commitment = keccak256(abi.encodePacked(secretKey)) — bearer, no recipient
  binding. Anyone holding the link can claim to any address.
- Expired, unclaimed gifts are refundable to the sender via `refundGift(commitment)`.

## What This App Does

Scratch & Split is a gamified USDC gift card platform on Arc.
Senders create a gift with a USDC amount, optional photo, and personal message.
The USDC is locked onchain. A magic link is generated with the secretKey in the URL fragment (never on-chain).
Recipients open the link, scratch off the metallic foil to reveal the surprise, then claim the USDC to their wallet.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, Privy embedded wallets (@privy-io/react-auth + @privy-io/wagmi)
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`. Build: `forge build`. Deploy via Arc Studio deploy_contract tool.
- Chain: Arc Testnet (5042002) + Arc Mainnet (5042) wired in config.ts
- Token: USDC — native gas on Arc; use 18-decimal native value for msg.value, 6-decimal ERC-20 for display
- Fonts: Fredoka One (display) + Nunito (body) via bunny.net CDN in index.html
- Design: sky gradient background, animated clouds/stars/hills in Layout.tsx, festive owl mascot (MascotSVG with festive prop)

## Key Files

- `src/App.tsx` — hash-based routing: landing / create / gift
- `src/lib/giftCrypto.ts` — secretKey gen, commitment = keccak256(secretKey, recipient), URL builder
- `src/lib/imageStore.ts` — photo base64 encode + URL fragment encoding
- `src/hooks/useGiftContract.ts` — useCreateGift + useClaimGift via Privy provider
- `src/hooks/useGiftBalance.ts` — reads gift state from contract by commitment
- `src/components/GiftCreator.tsx` — 3-step gift creation wizard
- `src/components/ScratchCard.tsx` — HTML5 Canvas scratch-off mechanic
- `src/components/ClaimCard.tsx` — Privy or external wallet claim flow
- `src/components/HowItWorks.tsx` — 4-step feature cards section
- `src/components/FooterCard.tsx` — big festive footer card with brand + links + chain stats
- `src/components/Layout.tsx` — sky scene, navbar, FooterCard

## Environment Variables

- VITE_PRIVY_APP_ID — Privy app ID
- VITE_ALCHEMY_API_KEY — Alchemy key (arc-testnet + arc-mainnet endpoints)
- VITE_SCRATCH_CONTRACT — deployed ScratchAndSplit address (defaults to v2, 0x0b61...)

## To Run

```bash
bun install
bun run dev
```
