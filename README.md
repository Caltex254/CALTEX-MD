<div align="center">

<img src="https://raw.githubusercontent.com/Caltex254/CALTEX-MD/main/public/caltex-profile.png" width="150" height="150" alt="CALTEX MD" style="border-radius: 50%; border: 3px solid #00e6c8;" />

# ☠️ CALTEX MD

**Powerful WhatsApp Multi-Device Bot** — AI integration, plugin system, and web dashboard.

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/Caltex254/CALTEX-MD)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg)](./Dockerfile)
[![Commands](https://img.shields.io/badge/commands-125+-purple.svg)](#commands)

</div>

---

## 📌 How to Connect CALTEX MD Bot

### Step 1: Get Session ID

Click the button below to generate your WhatsApp session (Pairing Code or QR Code):

<div align="center">

[![GET SESSION](https://img.shields.io/badge/🔑_GET_SESSION-Click_Here-red?style=for-the-badge&logo=whatsapp&logoColor=white)](https://caltex-md.vercel.app/scan)

</div>

> Opens the CALTEX MD Scanner — choose **Pairing Code** (enter phone number) or **QR Code** (scan with WhatsApp)

### Step 2: Download Your Session

After connecting, click **Copy Session** or **Download JSON** to save your session credentials.

### Step 3: Deploy the Bot

Deploy the bot on your preferred platform and set the `SESSION_DATA` env var to your downloaded session:

<div align="center">

[![Render](https://img.shields.io/badge/🚀_RENDER-Deploy-46E3B7?style=for-the-badge)](https://render.com/deploy?repo=https://github.com/Caltex254/CALTEX-MD)
[![Railway](https://img.shields.io/badge/🚀_RAILWAY-Deploy-8B5CF6?style=for-the-badge)](https://railway.app/template/caltex-md)
[![Heroku](https://img.shields.io/badge/🚀_HEROKU-Deploy-EC4899?style=for-the-badge)](https://heroku.com/deploy?template=https://github.com/Caltex254/CALTEX-MD)
[![Docker](https://img.shields.io/badge/🚀_DOCKER-Deploy-2496ED?style=for-the-badge&logo=docker&logoColor=white)](#docker-quick-start)

</div>

```env
# Required — paste your session data here
SESSION_DATA=<paste your downloaded session JSON>

# Other settings
DATABASE_URL=file:./data/caltex.db
JWT_SECRET=your-jwt-secret
```

---

## 🚀 Quick Start

### Install & Run

```bash
git clone https://github.com/Caltex254/CALTEX-MD.git
cd caltex-md
npm install
cp .env.example .env        # Edit with your config
npx prisma db push
npx prisma generate
npm run build
npm start
```

### Docker Quick Start

```bash
docker compose up -d
```

---

## 🔗 Link WhatsApp

### Method 1: Pairing Code (Recommended)

1. Go to the [**Scanner Page**](https://caltex-md.vercel.app/scan)
2. Enter your phone number **with country code, no +** (e.g., `254712345678` for Kenya, `917123456789` for India)
3. Click **Get Code** — you'll receive an 8-digit pairing code
4. On your phone: **WhatsApp** → **Settings** → **Linked Devices** → **Link with Phone Number**
5. Enter the pairing code — your WhatsApp will link automatically

### Method 2: QR Code

1. Go to the [**Scanner Page**](https://caltex-md.vercel.app/scan)
2. Click **QR Code**
3. Scan the QR code with WhatsApp: **Settings** → **Linked Devices** → **Link a Device**

After linking, the scanner shows **Session Connected!** — download or copy your session data, then paste it in your bot's `SESSION_DATA` env var.

---

## 📋 Commands

Prefix: **`.`** (dot) — configurable via `.changeprefix`. **125+ commands** across 15 categories:

| Category | Key Commands |
|---|---|
| **General** | `.ping` `.help` `.menu` `.runtime` `.system` `.health` `.owner` `.repo` |
| **AI** | `.ai` `.aiimage` `.aicode` `.aitranslate` `.aisummarize` `.airewrite` |
| **Bug ☠️** | `.bug1`–`.bug20` (owner-only: crash loop, vcard, sticker, audio, reaction bomb, mention bomb, force stop...) |
| **Download** | `.yta` `.ytv` `.ig` `.tiktok` `.fb` `.twitter` |
| **Group** | `.groupinfo` `.promote` `.demote` `.mute` `.tagall` `.hidetag` `.welcome` |
| **Moderation** | `.antilink` `.antibadword` `.antispam` `.antidelete` `.anticall` `.warn` `.purge` |
| **Premium** | `.premium` `.addpremium` `.delpremium` `.premiumlist` |
| **Plugins** | `.plugins` `.installplugin` `.enableplugin` `.disableplugin` `.reloadplugin` |
| **Owner** | `.setprefix` `.broadcast` `.ban` `.restart` `.maintenance` `.update` `.rollback` |
| **Other** | `.sticker` `.afk` `.remind` `.note` `.schedule` `.language` `.theme` `.apikeys` |

---

## 📄 License

MIT — see [LICENSE](./LICENSE).

---

<div align="center">

**Built with ☠️ by Caltex Wayne — TECH WIZARD**

</div>
