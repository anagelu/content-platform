import { auth } from "@/auth";
import {
  calculateCollectionProgress,
  getEligibleRandomParticipants,
  getPayoutMethodLabel,
} from "@/lib/ekub";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  assignEkubRecipient,
  recordEkubPayout,
  updateEkubContribution,
} from "../../../actions";
import { EkubDrawRoom } from "./draw-room";

export default async function EkubCyclePage({
  params,
}: {
  params: Promise<{ id: string; cycleId: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id, cycleId } = await params;
  const groupId = Number(id);
  const numericCycleId = Number(cycleId);

  if (!Number.isFinite(groupId) || groupId <= 0 || !Number.isFinite(numericCycleId) || numericCycleId <= 0) {
    notFound();
  }

  const userId = Number(session.user.id);
  const cycle = await prisma.ekubCycle.findUnique({
    where: { id: numericCycleId },
    include: {
      group: {
        include: {
          participants: {
            orderBy: [{ rotationOrder: "asc" }, { createdAt: "asc" }],
          },
          cycles: {
            include: {
              recipient: true,
              payout: {
                include: {
                  recipient: true,
                },
              },
            },
            orderBy: { cycleNumber: "asc" },
          },
        },
      },
      recipient: true,
      contributions: {
        include: {
          participant: true,
        },
      },
      payout: {
        include: {
          recipient: true,
        },
      },
    },
  });

  if (!cycle || cycle.groupId !== groupId) {
    notFound();
  }

  if (session.user.role !== "admin" && cycle.group.ownerId !== userId) {
    redirect("/ekub");
  }

  const progress = calculateCollectionProgress(
    cycle.contributions,
    cycle.group.participants.filter((participant) => participant.status === "ACTIVE").length,
  );
  const contributions = [...cycle.contributions].sort((a, b) => {
    const orderA = a.participant.rotationOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.participant.rotationOrder ?? Number.MAX_SAFE_INTEGER;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.participant.id - b.participant.id;
  });

  const groupPayouts = cycle.group.cycles
    .map((entry) => entry.payout)
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const eligibleForDraw = getEligibleRandomParticipants(cycle.group.participants, groupPayouts).map(
    (participant) => ({ id: participant.id, name: participant.name }),
  );
  const drawHistory = cycle.group.cycles
    .filter((entry) => entry.drawRunAt && entry.recipient)
    .sort((a, b) => new Date(b.drawRunAt as Date).getTime() - new Date(a.drawRunAt as Date).getTime());

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">
          Cycle #{cycle.cycleNumber}
        </h1>
        <p className="page-subtitle">
          {cycle.group.name} · {getPayoutMethodLabel(cycle.group.payoutMethod)} · due{" "}
          {new Date(cycle.dueDate).toLocaleDateString()}
        </p>

        <div className="toolbar">
          <Link href={`/ekub/${cycle.groupId}`} className="button-link secondary">
            Back to Group
          </Link>
          <Link href={`/ekub/${cycle.groupId}/participants`} className="button-link secondary">
            Participants
          </Link>
        </div>

        <div className="ekub-dashboard-grid">
          <section className="card">
            <div className="ekub-card-header">
              <div>
                <h2 className="trading-section-title">Cycle Status</h2>
                <p className="meta">Track contribution completion, assign the recipient, then record payout.</p>
              </div>
              <span className="badge">{cycle.status}</span>
            </div>

            <div className="ekub-metric-grid">
              <div>
                <span>Total Expected</span>
                <strong>{cycle.totalExpectedContribution.toFixed(2)}</strong>
              </div>
              <div>
                <span>Total Collected</span>
                <strong>{cycle.totalCollected.toFixed(2)}</strong>
              </div>
              <div>
                <span>Recipient</span>
                <strong>{cycle.recipient?.name ?? "Not assigned"}</strong>
              </div>
              <div>
                <span>Payout</span>
                <strong>{cycle.payout ? cycle.payout.amountPaidOut.toFixed(2) : "Not recorded"}</strong>
              </div>
            </div>

            <div className="ekub-progress-stack">
              <div className="ekub-progress-meta">
                <span>Payments Received</span>
                <strong>{progress}%</strong>
              </div>
              <div className="ekub-progress-bar">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>

            {!cycle.recipient && cycle.group.payoutMethod === "FIXED_ROTATION" ? (
              <form action={assignEkubRecipient} className="ekub-inline-toolbar">
                <input type="hidden" name="groupId" value={cycle.groupId} />
                <input type="hidden" name="cycleId" value={cycle.id} />
                <button type="submit" className="button-link secondary">
                  Assign Rotation Recipient
                </button>
              </form>
            ) : null}
          </section>

          {!cycle.recipient && cycle.group.payoutMethod === "RANDOM_DRAW" ? (
            <EkubDrawRoom
              groupId={cycle.groupId}
              cycleId={cycle.id}
              cycleNumber={cycle.cycleNumber}
              potSize={cycle.totalExpectedContribution}
              eligibleParticipants={eligibleForDraw}
            />
          ) : null}

          <section className="card">
            <h2 className="trading-section-title">Payout</h2>
            {cycle.payout ? (
              <div className="ekub-list">
                <div className="ekub-list-row">
                  <div>
                    <strong>{cycle.payout.recipient.name}</strong>
                    <p className="meta">
                      {new Date(cycle.payout.payoutDate).toLocaleDateString()}
                      {cycle.payout.notes ? ` · ${cycle.payout.notes}` : ""}
                    </p>
                  </div>
                  <strong>{cycle.payout.amountPaidOut.toFixed(2)}</strong>
                </div>
              </div>
            ) : (
              <form action={recordEkubPayout} className="ekub-form-stack">
                <input type="hidden" name="groupId" value={cycle.groupId} />
                <input type="hidden" name="cycleId" value={cycle.id} />
                <div className="ekub-form-grid">
                  <label className="ekub-field">
                    <span className="site-sidebar-label">Recipient</span>
                    <select
                      name="recipientParticipantId"
                      className="form-input"
                      defaultValue={cycle.recipientParticipantId ?? ""}
                    >
                      <option value="">Select recipient</option>
                      {cycle.group.participants.map((participant) => (
                        <option key={participant.id} value={participant.id}>
                          {participant.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="ekub-field">
                    <span className="site-sidebar-label">Amount Paid Out</span>
                    <input
                      type="number"
                      name="amountPaidOut"
                      className="form-input"
                      min="0"
                      step="0.01"
                      defaultValue={cycle.totalCollected > 0 ? cycle.totalCollected.toFixed(2) : undefined}
                    />
                  </label>

                  <label className="ekub-field">
                    <span className="site-sidebar-label">Payout Date</span>
                    <input
                      type="date"
                      name="payoutDate"
                      className="form-input"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </label>
                </div>
                <label className="ekub-field">
                  <span className="site-sidebar-label">Notes</span>
                  <textarea
                    name="notes"
                    className="form-textarea"
                    rows={4}
                    placeholder="Optional payout notes"
                  />
                </label>

                <button type="submit" className="submit-button">
                  Record Payout
                </button>
              </form>
            )}
          </section>
        </div>

        <section className="card">
          <h2 className="trading-section-title">Contributions</h2>
          <div className="ekub-list">
            {contributions.map((contribution) => (
              <form
                key={contribution.id}
                action={updateEkubContribution}
                className="ekub-list-row ekub-contribution-form"
              >
                <input type="hidden" name="groupId" value={cycle.groupId} />
                <input type="hidden" name="cycleId" value={cycle.id} />
                <input type="hidden" name="contributionId" value={contribution.id} />
                <div>
                  <strong>{contribution.participant.name}</strong>
                  <p className="meta">
                    {contribution.isPaid
                      ? `Paid ${contribution.amountPaid.toFixed(2)}${contribution.paidAt ? ` on ${new Date(contribution.paidAt).toLocaleDateString()}` : ""}`
                      : "Not paid yet"}
                  </p>
                </div>
                <div className="ekub-inline-form">
                  <input
                    type="number"
                    name="amountPaid"
                    className="form-input"
                    min="0"
                    step="0.01"
                    defaultValue={contribution.amountPaid.toFixed(2)}
                  />
                  <input
                    type="date"
                    name="paidDate"
                    className="form-input"
                    defaultValue={contribution.paidAt ? new Date(contribution.paidAt).toISOString().slice(0, 10) : ""}
                  />
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="isPaid"
                      defaultChecked={contribution.isPaid}
                    />
                    Paid
                  </label>
                  <button type="submit" className="mini-button">
                    Save
                  </button>
                </div>
              </form>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="trading-section-title">Draw History</h2>
          {drawHistory.length === 0 ? (
            <p className="preview">No recipients have been drawn or assigned yet.</p>
          ) : (
            <div className="ekub-list">
              {drawHistory.map((entry) => (
                <div key={entry.id} className="ekub-list-row">
                  <div>
                    <strong>{entry.recipient?.name}</strong>
                    <p className="meta">
                      Cycle #{entry.cycleNumber} &middot;{" "}
                      {entry.drawRunAt ? new Date(entry.drawRunAt).toLocaleString() : "date unknown"}
                    </p>
                  </div>
                  <span className="badge">
                    {entry.payout ? "Paid out" : "Selected"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
