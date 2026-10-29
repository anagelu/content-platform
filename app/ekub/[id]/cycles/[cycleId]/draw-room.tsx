"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runRandomEkubDraw, type EkubDrawResult } from "../../../actions";

type EligibleParticipant = {
  id: number;
  name: string;
};

type DrawPhase = "idle" | "drawing" | "revealed" | "error";

const REVEAL_MIN_DURATION_MS = 1800;
const REEL_INTERVAL_MS = 110;

export function EkubDrawRoom({
  groupId,
  cycleId,
  cycleNumber,
  potSize,
  eligibleParticipants,
}: {
  groupId: number;
  cycleId: number;
  cycleNumber: number;
  potSize: number;
  eligibleParticipants: EligibleParticipant[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<DrawPhase>("idle");
  const [reelName, setReelName] = useState<string>(eligibleParticipants[0]?.name ?? "");
  const [winner, setWinner] = useState<EkubDrawResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const reelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (reelIntervalRef.current) {
        clearInterval(reelIntervalRef.current);
      }
    };
  }, []);

  function handleRunDraw() {
    if (eligibleParticipants.length === 0 || phase === "drawing") {
      return;
    }

    setErrorMessage(null);
    setWinner(null);
    setPhase("drawing");

    let step = 0;
    reelIntervalRef.current = setInterval(() => {
      step += 1;
      setReelName(eligibleParticipants[step % eligibleParticipants.length].name);
    }, REEL_INTERVAL_MS);

    startTransition(async () => {
      try {
        // The result is decided and written to the database the moment this
        // resolves. The delay below only paces how long the reel keeps
        // cycling on screen -- it never changes who already won.
        const [result] = await Promise.all([
          runRandomEkubDraw(groupId, cycleId),
          new Promise((resolve) => setTimeout(resolve, REVEAL_MIN_DURATION_MS)),
        ]);

        if (reelIntervalRef.current) {
          clearInterval(reelIntervalRef.current);
          reelIntervalRef.current = null;
        }

        setWinner(result);
        setReelName(result.recipientName);
        setPhase("revealed");
        router.refresh();
      } catch (err) {
        if (reelIntervalRef.current) {
          clearInterval(reelIntervalRef.current);
          reelIntervalRef.current = null;
        }

        setErrorMessage(err instanceof Error ? err.message : "The draw could not be completed.");
        setPhase("error");
      }
    });
  }

  return (
    <section className="card ekub-draw-room">
      <div className="ekub-card-header">
        <div>
          <h2 className="trading-section-title">Draw Room</h2>
          <p className="meta">
            Cycle #{cycleNumber} &middot; pot {potSize.toFixed(2)} &middot; one eligible participant is selected at
            random.
          </p>
        </div>
        <span className="badge">{eligibleParticipants.length} eligible</span>
      </div>

      <p className="ekub-sim-note">
        Simulated funds only &mdash; this draw assigns a virtual payout for tracking purposes, not a real transfer.
      </p>

      <div className="ekub-draw-stage" data-phase={phase}>
        {phase === "idle" ? (
          <p className="ekub-draw-placeholder">Press &ldquo;Run Draw&rdquo; to select this cycle&apos;s recipient.</p>
        ) : (
          <p className={phase === "revealed" ? "ekub-draw-name ekub-draw-name-settled" : "ekub-draw-name"}>
            {reelName}
          </p>
        )}
        {phase === "revealed" && winner ? (
          <p className="ekub-draw-result">🎉 {winner.recipientName} receives this cycle&apos;s pot.</p>
        ) : null}
      </div>

      {errorMessage ? <p className="ekub-draw-error">{errorMessage}</p> : null}

      <div className="ekub-inline-toolbar">
        <button
          type="button"
          className="button-link secondary"
          onClick={handleRunDraw}
          disabled={isPending || phase === "drawing" || phase === "revealed" || eligibleParticipants.length === 0}
        >
          {phase === "drawing" ? "Drawing..." : phase === "revealed" ? "Draw Complete" : "Run Draw"}
        </button>
      </div>

      <details className="ekub-draw-eligible">
        <summary>Eligible participants for this draw</summary>
        <div className="ekub-list">
          {eligibleParticipants.map((participant) => (
            <div key={participant.id} className="ekub-list-row">
              <strong>{participant.name}</strong>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
