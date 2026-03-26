"use client";

import { useActionState } from "react";
import {
  type HeldAssetActionState,
  manageAlpacaHeldAssetAction,
} from "./actions";

const initialHeldAssetActionState: HeldAssetActionState = {
  error: "",
  success: "",
};

function getHeldAssetActionLabels(side: "long" | "short") {
  if (side === "short") {
    return {
      reduce: "Cover 50%",
      close: "Close Short",
    };
  }

  return {
    reduce: "Trim 50%",
    close: "Close Position",
  };
}

export function HeldAssetActions({
  symbol,
  side,
  availableQty,
  heldForOrdersQty,
}: {
  symbol: string;
  side: "long" | "short";
  availableQty: number;
  heldForOrdersQty: number;
}) {
  const [state, formAction, pending] = useActionState(
    manageAlpacaHeldAssetAction,
    initialHeldAssetActionState,
  );
  const labels = getHeldAssetActionLabels(side);
  const unavailable = availableQty <= 0;

  return (
    <>
      <div className="held-asset-actions">
        <form action={formAction}>
          <input type="hidden" name="symbol" value={symbol} />
          <input type="hidden" name="positionAction" value="REDUCE_HALF" />
          <button
            type="submit"
            className="button-link secondary held-asset-action-button"
            disabled={pending || unavailable}
          >
            {pending ? "Working..." : labels.reduce}
          </button>
        </form>
        <form action={formAction}>
          <input type="hidden" name="symbol" value={symbol} />
          <input type="hidden" name="positionAction" value="CLOSE" />
          <button
            type="submit"
            className="button-link secondary held-asset-action-button"
            disabled={pending || unavailable}
          >
            {pending ? "Working..." : labels.close}
          </button>
        </form>
      </div>

      {heldForOrdersQty > 0 ? (
        <p className="meta held-asset-note">
          {heldForOrdersQty} shares are currently reserved by another open order.
        </p>
      ) : null}

      {state.error ? (
        <p className="held-asset-inline-error">{state.error}</p>
      ) : null}

      {state.success ? (
        <p className="held-asset-inline-success">{state.success}</p>
      ) : null}
    </>
  );
}
