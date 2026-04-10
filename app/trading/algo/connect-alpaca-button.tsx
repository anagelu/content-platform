"use client";

import { useMemo, useState } from "react";

type AlpacaConnectButtonProps = {
  clientId: string;
  redirectUri: string;
  preferredEnvironment: "paper" | "live";
  liveConnected: boolean;
  paperConnected: boolean;
};

export function ConnectAlpacaButton({
  clientId,
  redirectUri,
  preferredEnvironment,
  liveConnected,
  paperConnected,
}: AlpacaConnectButtonProps) {
  const [environment, setEnvironment] = useState<"paper" | "live">(preferredEnvironment);

  const startUrl = useMemo(
    () => `/api/auth/alpaca/start?env=${environment}&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`,
    [clientId, environment, redirectUri],
  );

  return (
    <div className="card" style={{ marginBottom: "1.5rem" }}>
      <h2 className="trading-section-title">Connect Alpaca</h2>
      <p className="meta">
        Connect your Alpaca account with OAuth so Pattern Foundry can load gauges,
        positions, and controller actions without relying on a shared server key.
      </p>
      <div className="toolbar" style={{ alignItems: "center", marginTop: "1rem" }}>
        <label className="form-group" style={{ minWidth: 220, marginBottom: 0 }}>
          <span className="form-label">Environment</span>
          <select
            className="form-select"
            value={environment}
            onChange={(event) => setEnvironment(event.target.value === "live" ? "live" : "paper")}
          >
            <option value="paper">Paper</option>
            <option value="live">Live</option>
          </select>
        </label>
        <a href={startUrl} className="button-link">
          {environment === "paper" ? "Connect Paper Alpaca" : "Connect Live Alpaca"}
        </a>
      </div>
      <div className="toolbar" style={{ marginTop: "1rem" }}>
        <span className="meta">
          Paper: <strong>{paperConnected ? "connected" : "not connected"}</strong>
        </span>
        <span className="meta">
          Live: <strong>{liveConnected ? "connected" : "not connected"}</strong>
        </span>
      </div>
      <p className="form-help" style={{ marginTop: "0.85rem", marginBottom: 0 }}>
        Uses OAuth scopes `account:write`, `trading`, and `data` with redirect URI {redirectUri}.
      </p>
    </div>
  );
}
