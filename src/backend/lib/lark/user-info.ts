// ─── Lark User Info (International / Larksuite) ──────

const LARK_USER_INFO_URL =
  "https://open.larksuite.com/open-apis/authen/v1/user_info";

export interface LarkUserInfo {
  open_id: string;
  union_id: string;
  name: string;
  en_name: string;
  avatar_url: string;
  email: string;
  mobile: string;
  user_id: string;
}

/**
 * Fetch the authenticated user's profile from Lark.
 * @param accessToken – user-level access token from OAuth exchange
 */
export async function fetchLarkUserInfo(
  accessToken: string
): Promise<LarkUserInfo> {
  const res = await fetch(LARK_USER_INFO_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Lark user info HTTP error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  if (data.code !== 0) {
    throw new Error(`Lark user info error: ${data.msg}`);
  }

  return data.data;
}
