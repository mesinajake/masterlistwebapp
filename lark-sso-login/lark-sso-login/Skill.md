---
name: lark-sso-login
description: Generate complete Lark SSO OAuth 2.0 login implementations. Use when the user wants to create Lark authentication, Lark login, Lark SSO, or integrate Lark OAuth into a web application. Supports Python (Flask/FastAPI), Node.js (Express), and Go (Gin) with PKCE, state parameter CSRF protection, token refresh, and user info fetching.
---

# Lark SSO Login Creator

Generate production-ready Lark OAuth 2.0 login implementations with complete frontend and backend code.

## Overview

Lark SSO login follows the standard OAuth 2.0 authorization code flow:

1. **Redirect to authorization** → User visits Lark's authorize endpoint
2. **Receive callback** → Lark redirects back with authorization code
3. **Exchange for tokens** → Backend exchanges code for `user_access_token`
4. **Fetch user info** → Use token to get user details
5. **Refresh tokens** → Handle token expiration with `refresh_token`

## Framework Selection

Ask the user which framework they prefer, then load the corresponding reference:

- **Python (Flask or FastAPI)** → See [references/python.md](references/python.md)
- **Node.js (Express)** → See [references/nodejs.md](references/nodejs.md)
- **Go (Gin)** → See [references/go.md](references/go.md)

## Security Requirements (All Frameworks)

Always implement these security measures:

1. **PKCE (Proof Key for Code Exchange)** - Generate `code_verifier` and `code_challenge` using S256 method
2. **State parameter** - Random string to prevent CSRF attacks, validate on callback
3. **Secure session storage** - Store `code_verifier` and `state` in server-side session
4. **HTTPS in production** - Never use HTTP for OAuth callbacks in production

## Lark API Endpoints

| Purpose | URL |
|---------|-----|
| Authorization | `https://accounts.larksuite.com/open-apis/authen/v1/authorize` |
| Token Exchange | `https://open.larksuite.com/open-apis/authen/v2/oauth/token` |
| User Info | `https://open.larksuite.com/open-apis/authen/v1/user_info` |

## Required Configuration

The user must provide or configure:

1. **App ID** (`client_id`) - From Lark Developer Console → Credentials & Basic Info
2. **App Secret** (`client_secret`) - From Lark Developer Console → Credentials & Basic Info  
3. **Redirect URI** - Must be registered in Developer Console → Security Settings → Redirect URLs
4. **Scopes** - Permissions to request (e.g., `contact:user.base:readonly`, `offline_access` for refresh tokens)

## Output Structure

Generate a complete working example with:

```
project/
├── .env.example          # Environment variables template
├── main.{py,js,go}       # Main application entry
├── templates/            # HTML templates (if applicable)
│   └── index.html        # Login page
└── README.md             # Setup instructions
```

## Key Implementation Notes

1. **Token storage**: Reserve 4KB for `access_token` and `refresh_token` (can grow with more scopes)
2. **Token expiration**: Use `expires_in` from response, don't hardcode (typically ~7200s for access, ~604800s for refresh)
3. **Authorization code**: Valid for 5 minutes, single use only
4. **Error handling**: Handle `access_denied` callback when user denies authorization
5. **offline_access scope**: Required to receive `refresh_token` - must be applied for in Developer Console first