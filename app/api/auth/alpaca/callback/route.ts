import { auth } from "@/auth";
import {
  exchangeAlpacaAuthorizationCode,
  getAlpacaOauthRedirectUri,
  normalizeAlpacaOauthEnvironment,
  saveUserAlpacaAccessToken,
} from "@/lib/alpaca-oauth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ALPACA_OAUTH_STATE_COOKIE = "alpaca_oauth_state";

export async function GET(request: Request) {
  const session = await auth();
  const redirectBase = new URL("/trading/algo", request.url);

  if (!session?.user?.id) {
    redirectBase.searchParams.set("alpaca", "auth-required");
    return NextResponse.redirect(redirectBase);
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(ALPACA_OAUTH_STATE_COOKIE)?.value;

  cookieStore.delete(ALPACA_OAUTH_STATE_COOKIE);

  if (error) {
    redirectBase.searchParams.set("alpaca", "error");
    redirectBase.searchParams.set("message", error);
    return NextResponse.redirect(redirectBase);
  }

  if (!code || !state || !stateCookie) {
    redirectBase.searchParams.set("alpaca", "missing-code");
    return NextResponse.redirect(redirectBase);
  }

  let parsedState: {
    state: string;
    environment: "paper" | "live";
    userId: string;
  };

  try {
    parsedState = JSON.parse(stateCookie) as {
      state: string;
      environment: "paper" | "live";
      userId: string;
    };
  } catch {
    redirectBase.searchParams.set("alpaca", "invalid-state");
    return NextResponse.redirect(redirectBase);
  }

  if (parsedState.state !== state || parsedState.userId !== session.user.id) {
    redirectBase.searchParams.set("alpaca", "state-mismatch");
    return NextResponse.redirect(redirectBase);
  }

  try {
    const tokenPayload = await exchangeAlpacaAuthorizationCode({
      code,
      redirectUri: getAlpacaOauthRedirectUri(),
    });

    if (!tokenPayload.access_token) {
      throw new Error("No access token was returned by Alpaca.");
    }

    await saveUserAlpacaAccessToken({
      userId: Number(session.user.id),
      environment: normalizeAlpacaOauthEnvironment(parsedState.environment),
      accessToken: tokenPayload.access_token,
      scope: tokenPayload.scope ?? "",
    });

    redirectBase.searchParams.set("alpaca", "connected");
    redirectBase.searchParams.set("env", parsedState.environment);
    return NextResponse.redirect(redirectBase);
  } catch (callbackError) {
    redirectBase.searchParams.set("alpaca", "exchange-failed");
    redirectBase.searchParams.set(
      "message",
      callbackError instanceof Error ? callbackError.message : "OAuth exchange failed.",
    );
    return NextResponse.redirect(redirectBase);
  }
}
