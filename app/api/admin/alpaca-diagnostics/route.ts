import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  return NextResponse.json({
    alpacaEnvironment: process.env.ALPACA_ENVIRONMENT?.trim() || "(unset, defaults to paper)",
    hasServerApiKey: Boolean(process.env.ALPACA_API_KEY?.trim()),
    hasServerApiSecret: Boolean(process.env.ALPACA_API_SECRET?.trim()),
    dataFeed: process.env.ALPACA_DATA_FEED?.trim() || "(unset, defaults to iex)",
    optionsFeed: process.env.ALPACA_OPTIONS_FEED?.trim() || "(unset, defaults to indicative)",
    hasAutomationSecret: Boolean(process.env.ALPACA_AUTOMATION_SECRET?.trim()),
    hasOauthClientId: Boolean(process.env.ALPACA_OAUTH_CLIENT_ID?.trim()),
    hasOauthClientSecret: Boolean(process.env.ALPACA_OAUTH_CLIENT_SECRET?.trim()),
    hasOauthRedirectUri: Boolean(process.env.ALPACA_OAUTH_REDIRECT_URI?.trim()),
    oauthRedirectUriValue: process.env.ALPACA_OAUTH_REDIRECT_URI?.trim() || "(unset)",
  });
}
