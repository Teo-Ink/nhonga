# Nhonga — mobile (Expo / React Native)

The iOS + Android app for the Nhonga marketplace, built with **Expo** (SDK 57)
and **expo-router**. It talks to the same NestJS API as the web storefront.

This package is intentionally **outside the pnpm workspace** (see the negation in
`pnpm-workspace.yaml`) — Expo manages its own dependencies with npm.

## What's in it

Three tabs, all wired to the live API:

- **Início** — product catalogue (`GET /catalog/products`), tap a card to open a
  product.
- **Assistente** — the AI customer-service bot (`POST /assistant/chat`), the same
  endpoint the web widget uses.
- **Conta** — phone-OTP sign in / create account (`/auth/otp/request` +
  `/auth/otp/verify`); the session token is stored in `expo-secure-store` and
  sent as a `Bearer` header.
- **Produto** — product detail (`GET /catalog/products/:slug`).

## Setup

```bash
cd apps/mobile
npm install
# If any native module version is off for the SDK, align it:
#   npx expo install expo-secure-store @expo/vector-icons
```

Point the app at your API. On a **physical device**, `localhost` is the phone
itself, so use your computer's LAN IP:

```bash
# Windows: run `ipconfig` and use the IPv4 address, e.g. 192.168.1.10
# .env  (Expo reads EXPO_PUBLIC_* automatically)
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
```

Make sure the API (`apps/api`, port 3000) is running and reachable from the
phone (same Wi-Fi; allow the port through the firewall).

## Run

```bash
npm start          # Expo dev server + QR code
# then scan the QR with Expo Go (iOS App Store / Google Play)
npm run android    # needs the Android SDK / emulator
npm run ios        # needs macOS + Xcode
npm run web        # runs in the browser
```

> iOS builds require macOS. On Windows/Linux use **Expo Go** on a real device,
> or the web target, to preview.

## Enabling the AI assistant

The assistant answers with a "not configured" notice until the API has an
`ANTHROPIC_API_KEY`. Set it in the API environment and restart the API — see
`../../docs/local-dev.md`. The key lives only on the server; the app never sees
it.
