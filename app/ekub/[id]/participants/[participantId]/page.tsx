import { auth } from "@/auth";
import { buildParticipantLedger, getParticipantStatusLabel } from "@/lib/ekub";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function EkubParticipantWalletPage({
  params,
}: {
  params: Promise<{ id: string; participantId: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id, participantId } = await params;
  const groupId = Number(id);
  const numericParticipantId = Number(participantId);

  if (
    !Number.isFinite(groupId) ||
    groupId <= 0 ||
    !Number.isFinite(numericParticipantId) ||
    numericParticipantId <= 0
  ) {
    notFound();
  }

  const userId = Number(session.user.id);
  const participant = await prisma.ekubParticipant.findUnique({
    where: { id: numericParticipantId },
    include: {
      group: true,
      contributions: {
        include: { cycle: true },
      },
      payouts: {
        include: { cycle: true },
      },
    },
  });

  if (!participant || participant.groupId !== groupId) {
    notFound();
  }

  if (session.user.role !== "admin" && participant.group.ownerId !== userId) {
    redirect("/ekub");
  }

  const ledger = buildParticipantLedger(participant.id, participant.contributions, participant.payouts);

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">{participant.name}&apos;s Wallet</h1>
        <p className="page-subtitle">
          Virtual contribution and payout history inside <strong>{participant.group.name}</strong>.
        </p>

        <p className="ekub-sim-note">
          Simulated funds only &mdash; these balances track participation inside the group and do not represent
          real money held anywhere.
        </p>

        <div className="toolbar">
          <Link href={`/ekub/${groupId}/participants`} className="button-link secondary">
            Back to Participants
          </Link>
          <Link href={`/ekub/${groupId}`} className="button-link secondary">
            Group Overview
          </Link>
        </div>

        <div className="ekub-dashboard-grid">
          <section className="card">
            <h2 className="trading-section-title">Wallet Summary</h2>
            <div className="ekub-metric-grid">
              <div>
                <span>Status</span>
                <strong>{getParticipantStatusLabel(participant.status)}</strong>
              </div>
              <div>
                <span>Rotation Order</span>
                <strong>{participant.rotationOrder ?? "--"}</strong>
              </div>
              <div>
                <span>Total Contributed</span>
                <strong>{ledger.totalContributed.toFixed(2)}</strong>
              </div>
              <div>
                <span>Total Received</span>
                <strong>{ledger.totalReceived.toFixed(2)}</strong>
              </div>
              <div>
                <span>Net Position</span>
                <strong>{ledger.netPosition.toFixed(2)}</strong>
              </div>
              <div>
                <span>Contact</span>
                <strong>{participant.email || "No email"}</strong>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="trading-section-title">Transaction Ledger</h2>
            {ledger.entries.length === 0 ? (
              <p className="preview">No recorded contributions or payouts yet.</p>
            ) : (
              <div className="ekub-list">
                {ledger.entries.map((entry) => (
                  <div key={entry.id} className="ekub-list-row">
                    <div>
                      <strong>{entry.type === "contribution" ? "Contribution" : "Payout Received"}</strong>
                      <p className="meta">
                        {entry.cycleNumber !== null ? `Cycle #${entry.cycleNumber} · ` : ""}
                        {entry.date.toLocaleDateString()}
                      </p>
                    </div>
                    <strong className={entry.type === "payout" ? "ekub-ledger-credit" : "ekub-ledger-debit"}>
                      {entry.type === "payout" ? "+" : "-"}
                      {entry.amount.toFixed(2)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
