# n8n-nodes-baileys-antiban

n8n community nodes for [baileys-antiban](https://github.com/kobie3717/baileys-antiban) — WhatsApp bot anti-ban middleware with rate limiting, warmup, and session health monitoring.

## Installation

### Option 1: Via n8n Community Nodes UI

1. Go to **Settings** > **Community Nodes**
2. Click **Install**
3. Enter `n8n-nodes-baileys-antiban`
4. Click **Install**

### Option 2: Manual Installation

In your n8n custom nodes directory:

```bash
npm install n8n-nodes-baileys-antiban
```

Then restart n8n.

## Nodes

### Baileys Antiban (Action Node)

Send WhatsApp messages with built-in anti-ban protection:

- **Send Text** — Send text messages
- **Send Image** — Send images with optional captions
- **Send Document** — Send document files

All operations are automatically rate-limited with:
- Gaussian jitter delays (human-like timing)
- 7-day warmup schedule for new numbers
- Session health monitoring
- Retry tracking and reconnect throttling

### Baileys Antiban Trigger (Trigger Node)

Listen for incoming WhatsApp events:

- **Messages Upsert** — New incoming messages
- **Connection Update** — Connection status changes
- **Presence Update** — Online/offline/typing status
- **Message Receipt Update** — Read/delivery receipts

Filters:
- `filterFromMe` — Skip self-sent messages
- `messageTypes` — Filter by text/image/audio/video/document/sticker

## Example Workflow

```json
{
  "nodes": [
    {
      "name": "WhatsApp Trigger",
      "type": "n8n-nodes-baileys-antiban.baileysAntibanTrigger",
      "parameters": {
        "events": ["messages.upsert"],
        "filterFromMe": true,
        "messageTypes": ["text"]
      },
      "credentials": {
        "baileysAntibanApi": "WhatsApp Session"
      }
    },
    {
      "name": "Reply",
      "type": "n8n-nodes-baileys-antiban.baileysAntiban",
      "parameters": {
        "operation": "sendText",
        "to": "={{$json.from}}",
        "text": "Thanks for your message: {{$json.text}}"
      },
      "credentials": {
        "baileysAntibanApi": "WhatsApp Session"
      }
    }
  ]
}
```

## Credentials Setup

1. Create new **Baileys Antiban API** credentials
2. Set **Session Path** — directory for auth state (e.g., `./baileys-session`)
3. Optional: **Phone Number** for pairing code login
4. Optional: **Use Pairing Code** — toggle QR vs pairing code
5. **Print QR in Terminal** — fallback for first auth

On first connection, scan the QR code or use the pairing code to authenticate.

## Anti-Ban Benefits

This integration includes all baileys-antiban protections:

- **Rate Limiting** — Max 8 msg/min, 200/hr, 1500/day with Gaussian jitter
- **7-Day Warmup** — Gradual ramp from 20 msg/day to unlimited
- **Session Health** — Monitors disconnect rate, Bad MAC errors, risk score
- **LID/PN Resolver** — Prevents "Bad MAC" errors from JID mismatches
- **Signed npm** — Zero telemetry, SLSA provenance
- **Free & Self-Hosted** — No monthly fees like Whapi.Cloud ($49-$99/mo)

See [baileys-antiban README](https://github.com/kobie3717/baileys-antiban) for full details.

## Connection Sharing

n8n executes nodes in isolated contexts, but this package shares one persistent WhatsApp socket per credential to avoid multiple logins. The connection is cached by session path + phone number hash and reused across trigger and action nodes.

## License

MIT — Built for [WhatsAuction](https://whatsauction.co.za) 🇿🇦

## Links

- [baileys-antiban](https://github.com/kobie3717/baileys-antiban)
- [Baileys](https://github.com/WhiskeySockets/Baileys)
- [n8n](https://n8n.io)
