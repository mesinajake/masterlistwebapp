import crypto from "crypto";

// ─── Lark API Endpoints (International / Larksuite) ───

const LARK_AUTH_URL =
  "https://accounts.larksuite.com/open-apis/authen/v1/authorize";
const LARK_TOKEN_URL =
  "https://open.larksuite.com/open-apis/authen/v2/oauth/token";

// ─── Helpers ──────────────────────────────────────────

function getLarkConfig() {
  const appId = process.env.LARK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;
  const redirectUri = process.env.LARK_REDIRECT_URI;

  if (!appId || !appSecret || !redirectUri) {
    throw new Error(
      "Missing LARK_APP_ID, LARK_APP_SECRET, or LARK_REDIRECT_URI"
    );
  }

  return { appId, appSecret, redirectUri };
}

// ─── PKCE Helpers ─────────────────────────────────────

/**
 * Generate PKCE code_verifier and code_challenge (S256 method).
 */
export function generatePKCE(): {
  codeVerifier: string;
  codeChallenge: string;
} {
  const codeVerifier = crypto.randomBytes(64).toString("base64url").slice(0, 128);
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  const codeChallenge = hash.toString("base64url");
  return { codeVerifier, codeChallenge };
}

// ─── Build OAuth URL ──────────────────────────────────

/**
 * Generate the Lark OAuth authorization URL with PKCE.
 * @returns { url, state, codeVerifier }
 */
export function buildLarkAuthUrl(): {
  url: string;
  state: string;
  codeVerifier: string;
} {
  const { appId, redirectUri } = getLarkConfig();
  const state = crypto.randomBytes(16).toString("hex");
  const { codeVerifier, codeChallenge } = generatePKCE();

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return {
    url: `${LARK_AUTH_URL}?${params.toString()}`,
    state,
    codeVerifier,
  };
}

// ─── Exchange Code for User Token (v2 with PKCE) ─────

export interface LarkTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/**
 * Exchange an authorization code for user access tokens using PKCE.
 * Uses the v2 OAuth token endpoint (no app access token needed).
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string
): Promise<LarkTokenResponse> {
  const { appId, appSecret, redirectUri } = getLarkConfig();

  const res = await fetch(LARK_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(
      `Lark token exchange HTTP error: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();

  // v2 endpoint returns code as string "0" on success
  if (data.code !== 0 && data.code !== "0") {
    throw new Error(
      `Lark token exchange error: ${data.error_description || data.msg || JSON.stringify(data)}`
    );
  }

  return data;
}
