# Node.js Implementation (Express)

## Dependencies

```bash
npm init -y
npm install express express-session dotenv axios crypto
```

## Complete Example

```javascript
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const axios = require('axios');

const app = express();

// Session configuration
app.use(session({
  secret: process.env.SECRET_KEY || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Lark OAuth Configuration
const LARK_APP_ID = process.env.LARK_APP_ID;
const LARK_APP_SECRET = process.env.LARK_APP_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/callback';
const SCOPES = process.env.LARK_SCOPES || 'offline_access';

// Lark API Endpoints
const AUTHORIZE_URL = 'https://accounts.larksuite.com/open-apis/authen/v1/authorize';
const TOKEN_URL = 'https://open.larksuite.com/open-apis/authen/v2/oauth/token';
const USER_INFO_URL = 'https://open.larksuite.com/open-apis/authen/v1/user_info';

/**
 * Generate PKCE code_verifier and code_challenge (S256 method)
 */
function generatePKCE() {
  // Generate code_verifier (43-128 characters)
  const codeVerifier = crypto.randomBytes(64).toString('base64url').slice(0, 128);
  
  // Generate code_challenge using SHA256
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = hash.toString('base64url');
  
  return { codeVerifier, codeChallenge };
}

/**
 * Generate random state for CSRF protection
 */
function generateState() {
  return crypto.randomBytes(32).toString('base64url');
}

// Home page
app.get('/', (req, res) => {
  const user = req.session.user;
  
  if (user) {
    res.send(`
      <h2>Welcome, ${user.name || 'User'}!</h2>
      <p>Email: ${user.email || 'N/A'}</p>
      <p>User ID: ${user.user_id || 'N/A'}</p>
      <a href="/logout">Logout</a>
    `);
  } else {
    res.send(`
      <h2>Lark SSO Login Demo</h2>
      <a href="/login">Login with Lark</a>
    `);
  }
});

// Initiate login
app.get('/login', (req, res) => {
  // Generate state for CSRF protection
  const state = generateState();
  req.session.oauthState = state;
  
  // Generate PKCE parameters
  const { codeVerifier, codeChallenge } = generatePKCE();
  req.session.codeVerifier = codeVerifier;
  
  // Build authorization URL
  const params = new URLSearchParams({
    client_id: LARK_APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });
  
  const authUrl = `${AUTHORIZE_URL}?${params.toString()}`;
  res.redirect(authUrl);
});

// OAuth callback
app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  // Check for error (user denied authorization)
  if (error) {
    return res.status(403).send(`Authorization denied: ${error}`);
  }
  
  // Validate state parameter
  if (state !== req.session.oauthState) {
    return res.status(403).send('Invalid state parameter (CSRF detected)');
  }
  
  // Check for authorization code
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }
  
  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post(TOKEN_URL, {
      grant_type: 'authorization_code',
      client_id: LARK_APP_ID,
      client_secret: LARK_APP_SECRET,
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: req.session.codeVerifier
    }, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
    
    const tokens = tokenResponse.data;
    
    if (tokens.code !== '0' && tokens.code !== 0) {
      return res.status(400).send(`Token exchange failed: ${tokens.error_description || JSON.stringify(tokens)}`);
    }
    
    // Store tokens in session
    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token;
    req.session.tokenExpiresIn = tokens.expires_in;
    
    // Fetch user info
    const userResponse = await axios.get(USER_INFO_URL, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    
    const userData = userResponse.data;
    
    if (userData.code === 0) {
      req.session.user = userData.data;
    }
    
    // Clean up OAuth state
    delete req.session.oauthState;
    delete req.session.codeVerifier;
    
    res.redirect('/');
    
  } catch (err) {
    console.error('OAuth error:', err.response?.data || err.message);
    res.status(500).send('Authentication failed');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Refresh token endpoint
app.get('/refresh', async (req, res) => {
  const refreshToken = req.session.refreshToken;
  
  if (!refreshToken) {
    return res.status(400).json({ error: 'No refresh token available' });
  }
  
  try {
    const tokenResponse = await axios.post(TOKEN_URL, {
      grant_type: 'refresh_token',
      client_id: LARK_APP_ID,
      client_secret: LARK_APP_SECRET,
      refresh_token: refreshToken
    }, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
    
    const tokens = tokenResponse.data;
    
    if (tokens.code !== '0' && tokens.code !== 0) {
      return res.status(400).json({ 
        error: 'Token refresh failed', 
        details: tokens.error_description 
      });
    }
    
    // Update tokens in session
    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token; // New refresh token
    req.session.tokenExpiresIn = tokens.expires_in;
    
    res.json({ message: 'Token refreshed successfully' });
    
  } catch (err) {
    console.error('Refresh error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

## Environment Variables (.env)

```
LARK_APP_ID=cli_xxxxx
LARK_APP_SECRET=xxxxx
REDIRECT_URI=http://localhost:3000/callback
LARK_SCOPES=offline_access
SECRET_KEY=your-secret-key-here
PORT=3000
```

## TypeScript Version

For TypeScript, install additional dependencies:

```bash
npm install typescript @types/node @types/express @types/express-session ts-node
npx tsc --init
```

Then use the same code with type annotations added to function signatures.

## Production Considerations

1. **Use Redis for sessions** - Replace default memory store:
   ```bash
   npm install connect-redis redis
   ```

2. **Enable secure cookies** - Set `cookie.secure: true` in production

3. **Add rate limiting**:
   ```bash
   npm install express-rate-limit
   ```

4. **Use HTTPS** - Required for OAuth in production

## Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| 20002 | Invalid client_secret | Verify APP_SECRET is correct |
| 20003 | Authorization code not found | Code already used or invalid |
| 20004 | Authorization code expired | Code valid for 5 minutes only |
| 20010 | User lacks app permission | User needs access to the app |
| 20049 | PKCE verification failed | Ensure code_verifier matches |
| 20071 | redirect_uri mismatch | Must match exactly |