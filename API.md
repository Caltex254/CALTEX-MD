# API Documentation - CALTEX MD WhatsApp Bot

Complete REST API reference for the CALTEX MD platform.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Rate Limiting](#rate-limiting)
3. [Error Codes Reference](#error-codes-reference)
4. [Auth Endpoints](#auth-endpoints)
5. [Bot Control Endpoints](#bot-control-endpoints)
6. [Session Endpoints](#session-endpoints)
7. [Message Endpoints](#message-endpoints)
8. [Group Endpoints](#group-endpoints)
9. [Command Endpoints](#command-endpoints)
10. [Configuration Endpoints](#configuration-endpoints)
11. [Scheduler Endpoints](#scheduler-endpoints)
12. [User Endpoints](#user-endpoints)
13. [Plugin Endpoints](#plugin-endpoints)
14. [Stats Endpoints](#stats-endpoints)
15. [Backup Endpoints](#backup-endpoints)
16. [Health Check](#health-check)
17. [Bot Internal API (Port 3031)](#bot-internal-api-port-3031)

---

## Authentication

All dashboard API endpoints (port 3000) require JWT authentication unless otherwise noted.

### Obtaining a Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-password"
  }'
```

### Using the Token

Include the token in the `Authorization` header of all subsequent requests:

```
Authorization: Bearer <your-jwt-token>
```

### Token Details

- **Algorithm**: HS256
- **Expiration**: 24 hours
- **Library**: jose (v6.x)
- **Payload**: `{ username: string, role: string, iat: number, exp: number }`

---

## Rate Limiting

Rate limiting is recommended to be configured at the reverse proxy level (Nginx, Cloudflare). The API itself does not implement built-in rate limiting.

**Recommended limits**:
- General API: 60 requests/minute per IP
- Auth endpoints: 10 requests/minute per IP
- Bot control (start/stop/restart): 5 requests/minute per IP
- Message sending: 30 requests/minute per IP

---

## Error Codes Reference

### HTTP Status Codes

| Code | Meaning | Description |
|---|---|---|
| `200` | OK | Request succeeded |
| `201` | Created | Resource created successfully |
| `204` | No Content | Request succeeded, no body returned |
| `400` | Bad Request | Missing or invalid parameters |
| `401` | Unauthorized | Missing or invalid JWT token |
| `403` | Forbidden | Valid token but insufficient permissions |
| `404` | Not Found | Resource or endpoint not found |
| `409` | Conflict | Resource already exists |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server-side error |

### Error Response Format

```json
{
  "success": false,
  "error": "Description of the error"
}
```

### Common Error Codes

| Error | HTTP Code | Description |
|---|---|---|
| `Unauthorized - Invalid or missing token` | 401 | JWT token missing, expired, or invalid |
| `Invalid credentials` | 401 | Wrong username or password |
| `Username and password are required` | 400 | Missing login fields |
| `sessionId is required` | 400 | Missing session identifier |
| `Request body is required` | 400 | Missing request body on PUT/POST |
| `Not found` | 404 | Unknown endpoint path |
| `Internal server error` | 500 | Unexpected server error |

---

## Auth Endpoints

### Login

Authenticate and receive a JWT token.

```
POST /api/auth/login
```

**Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "username": "admin",
  "password": "your-password"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "username": "admin",
    "role": "admin"
  }
}
```

**Error Responses**:

| Status | Body |
|---|---|
| 400 | `{ "success": false, "error": "Username and password are required" }` |
| 401 | `{ "success": false, "error": "Invalid credentials" }` |
| 500 | `{ "success": false, "error": "Login failed" }` |

**Example**:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Verify Token

Verify that a JWT token is valid.

```
GET /api/auth/verify
```

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "username": "admin",
    "role": "admin",
    "iat": 1705312800,
    "exp": 1705399200
  }
}
```

**Error Responses**:

| Status | Body |
|---|---|
| 401 | `{ "success": false, "error": "Unauthorized - Invalid or missing token" }` |

**Example**:
```bash
curl http://localhost:3000/api/auth/verify \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Bot Control Endpoints

### Get Bot Status

```
GET /api/bot/status
```

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "status": "running",
    "uptime": 86400000,
    "connections": {
      "total": 1,
      "connected": 1,
      "sessions": ["caltex-md"]
    },
    "messages": {
      "processed": 1500,
      "commandsExecuted": 350
    }
  }
}
```

**Example**:
```bash
curl http://localhost:3000/api/bot/status \
  -H "Authorization: Bearer <token>"
```

### Get QR Code

```
GET /api/bot/qr
```

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "qr": "2@abc123...",
    "sessionId": "caltex-md",
    "timestamp": 1705312800000
  }
}
```

**Example**:
```bash
curl http://localhost:3000/api/bot/qr \
  -H "Authorization: Bearer <token>"
```

### Start Bot

```
POST /api/bot/start
```

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "sessionId": "caltex-md"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Bot starting..."
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/bot/start \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"caltex-md"}'
```

### Stop Bot

```
POST /api/bot/stop
```

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "sessionId": "caltex-md"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Bot stopped"
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/bot/stop \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"caltex-md"}'
```

### Restart Bot

```
POST /api/bot/restart
```

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Bot restarting..."
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/bot/restart \
  -H "Authorization: Bearer <token>"
```

---

## Session Endpoints

### List Sessions

```
GET /api/sessions
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "caltex-md",
        "info": {
          "sessionId": "caltex-md",
          "createdAt": 1705312800000,
          "lastActive": 1705399200000,
          "status": "active"
        },
        "connected": true,
        "reconnectAttempts": 0
      }
    ]
  }
}
```

**Example**:
```bash
curl http://localhost:3031/api/sessions
```

### Create Session

```
POST /api/sessions/create
```

**Request Body**:
```json
{
  "sessionId": "my-new-session"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "session": {
    "sessionId": "my-new-session",
    "createdAt": 1705312800000,
    "lastActive": 1705312800000,
    "status": "disconnected"
  }
}
```

**Error Responses**:

| Status | Body |
|---|---|
| 400 | `{ "error": "sessionId is required" }` |

**Example**:
```bash
curl -X POST http://localhost:3031/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"my-new-session"}'
```

### Delete Session

```
POST /api/sessions/delete
```

**Request Body**:
```json
{
  "sessionId": "my-session"
}
```

**Response** (200 OK):
```json
{
  "success": true
}
```

**Error Responses**:

| Status | Body |
|---|---|
| 400 | `{ "error": "sessionId is required" }` |

**Example**:
```bash
curl -X POST http://localhost:3031/api/sessions/delete \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"my-session"}'
```

### Export Session

Export session data for backup.

```
POST /api/sessions/export
```

**Request Body**:
```json
{
  "sessionId": "caltex-md"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "sessionId": "caltex-md",
    "creds": { "...": "..." },
    "keys": { "...": "..." }
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:3031/api/sessions/export \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"caltex-md"}' | jq . > session-backup.json
```

### Import Session

Import session data from a backup.

```
POST /api/sessions/import
```

**Request Body**:
```json
{
  "sessionId": "caltex-md",
  "data": {
    "creds": { "...": "..." },
    "keys": { "...": "..." }
  }
}
```

**Response** (200 OK):
```json
{
  "success": true
}
```

**Error Responses**:

| Status | Body |
|---|---|
| 400 | `{ "error": "sessionId and data are required" }` |

**Example**:
```bash
curl -X POST http://localhost:3031/api/sessions/import \
  -H "Content-Type: application/json" \
  -d @session-backup.json
```

---

## Message Endpoints

### Send Message

```
POST /api/send
```

**Request Body**:
```json
{
  "sessionId": "caltex-md",
  "jid": "6281234567890@s.whatsapp.net",
  "content": "Hello from the API!"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "result": {
    "key": {
      "remoteJid": "6281234567890@s.whatsapp.net",
      "fromMe": true,
      "id": "3EB0XXXXXX"
    },
    "message": { "conversation": "Hello from the API!" },
    "status": 1
  }
}
```

**Error Responses**:

| Status | Body |
|---|---|
| 400 | `{ "error": "sessionId, jid, and content are required" }` |
| 500 | `{ "error": "Failed to send message" }` |

**Example**:
```bash
# Send to individual chat
curl -X POST http://localhost:3031/api/send \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "caltex-md",
    "jid": "6281234567890@s.whatsapp.net",
    "content": "Hello from API!"
  }'

# Send to group
curl -X POST http://localhost:3031/api/send \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "caltex-md",
    "jid": "6281234567890-1234567890@g.us",
    "content": "Hello group!"
  }'
```

### Broadcast Message

```
POST /api/broadcast
```

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "message": "Important announcement!",
  "targetType": "all"
}
```

**targetType options**:
- `"all"` - Send to all chats
- `"groups"` - Send to group chats only
- `"users"` - Send to individual chats only

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "clx123456",
    "message": "Important announcement!",
    "targetType": "all",
    "status": "sent",
    "sentAt": "2025-01-15T10:30:00Z"
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/broadcast \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message":"Maintenance at 10pm","targetType":"all"}'
```

---

## Group Endpoints

### List Groups

```
GET /api/groups
```

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "jid": "6281234567890-1234567890@g.us",
      "name": "My Group",
      "memberCount": 50,
      "adminCount": 3,
      "isBotAdmin": true,
      "antiFeatures": {
        "antiLink": true,
        "antiBadword": false,
        "antiSpam": true
      }
    }
  ]
}
```

**Example**:
```bash
curl http://localhost:3000/api/groups \
  -H "Authorization: Bearer <token>"
```

### Get Group Details

```
GET /api/groups/:jid
```

**Headers**:
```
Authorization: Bearer <token>
```

**URL Parameters**:
- `jid` - Group JID (URL-encoded)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "jid": "6281234567890-1234567890@g.us",
    "name": "My Group",
    "description": "Group description here",
    "memberCount": 50,
    "adminCount": 3,
    "isBotAdmin": true,
    "owner": "6281234567890@s.whatsapp.net",
    "antiFeatures": {
      "antiLink": true,
      "antiBadword": false,
      "antiSpam": true,
      "antiDelete": true,
      "antiViewOnce": false,
      "antiCall": false
    },
    "createdAt": "2024-06-01T00:00:00Z"
  }
}
```

**Example**:
```bash
curl "http://localhost:3000/api/groups/6281234567890-1234567890@g.us" \
  -H "Authorization: Bearer <token>"
```

---

## Command Endpoints

### List Commands

```
GET /api/commands
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "clx123",
      "name": "ping",
      "description": "Check if the bot is alive",
      "category": "general",
      "isEnabled": true,
      "usageCount": 150,
      "cooldown": 0,
      "isPremiumOnly": false
    },
    {
      "id": "clx124",
      "name": "ai",
      "description": "Chat with AI",
      "category": "ai",
      "isEnabled": true,
      "usageCount": 500,
      "cooldown": 5,
      "isPremiumOnly": false
    }
  ]
}
```

**Example**:
```bash
curl http://localhost:3000/api/commands \
  -H "Authorization: Bearer <token>"
```

### Get Command Details

```
GET /api/commands/:id
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "clx123",
    "name": "ping",
    "description": "Check if the bot is alive",
    "category": "general",
    "isEnabled": true,
    "usageCount": 150,
    "cooldown": 0,
    "isPremiumOnly": false,
    "createdAt": "2025-01-15T00:00:00Z",
    "updatedAt": "2025-01-15T12:00:00Z"
  }
}
```

### Update Command

```
PUT /api/commands/:id
```

**Request Body**:
```json
{
  "isEnabled": false,
  "cooldown": 10
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "clx123",
    "name": "ping",
    "isEnabled": false,
    "cooldown": 10
  }
}
```

**Example**:
```bash
curl -X PUT http://localhost:3000/api/commands/clx123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"isEnabled":false,"cooldown":10}'
```

---

## Configuration Endpoints

### Get Bot Configuration

```
GET /api/config/bot
```

**Response** (200 OK):
```json
{
  "config": {
    "prefix": "!",
    "ownerJids": ["6281234567890@s.whatsapp.net"],
    "autoReply": {
      "enabled": false,
      "replies": []
    },
    "welcome": {
      "enabled": true,
      "message": "Welcome to the group, @user! 🎉"
    },
    "goodbye": {
      "enabled": true,
      "message": "Goodbye @user! 👋"
    },
    "autoReact": {
      "enabled": false,
      "emojis": ["👍", "❤️", "😂", "😮", "😢", "🙏"]
    },
    "autoRead": false,
    "autoTyping": false,
    "autoRecording": false,
    "autoStatusView": false,
    "blockedJids": []
  }
}
```

**Example**:
```bash
curl http://localhost:3031/api/config/bot
```

### Update Bot Configuration

```
PUT /api/config/bot
```

**Request Body**:
```json
{
  "prefix": "#",
  "autoRead": true,
  "autoTyping": true,
  "welcome": {
    "enabled": true,
    "message": "Welcome @user! 🎊"
  }
}
```

**Response** (200 OK):
```json
{
  "success": true
}
```

**Error Responses**:

| Status | Body |
|---|---|
| 400 | `{ "error": "Request body is required" }` |

**Example**:
```bash
curl -X PUT http://localhost:3031/api/config/bot \
  -H "Content-Type: application/json" \
  -d '{"autoRead":true,"autoTyping":true}'
```

### Get Anti-Feature Configuration

```
GET /api/config/anti
```

**Response** (200 OK):
```json
{
  "config": {
    "antiLink": {
      "enabled": true,
      "allowedDomains": ["whatsapp.com", "google.com"],
      "warnFirst": true,
      "action": "delete"
    },
    "antiBadword": {
      "enabled": true,
      "words": ["badword1", "badword2"],
      "action": "delete"
    },
    "antiSpam": {
      "enabled": true,
      "maxMessages": 5,
      "intervalMs": 5000,
      "action": "delete",
      "muteDurationMs": 300000
    },
    "antiDelete": {
      "enabled": true,
      "forwardTo": null
    },
    "antiViewOnce": {
      "enabled": true,
      "forwardTo": null
    },
    "antiTag": {
      "enabled": false,
      "maxMentions": 5,
      "action": "warn"
    },
    "antiCall": {
      "enabled": true,
      "rejectCall": true,
      "sendMessage": true,
      "message": "Calls are not allowed. Please send a text message instead."
    }
  }
}
```

**Example**:
```bash
curl http://localhost:3031/api/config/anti
```

### Update Anti-Feature Configuration

```
PUT /api/config/anti
```

**Request Body**:
```json
{
  "antiLink": {
    "enabled": true,
    "action": "kick"
  },
  "antiSpam": {
    "enabled": true,
    "maxMessages": 10,
    "intervalMs": 10000
  }
}
```

**Response** (200 OK):
```json
{
  "success": true
}
```

**Example**:
```bash
curl -X PUT http://localhost:3031/api/config/anti \
  -H "Content-Type: application/json" \
  -d '{"antiLink":{"enabled":true,"action":"kick"}}'
```

### Get AI Configuration

```
GET /api/config/ai
```

**Response** (200 OK):
```json
{
  "config": {
    "defaultProvider": "openai",
    "openai": {
      "apiKey": "sk-proj...",
      "model": "gpt-4",
      "baseUrl": "https://api.openai.com/v1",
      "maxTokens": 2048,
      "temperature": 0.7
    },
    "gemini": {
      "apiKey": "AIzaS...",
      "model": "gemini-pro",
      "baseUrl": "https://generativelanguage.googleapis.com/v1",
      "maxTokens": 2048,
      "temperature": 0.7
    },
    "claude": {
      "apiKey": "",
      "model": "claude-3-sonnet-20240229",
      "baseUrl": "https://api.anthropic.com/v1",
      "maxTokens": 2048,
      "temperature": 0.7
    },
    "ollama": {
      "apiKey": "",
      "model": "llama3",
      "baseUrl": "http://localhost:11434",
      "maxTokens": 2048,
      "temperature": 0.7
    },
    "custom": {
      "apiKey": "",
      "model": "",
      "baseUrl": "",
      "maxTokens": 2048,
      "temperature": 0.7
    },
    "systemPrompt": "You are CALTEX MD Bot...",
    "maxConversationLength": 20,
    "conversationTTL": 3600000
  }
}
```

> **Note**: API keys are masked (only first 8 characters shown) in GET responses for security.

**Example**:
```bash
curl http://localhost:3031/api/config/ai
```

### Update AI Configuration

```
PUT /api/config/ai
```

**Request Body**:
```json
{
  "defaultProvider": "openai",
  "openai": {
    "apiKey": "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx",
    "model": "gpt-4",
    "maxTokens": 4096,
    "temperature": 0.8
  },
  "systemPrompt": "You are a helpful WhatsApp assistant."
}
```

**Response** (200 OK):
```json
{
  "success": true
}
```

**Example**:
```bash
curl -X PUT http://localhost:3031/api/config/ai \
  -H "Content-Type: application/json" \
  -d '{
    "defaultProvider": "openai",
    "openai": {
      "apiKey": "sk-proj-xxxxxxxx",
      "model": "gpt-4",
      "maxTokens": 4096
    }
  }'
```

---

## Scheduler Endpoints

### List Scheduled Messages

```
GET /api/scheduler/messages?sessionId=caltex-md
```

**Query Parameters**:
- `sessionId` (optional) - Filter by session

**Response** (200 OK):
```json
{
  "messages": [
    {
      "id": "msg-001",
      "sessionId": "caltex-md",
      "jid": "6281234567890@s.whatsapp.net",
      "content": "Good morning!",
      "sendAt": 1705353600000,
      "recurring": {
        "intervalMs": 86400000,
        "maxOccurrences": 30,
        "occurrences": 5
      },
      "status": "pending",
      "type": "recurring",
      "createdAt": 1705312800000
    }
  ]
}
```

**Example**:
```bash
curl http://localhost:3031/api/scheduler/messages
```

### Schedule a Message

```
POST /api/scheduler/schedule
```

**Request Body**:
```json
{
  "sessionId": "caltex-md",
  "jid": "6281234567890@s.whatsapp.net",
  "content": "Good morning!",
  "sendAt": 1705353600000,
  "recurring": {
    "intervalMs": 86400000,
    "maxOccurrences": 30
  },
  "type": "recurring"
}
```

**Fields**:
- `sessionId` (required) - Session identifier
- `jid` (required) - Target chat JID
- `content` (required) - Message content
- `sendAt` (required) - Unix timestamp (milliseconds) when to send
- `recurring` (optional) - Recurring configuration
  - `intervalMs` - Interval between messages in milliseconds
  - `maxOccurrences` - Maximum number of times to send
- `type` (optional) - `"single"` | `"broadcast"` | `"recurring"` (default: `"single"`)
- `broadcastJids` (optional) - Array of JIDs for broadcast type

**Response** (200 OK):
```json
{
  "success": true,
  "message": {
    "id": "msg-002",
    "sessionId": "caltex-md",
    "jid": "6281234567890@s.whatsapp.net",
    "content": "Good morning!",
    "sendAt": 1705353600000,
    "status": "pending",
    "type": "recurring",
    "createdAt": 1705312800000
  }
}
```

**Error Responses**:

| Status | Body |
|---|---|
| 400 | `{ "error": "sessionId, jid, content, and sendAt are required" }` |

**Example**:
```bash
# Schedule a one-time message
curl -X POST http://localhost:3031/api/scheduler/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "caltex-md",
    "jid": "6281234567890@s.whatsapp.net",
    "content": "Reminder: Meeting at 3pm",
    "sendAt": 1705353600000,
    "type": "single"
  }'

# Schedule a daily recurring message
curl -X POST http://localhost:3031/api/scheduler/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "caltex-md",
    "jid": "6281234567890-1234567890@g.us",
    "content": "Good morning everyone!",
    "sendAt": 1705353600000,
    "type": "recurring",
    "recurring": {"intervalMs": 86400000, "maxOccurrences": 30}
  }'
```

### Cancel Scheduled Message

```
POST /api/scheduler/cancel
```

**Request Body**:
```json
{
  "messageId": "msg-002"
}
```

**Response** (200 OK):
```json
{
  "success": true
}
```

**Error Responses**:

| Status | Body |
|---|---|
| 400 | `{ "error": "messageId is required" }` |

**Example**:
```bash
curl -X POST http://localhost:3031/api/scheduler/cancel \
  -H "Content-Type: application/json" \
  -d '{"messageId":"msg-002"}'
```

---

## User Endpoints

### List Users

```
GET /api/users
```

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "jid": "6281234567890@s.whatsapp.net",
      "name": "John Doe",
      "isPremium": false,
      "isBanned": false,
      "commandCount": 45,
      "lastSeen": 1705399200000
    }
  ]
}
```

**Example**:
```bash
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer <token>"
```

### Get User Details

```
GET /api/users/:jid
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "jid": "6281234567890@s.whatsapp.net",
    "name": "John Doe",
    "isPremium": true,
    "premiumExpiry": "2025-12-31T00:00:00Z",
    "isBanned": false,
    "warnings": 0,
    "commandCount": 45,
    "lastSeen": 1705399200000,
    "createdAt": "2024-06-01T00:00:00Z"
  }
}
```

**Example**:
```bash
curl "http://localhost:3000/api/users/6281234567890@s.whatsapp.net" \
  -H "Authorization: Bearer <token>"
```

---

## Plugin Endpoints

### List Plugins

```
GET /api/plugins
```

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "clx001",
      "name": "ai",
      "version": "1.0.0",
      "description": "AI-powered commands",
      "author": "CALTEX MD",
      "isEnabled": true,
      "installedAt": "2025-01-15T00:00:00Z"
    },
    {
      "id": "clx002",
      "name": "fun",
      "version": "1.0.0",
      "description": "Fun and entertainment commands",
      "author": "CALTEX MD",
      "isEnabled": true,
      "installedAt": "2025-01-15T00:00:00Z"
    }
  ]
}
```

**Example**:
```bash
curl http://localhost:3000/api/plugins \
  -H "Authorization: Bearer <token>"
```

### Get Plugin Details

```
GET /api/plugins/:id
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "clx001",
    "name": "ai",
    "version": "1.0.0",
    "description": "AI-powered commands: chat, image generation, code, translation, and more",
    "author": "CALTEX MD",
    "isEnabled": true,
    "filePath": "src/lib/commands/ai.ts",
    "config": "{}",
    "installedAt": "2025-01-15T00:00:00Z",
    "updatedAt": "2025-01-15T12:00:00Z"
  }
}
```

### Update Plugin

```
PUT /api/plugins/:id
```

**Request Body**:
```json
{
  "isEnabled": false,
  "config": "{\"customSetting\": true}"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "clx001",
    "name": "ai",
    "isEnabled": false
  }
}
```

**Example**:
```bash
curl -X PUT http://localhost:3000/api/plugins/clx001 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"isEnabled":false}'
```

---

## Stats Endpoints

### Get Statistics

```
GET /api/stats
```

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalMessages": 15000,
    "totalCommands": 3500,
    "totalGroups": 25,
    "totalUsers": 500,
    "activeConnections": 1,
    "uptime": 86400000,
    "antiFeatureActions": 200,
    "aiRequests": 800,
    "scheduledMessages": 15
  }
}
```

**Example**:
```bash
curl http://localhost:3000/api/stats \
  -H "Authorization: Bearer <token>"
```

---

## Backup Endpoints

### Create Backup

```
POST /api/backup
```

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "backups": 1
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/backup \
  -H "Authorization: Bearer <token>"
```

---

## Health Check

### Dashboard Health

```
GET /api/health
```

**Response** (200 OK):
```json
{
  "status": "ok",
  "service": "caltex-dashboard",
  "version": "1.0.0",
  "timestamp": 1705399200000
}
```

**Example**:
```bash
curl http://localhost:3000/api/health
```

### Bot Service Health

```
GET /health
```

**Response** (200 OK):
```json
{
  "status": "ok",
  "service": "caltex-bot",
  "version": "1.0.0",
  "uptime": 86400000,
  "uptimeFormatted": "1d 0h 0m",
  "connections": {
    "total": 1,
    "connected": 1,
    "sessions": ["caltex-md"]
  },
  "messages": {
    "processed": 1500,
    "commandsExecuted": 350
  },
  "scheduler": {
    "pending": 5,
    "sent": 100,
    "failed": 2
  },
  "antiFeatures": {
    "deletedMessages": 50,
    "viewOnceMessages": 10
  },
  "ai": {
    "activeConversations": 3
  },
  "timestamp": 1705399200000
}
```

**Example**:
```bash
curl http://localhost:3031/health
```

---

## Bot Internal API (Port 3031)

The bot service exposes an internal HTTP API on port 3031. These endpoints do not require JWT authentication (they are intended for internal service-to-service communication behind a firewall).

### Endpoints Summary

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check with detailed metrics |
| `GET` | `/api/status` | Session status overview |
| `GET` | `/api/qr` | QR code status |
| `POST` | `/api/connect` | Connect a WhatsApp session |
| `POST` | `/api/disconnect` | Disconnect a session |
| `GET` | `/api/sessions` | List all sessions |
| `POST` | `/api/sessions/create` | Create a new session |
| `POST` | `/api/sessions/delete` | Delete a session |
| `POST` | `/api/sessions/export` | Export session data |
| `POST` | `/api/sessions/import` | Import session data |
| `POST` | `/api/backup` | Backup all sessions |
| `GET` | `/api/commands` | List registered commands |
| `GET` | `/api/config/bot` | Get bot configuration |
| `PUT` | `/api/config/bot` | Update bot configuration |
| `GET` | `/api/config/anti` | Get anti-feature configuration |
| `PUT` | `/api/config/anti` | Update anti-feature configuration |
| `GET` | `/api/config/ai` | Get AI configuration (masked keys) |
| `PUT` | `/api/config/ai` | Update AI configuration |
| `POST` | `/api/send` | Send a message |
| `GET` | `/api/scheduler/messages` | List scheduled messages |
| `POST` | `/api/scheduler/schedule` | Schedule a message |
| `POST` | `/api/scheduler/cancel` | Cancel a scheduled message |

### Connect Session

```
POST /api/connect
```

**Request Body**:
```json
{
  "sessionId": "caltex-md"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Connecting session: caltex-md"
}
```

**Example**:
```bash
curl -X POST http://localhost:3031/api/connect \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"caltex-md"}'
```

### Disconnect Session

```
POST /api/disconnect
```

**Request Body**:
```json
{
  "sessionId": "caltex-md"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Disconnected session: caltex-md"
}
```

**Example**:
```bash
curl -X POST http://localhost:3031/api/disconnect \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"caltex-md"}'
```

### Get Status

```
GET /api/status
```

**Response** (200 OK):
```json
{
  "sessions": [
    {
      "sessionId": "caltex-md",
      "createdAt": 1705312800000,
      "lastActive": 1705399200000,
      "status": "active"
    }
  ],
  "timestamp": 1705399200000
}
```

**Example**:
```bash
curl http://localhost:3031/api/status
```

---

## CORS Configuration

The bot internal API (port 3031) includes CORS headers on all responses:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

OPTIONS requests return `204 No Content`.

---

## WebSocket API

The WebSocket service runs on port 3003 and provides real-time updates.

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3003');

ws.onopen = () => {
  console.log('Connected to CALTEX MD WebSocket');

  // Subscribe to events
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['bot.status', 'messages', 'logs', 'stats']
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type, data);
};
```

### Event Types

| Type | Description |
|---|---|
| `bot.status` | Bot connection status changes |
| `qr.code` | New QR code generated |
| `message.received` | New message received |
| `message.sent` | Message sent by bot |
| `command.executed` | Command executed |
| `log.entry` | New log entry |
| `stats.update` | Statistics updated |
| `connection.update` | Connection state changed |
| `group.update` | Group settings changed |
| `scheduler.update` | Scheduled message status changed |
