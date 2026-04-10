import { auth } from "@/auth";
import {
  buildAlpacaAuthorizationUrl,
  getAlpacaOauthClientId,
  getAlpacaOauthRedirectUri,
  normalizeAlpacaOauthEnvironment,
} from "@/lib/alpaca-oauth";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ALPACA_OAUTH_STATE_COOKIE = "alpaca_oauth_state";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const environment = normalizeAlpacaOauthEnvironment(url.searchParams.get("env"));
  const state = randomUUID();
  const redirectUri = getAlpacaOauthRedirectUri();
  const authorizeUrl = buildAlpacaAuthorizationUrl({
    clientId: getAlpacaOauthClientId(),
    redirectUri,
    state,
    environment,
  });

  const cookieStore = await cookies();
  cookieStore.set(
    ALPACA_OAUTH_STATE_COOKIE,
    JSON.stringify({
      state,
      environment,
      userId: session.user.id,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    },
  );

  return NextResponse.redirect(authorizeUrl);
}
