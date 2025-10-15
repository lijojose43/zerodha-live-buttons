/*
 Minimal Upstox Market Data WebSocket client (Node.js)

 Steps:
 1) Obtain a Bearer access token and set it in .env as UPSTOX_ACCESS_TOKEN
 2) Run the Market Data Feed Authorize API to get the authorized wss URL (code does this)
 3) Connect to the returned wss endpoint
 4) Send a binary subscription request per Upstox V3 protobuf schema
 5) Decode incoming binary ticks via the same schema

 IMPORTANT: Replace the placeholder protobuf message names and fields below with
 the actual ones from the official Upstox V3 .proto files.
*/

require('dotenv').config();
const axios = require('axios');
const WebSocket = require('ws');
const protobuf = require('protobufjs');

// --- Configuration via env vars ---
// Required: Bearer token (without the literal 'Bearer ' prefix; we'll add it)
const ACCESS_TOKEN = process.env.UPSTOX_ACCESS_TOKEN || '';
// Optional override for authorize URL (verify against official docs)
const AUTHORIZE_URL = process.env.UPSTOX_AUTHORIZE_URL || 'https://api.upstox.com/v3/market-data/authorize';
// Comma-separated instrument keys, e.g. "NSE_EQ|INE669E01016,NSE_INDEX|NIFTY_50"
const INSTRUMENT_KEYS = (process.env.UPSTOX_INSTRUMENT_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
// "ltp" or "full" (confirm actual enum/strings with proto)
const MODE = process.env.UPSTOX_MODE || 'ltp';
// Path to the Upstox .proto file (place it under server/schemas/)
const PROTO_PATH = process.env.UPSTOX_PROTO_PATH || __dirname + '/schemas/upstox_marketdata.proto';

if (!ACCESS_TOKEN) {
  console.error('Missing UPSTOX_ACCESS_TOKEN. Set it in server/.env');
  process.exit(1);
}
if (INSTRUMENT_KEYS.length === 0) {
  console.error('No instrument keys provided. Set UPSTOX_INSTRUMENT_KEYS in server/.env');
  process.exit(1);
}

async function getAuthorizedWssUrl() {
  const resp = await axios.get(AUTHORIZE_URL, {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    maxRedirects: 0,
    validateStatus: s => (s >= 200 && s < 400),
  });

  // Adjust these keys to actual response as per Upstox docs
  const wssUrl =
    resp.data?.data?.authorized_redirect_uri ||
    resp.data?.data?.websocket_url ||
    resp.data?.authorized_redirect_uri;

  if (!wssUrl || !wssUrl.startsWith('wss://')) {
    throw new Error('Authorized wss URL not found in authorize response. Inspect response shape and update parser.');
  }
  return wssUrl;
}

async function createProtobufTypes() {
  // Load the .proto schema
  const root = await protobuf.load(PROTO_PATH);

  // TODO: Replace with actual type names from Upstox proto
  // Example placeholders:
  // const SubscriptionReq = root.lookupType('upstox.marketdata.SubscriptionRequest');
  // const Envelope = root.lookupType('upstox.marketdata.FeedResponse');

  const SubscriptionReq = root.lookupType('REPLACE.With.Actual.SubscriptionRequest');
  const Envelope = root.lookupType('REPLACE.With.Actual.EnvelopeOrTickMessage');

  return { SubscriptionReq, Envelope };
}

function buildSubscriptionBytes(SubscriptionReq) {
  // TODO: Replace fields to match actual proto schema
  const payload = {
    instrument_keys: INSTRUMENT_KEYS,
    mode: MODE,
  };

  const err = SubscriptionReq.verify(payload);
  if (err) throw new Error(`Subscription payload verify failed: ${err}`);
  const message = SubscriptionReq.create(payload);
  return SubscriptionReq.encode(message).finish();
}

async function main() {
  console.log('[upstox-ws] Authorizing...');
  const wssUrl = await getAuthorizedWssUrl();
  console.log('[upstox-ws] Authorized wss URL:', wssUrl);

  console.log('[upstox-ws] Loading protobuf schema from', PROTO_PATH);
  const { SubscriptionReq, Envelope } = await createProtobufTypes();

  const ws = new WebSocket(wssUrl);

  ws.on('open', () => {
    console.log('[upstox-ws] WS connected');
    try {
      const bytes = buildSubscriptionBytes(SubscriptionReq);
      ws.send(bytes, { binary: true });
      console.log('[upstox-ws] Subscription sent for', INSTRUMENT_KEYS.join(','), 'mode=', MODE);
    } catch (e) {
      console.error('[upstox-ws] Failed to send subscription:', e);
    }
  });

  ws.on('message', (data, isBinary) => {
    const buf = isBinary ? data : Buffer.from(data);
    try {
      const decoded = Envelope.decode(buf);
      const obj = Envelope.toObject(decoded, { longs: String, enums: String });
      console.log('[tick]', JSON.stringify(obj));
    } catch (e) {
      console.error('[upstox-ws] Decode error:', e.message);
    }
  });

  ws.on('close', (code, reason) => {
    console.log('[upstox-ws] WS closed', code, reason?.toString?.() || '');
    // TODO: implement reconnection/backoff and resubscribe
  });

  ws.on('error', (err) => {
    console.error('[upstox-ws] WS error:', err.message);
  });
}

main().catch((e) => {
  console.error('[upstox-ws] Fatal:', e);
  process.exit(1);
});
