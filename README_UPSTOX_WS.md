# Upstox Market Data WebSocket (Node.js)

This folder contains a minimal Node.js client to connect to the Upstox Market Data WebSocket, subscribe to instruments, and decode binary ticks with Protobuf.

Paths:
- Client: `server/upstox_ws.js`
- Package: `server/package.json`
- Example env: `server/.env.example`
- Place your `.proto` here: `server/schemas/`

## Prerequisites
- Node.js 18+
- Upstox access token (Bearer) with market data permissions
- Upstox V3 Protobuf schema file(s) (e.g., `upstox_marketdata.proto`)

## Setup
1) Copy env and fill values:
```bash
cp server/.env.example server/.env
# Edit server/.env to set:
# - UPSTOX_ACCESS_TOKEN
# - UPSTOX_INSTRUMENT_KEYS (comma-separated)
# - UPSTOX_MODE (ltp|full)
# - UPSTOX_PROTO_PATH (defaults to ./schemas/upstox_marketdata.proto)
```

2) Place the official Upstox V3 `.proto` under `server/schemas/` and update `UPSTOX_PROTO_PATH` if the name differs.

3) Install dependencies:
```bash
cd server
npm install
```

## Run
```bash
npm run start
```
This will:
- Call the Market Data Feed Authorize API
- Connect to the returned `wss://` endpoint
- Build and send a binary subscription request
- Attempt to decode incoming binary messages via the Protobuf schema

## Important: Protobuf message names
`server/upstox_ws.js` uses placeholder message names:
```js
const SubscriptionReq = root.lookupType('REPLACE.With.Actual.SubscriptionRequest');
const Envelope = root.lookupType('REPLACE.With.Actual.EnvelopeOrTickMessage');
```
Replace these with the actual type names and adjust the subscription payload fields so they match the Upstox `.proto` (for example: instrument key field name, mode enum, envelope/wrapper message, etc.).

## Notes
- If the authorize response uses a different field for the redirect/websocket URL, update the parser in `getAuthorizedWssUrl()` accordingly.
- Add reconnection and resubscription logic for production use.
- Never commit real secrets; use `server/.env` locally or a secure secret store.
