# Python Implementation (Flask / FastAPI)

## Flask Implementation

### Dependencies

```bash
pip install flask flask-session python-dotenv requests
```

### Complete Example

```python
import os
import secrets
import hashlib
import base64
from urllib.parse import urlencode, quote
from flask import Flask, redirect, request, session, url_for
from flask_session import Session
import requests
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", secrets.token_hex(32))
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

# Lark OAuth Configuration
LARK_APP_ID = os.getenv("LARK_APP_ID")
LARK_APP_SECRET = os.getenv("LARK_APP_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI", "http://localhost:5000/callback")
SCOPES = os.getenv("LARK_SCOPES", "offline_access")  # Space-separated scopes

# Lark API Endpoints
AUTHORIZE_URL = "https://accounts.larksuite.com/open-apis/authen/v1/authorize"
TOKEN_URL = "https://open.larksuite.com/open-apis/authen/v2/oauth/token"
USER_INFO_URL = "https://open.larksuite.com/open-apis/authen/v1/user_info"


def generate_pkce():
    """Generate PKCE code_verifier and code_challenge (S256 method)."""
    code_verifier = secrets.token_urlsafe(64)[:128]  # 43-128 chars
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return code_verifier, code_challenge


@app.route("/")
def index():
    user = session.get("user")
    if user:
        return f"""
        <h2>Welcome, {user.get('name', 'User')}!</h2>
        <p>Email: {user.get('email', 'N/A')}</p>
        <a href="/logout">Logout</a>
        """
    return """
    <h2>Lark SSO Login Demo</h2>
    <a href="/login">Login with Lark</a>
    """


@app.route("/login")
def login():
    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state
    
    # Generate PKCE parameters
    code_verifier, code_challenge = generate_pkce()
    session["code_verifier"] = code_verifier
    
    # Build authorization URL
    params = {
        "client_id": LARK_APP_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPES,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    auth_url = f"{AUTHORIZE_URL}?{urlencode(params, quote_via=quote)}"
    return redirect(auth_url)


@app.route("/callback")
def callback():
    # Check for error (user denied authorization)
    error = request.args.get("error")
    if error:
        return f"Authorization denied: {error}", 403
    
    # Validate state parameter
    state = request.args.get("state")
    if state != session.get("oauth_state"):
        return "Invalid state parameter (CSRF detected)", 403
    
    # Get authorization code
    code = request.args.get("code")
    if not code:
        return "Missing authorization code", 400
    
    # Exchange code for tokens
    code_verifier = session.get("code_verifier")
    token_data = {
        "grant_type": "authorization_code",
        "client_id": LARK_APP_ID,
        "client_secret": LARK_APP_SECRET,
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "code_verifier": code_verifier,
    }
    
    resp = requests.post(
        TOKEN_URL,
        json=token_data,
        headers={"Content-Type": "application/json; charset=utf-8"}
    )
    tokens = resp.json()
    
    if tokens.get("code") != "0" and tokens.get("code") != 0:
        return f"Token exchange failed: {tokens.get('error_description', tokens)}", 400
    
    # Store tokens in session
    session["access_token"] = tokens["access_token"]
    session["refresh_token"] = tokens.get("refresh_token")
    session["token_expires_in"] = tokens["expires_in"]
    
    # Fetch user info
    user_resp = requests.get(
        USER_INFO_URL,
        headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    user_data = user_resp.json()
    
    if user_data.get("code") == 0:
        session["user"] = user_data.get("data", {})
    
    # Clean up OAuth state
    session.pop("oauth_state", None)
    session.pop("code_verifier", None)
    
    return redirect(url_for("index"))


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


@app.route("/refresh")
def refresh_token():
    """Refresh the access token using refresh_token."""
    refresh_token = session.get("refresh_token")
    if not refresh_token:
        return "No refresh token available", 400
    
    token_data = {
        "grant_type": "refresh_token",
        "client_id": LARK_APP_ID,
        "client_secret": LARK_APP_SECRET,
        "refresh_token": refresh_token,
    }
    
    resp = requests.post(
        TOKEN_URL,
        json=token_data,
        headers={"Content-Type": "application/json; charset=utf-8"}
    )
    tokens = resp.json()
    
    if tokens.get("code") != "0" and tokens.get("code") != 0:
        return f"Token refresh failed: {tokens.get('error_description', tokens)}", 400
    
    session["access_token"] = tokens["access_token"]
    session["refresh_token"] = tokens.get("refresh_token")  # New refresh token
    session["token_expires_in"] = tokens["expires_in"]
    
    return "Token refreshed successfully"


if __name__ == "__main__":
    app.run(debug=True, port=5000)
```

### Environment Variables (.env)

```
LARK_APP_ID=cli_xxxxx
LARK_APP_SECRET=xxxxx
REDIRECT_URI=http://localhost:5000/callback
LARK_SCOPES=offline_access
SECRET_KEY=your-secret-key-here
```

---

## FastAPI Implementation

### Dependencies

```bash
pip install fastapi uvicorn python-dotenv httpx itsdangerous
```

### Complete Example

```python
import os
import secrets
import hashlib
import base64
from urllib.parse import urlencode, quote
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse
from starlette.middleware.sessions import SessionMiddleware
import httpx
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SECRET_KEY", secrets.token_hex(32))
)

# Lark OAuth Configuration
LARK_APP_ID = os.getenv("LARK_APP_ID")
LARK_APP_SECRET = os.getenv("LARK_APP_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI", "http://localhost:8000/callback")
SCOPES = os.getenv("LARK_SCOPES", "offline_access")

# Lark API Endpoints
AUTHORIZE_URL = "https://accounts.larksuite.com/open-apis/authen/v1/authorize"
TOKEN_URL = "https://open.larksuite.com/open-apis/authen/v2/oauth/token"
USER_INFO_URL = "https://open.larksuite.com/open-apis/authen/v1/user_info"


def generate_pkce():
    """Generate PKCE code_verifier and code_challenge (S256 method)."""
    code_verifier = secrets.token_urlsafe(64)[:128]
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return code_verifier, code_challenge


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    user = request.session.get("user")
    if user:
        return f"""
        <h2>Welcome, {user.get('name', 'User')}!</h2>
        <p>Email: {user.get('email', 'N/A')}</p>
        <a href="/logout">Logout</a>
        """
    return """
    <h2>Lark SSO Login Demo</h2>
    <a href="/login">Login with Lark</a>
    """


@app.get("/login")
async def login(request: Request):
    state = secrets.token_urlsafe(32)
    request.session["oauth_state"] = state
    
    code_verifier, code_challenge = generate_pkce()
    request.session["code_verifier"] = code_verifier
    
    params = {
        "client_id": LARK_APP_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPES,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    auth_url = f"{AUTHORIZE_URL}?{urlencode(params, quote_via=quote)}"
    return RedirectResponse(url=auth_url)


@app.get("/callback")
async def callback(request: Request, code: str = None, state: str = None, error: str = None):
    if error:
        raise HTTPException(status_code=403, detail=f"Authorization denied: {error}")
    
    if state != request.session.get("oauth_state"):
        raise HTTPException(status_code=403, detail="Invalid state parameter")
    
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")
    
    code_verifier = request.session.get("code_verifier")
    
    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_resp = await client.post(
            TOKEN_URL,
            json={
                "grant_type": "authorization_code",
                "client_id": LARK_APP_ID,
                "client_secret": LARK_APP_SECRET,
                "code": code,
                "redirect_uri": REDIRECT_URI,
                "code_verifier": code_verifier,
            },
            headers={"Content-Type": "application/json; charset=utf-8"}
        )
        tokens = token_resp.json()
        
        if str(tokens.get("code")) != "0":
            raise HTTPException(status_code=400, detail=f"Token exchange failed: {tokens}")
        
        request.session["access_token"] = tokens["access_token"]
        request.session["refresh_token"] = tokens.get("refresh_token")
        
        # Fetch user info
        user_resp = await client.get(
            USER_INFO_URL,
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        user_data = user_resp.json()
        
        if user_data.get("code") == 0:
            request.session["user"] = user_data.get("data", {})
    
    # Clean up
    request.session.pop("oauth_state", None)
    request.session.pop("code_verifier", None)
    
    return RedirectResponse(url="/")


@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/")


@app.get("/refresh")
async def refresh_token(request: Request):
    refresh_token = request.session.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=400, detail="No refresh token available")
    
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            TOKEN_URL,
            json={
                "grant_type": "refresh_token",
                "client_id": LARK_APP_ID,
                "client_secret": LARK_APP_SECRET,
                "refresh_token": refresh_token,
            },
            headers={"Content-Type": "application/json; charset=utf-8"}
        )
        tokens = token_resp.json()
        
        if str(tokens.get("code")) != "0":
            raise HTTPException(status_code=400, detail=f"Token refresh failed: {tokens}")
        
        request.session["access_token"] = tokens["access_token"]
        request.session["refresh_token"] = tokens.get("refresh_token")
    
    return {"message": "Token refreshed successfully"}


# Run with: uvicorn main:app --reload --port 8000
```

## Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| 20002 | Invalid client_secret | Verify APP_SECRET is correct |
| 20003 | Authorization code not found | Code already used or invalid |
| 20004 | Authorization code expired | Code valid for 5 minutes only |
| 20010 | User lacks app permission | User needs access to the app |
| 20049 | PKCE verification failed | Ensure code_verifier matches |
| 20071 | redirect_uri mismatch | Must match exactly |