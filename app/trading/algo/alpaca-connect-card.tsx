import { auth } from "@/auth";
import {
  getAlpacaOauthClientId,
  getAlpacaOauthRedirectUri,
  getUserAlpacaConnectionStatus,
} from "@/lib/alpaca-oauth";
import { ConnectAlpacaButton } from "./connect-alpaca-button";

export async function AlpacaConnectCard() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const status = await getUserAlpacaConnectionStatus(Number(session.user.id));
  let clientId = "";
  let redirectUri = "";

  try {
    clientId = getAlpacaOauthClientId();
    redirectUri = getAlpacaOauthRedirectUri();
  } catch (error) {
    return (
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 className="trading-section-title">Connect Alpaca</h2>
        <p className="form-error" style={{ marginBottom: 0 }}>
          {error instanceof Error ? error.message : "Alpaca OAuth is not configured yet."}
        </p>
      </div>
    );
  }

  return (
    <ConnectAlpacaButton
      clientId={clientId}
      redirectUri={redirectUri}
      preferredEnvironment={status.preferredEnvironment}
      liveConnected={status.liveConnected}
      paperConnected={status.paperConnected}
    />
  );
}
