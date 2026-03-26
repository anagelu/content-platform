"use client";

import { useMemo, useState } from "react";

export function RiskRewardCalculator() {
  const [entry, setEntry] = useState("100");
  const [stop, setStop] = useState("95");
  const [target, setTarget] = useState("112");

  const metrics = useMemo(() => {
    const entryValue = Number(entry);
    const stopValue = Number(stop);
    const targetValue = Number(target);

    if (
      !Number.isFinite(entryValue) ||
      !Number.isFinite(stopValue) ||
      !Number.isFinite(targetValue)
    ) {
      return null;
    }

    const risk = Math.abs(entryValue - stopValue);
    const reward = Math.abs(targetValue - entryValue);

    if (risk === 0) {
      return null;
    }

    return {
      risk: risk.toFixed(2),
      reward: reward.toFixed(2),
      ratio: (reward / risk).toFixed(2),
    };
  }, [entry, stop, target]);

  return (
    <div className="form-card">
      <div className="trading-grid">
        <div className="form-group">
          <label className="form-label" htmlFor="entry">
            Entry
          </label>
          <input
            id="entry"
            className="form-input"
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="stop">
            Stop
          </label>
          <input
            id="stop"
            className="form-input"
            value={stop}
            onChange={(event) => setStop(event.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="target">
            Target
          </label>
          <input
            id="target"
            className="form-input"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </div>
      </div>

      <div className="trading-metric-row">
        <div className="trading-metric-card">
          <span className="trading-metric-label">Risk</span>
          <strong>{metrics?.risk ?? "--"}</strong>
        </div>
        <div className="trading-metric-card">
          <span className="trading-metric-label">Reward</span>
          <strong>{metrics?.reward ?? "--"}</strong>
        </div>
        <div className="trading-metric-card">
          <span className="trading-metric-label">R:R</span>
          <strong>{metrics ? `${metrics.ratio} : 1` : "--"}</strong>
        </div>
      </div>
    </div>
  );
}
