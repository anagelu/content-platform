import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/secret-crypto";
import {
  getAlpacaCredentials,
  type AlpacaCredentials,
  type AlpacaEnvironment,
} from "@/lib/alpaca";

const ALPACA_AUTHORIZE_URL = "https://app.alpaca.markets/oauth/authorize";
const ALPACA_TOKEN_URL = "https://api.alpaca.markets/oauth/token";

export const ALPACA_OAUTH_SCOPES = ["account:write", "trading", "data"] as const;

export type AlpacaConnectionEnvironment = AlpacaEnvironment;

type StoredConnectionColumns = {
  alpacaPreferredEnvironment: string | null;
  alpacaLiveAccessTokenEncrypted: string | null;
  alpacaLiveScope: string | null;
  alpacaPaperAccessTokenEncrypted: string | null;
  alpacaPaperScope: string | null;
};

export function getAlpacaOauthClientId() {
  const clientId = process.env.ALPACA_OAUTH_CLIENT_ID?.trim();

  if (!clientId) {
    throw new Error("Missing ALPACA_OAUTH_CLIENT_ID.");
  }

  return clientId;
}

export function getAlpacaOauthClientSecret() {
  const clientSecret = process.env.ALPACA_OAUTH_CLIENT_SECRET?.trim();

  if (!clientSecret) {
    throw new Error("Missing ALPACA_OAUTH_CLIENT_SECRET.");
  }

  return clientSecret;
}

export function getAlpacaOauthRedirectUri() {
  const redirectUri = process.env.ALPACA_OAUTH_REDIRECT_URI?.trim();

  if (!redirectUri) {
    throw new Error("Missing ALPACA_OAUTH_REDIRECT_URI.");
  }

  return redirectUri;
}

export function normalizeAlpacaOauthEnvironment(value: string | null | undefined) {
  return value === "live" ? "live" : "paper";
}

export function buildAlpacaAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  environment: AlpacaConnectionEnvironment;
  scopes?: readonly string[];
}) {
  const url = new URL(ALPACA_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", (input.scopes ?? ALPACA_OAUTH_SCOPES).join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("env", input.environment);
  return url.toString();
}

export async function exchangeAlpacaAuthorizationCode(input: {
  code: string;
  redirectUri: string;
}) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    client_id: getAlpacaOauthClientId(),
    client_secret: getAlpacaOauthClientSecret(),
    redirect_uri: input.redirectUri,
  });

  const response = await fetch(ALPACA_TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Alpaca OAuth token exchange failed (${response.status}): ${errorText || "Unknown error"}`,
    );
  }

  return (await response.json()) as {
    access_token?: string;
    scope?: string;
    token_type?: string;
  };
}

export async function saveUserAlpacaAccessToken(input: {
  userId: number;
  environment: AlpacaConnectionEnvironment;
  accessToken: string;
  scope: string;
}) {
  const encryptedToken = encryptSecret(input.accessToken);

  await prisma.user.update({
    where: { id: input.userId },
    data:
      input.environment === "live"
        ? {
            alpacaPreferredEnvironment: "live",
            alpacaLiveAccessTokenEncrypted: encryptedToken,
            alpacaLiveScope: input.scope,
            alpacaLiveConnectedAt: new Date(),
          }
        : {
            alpacaPreferredEnvironment: "paper",
            alpacaPaperAccessTokenEncrypted: encryptedToken,
            alpacaPaperScope: input.scope,
            alpacaPaperConnectedAt: new Date(),
          },
  });
}

export async function getUserAlpacaConnectionStatus(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      alpacaPreferredEnvironment: true,
      alpacaLiveScope: true,
      alpacaLiveConnectedAt: true,
      alpacaPaperScope: true,
      alpacaPaperConnectedAt: true,
    },
  });

  return {
    preferredEnvironment: normalizeAlpacaOauthEnvironment(
      user?.alpacaPreferredEnvironment,
    ) as AlpacaConnectionEnvironment,
    liveConnected: Boolean(user?.alpacaLiveConnectedAt),
    liveScope: user?.alpacaLiveScope ?? "",
    liveConnectedAt: user?.alpacaLiveConnectedAt ?? null,
    paperConnected: Boolean(user?.alpacaPaperConnectedAt),
    paperScope: user?.alpacaPaperScope ?? "",
    paperConnectedAt: user?.alpacaPaperConnectedAt ?? null,
  };
}

export async function setUserAlpacaPreferredEnvironment(
  userId: number,
  environment: AlpacaConnectionEnvironment,
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      alpacaPreferredEnvironment: environment,
    },
  });
}

function resolveStoredAccessToken(
  user: StoredConnectionColumns | null,
  environment: AlpacaConnectionEnvironment,
) {
  if (!user) {
    return null;
  }

  return environment === "live"
    ? user.alpacaLiveAccessTokenEncrypted
    : user.alpacaPaperAccessTokenEncrypted;
}

export async function getUserAlpacaCredentials(
  userId: number,
  environment?: AlpacaConnectionEnvironment,
): Promise<AlpacaCredentials> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      alpacaPreferredEnvironment: true,
      alpacaLiveAccessTokenEncrypted: true,
      alpacaLiveScope: true,
      alpacaPaperAccessTokenEncrypted: true,
      alpacaPaperScope: true,
    },
  });

  const preferredEnvironment =
    environment ?? normalizeAlpacaOauthEnvironment(user?.alpacaPreferredEnvironment);
  const encryptedToken = resolveStoredAccessToken(user, preferredEnvironment);

  if (encryptedToken) {
    return {
      authMode: "oauth",
      accessToken: decryptSecret(encryptedToken),
      environment: preferredEnvironment,
    };
  }

  return getAlpacaCredentials();
}
