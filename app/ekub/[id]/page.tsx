import { auth } from "@/auth";
import {
  calculateCollectionProgress,
  calculatePotSize,
  getActiveParticipants,
  getCycleFrequencyLabel,
  getPayoutMethodLabel,
} from "@/lib/ekub";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createNextEkubCycle, deleteEkubGroup } from "../actions";

export default async function EkubGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const groupId = Number(id);

  if (!Number.isFinite(groupId) || groupId <= 0) {
    notFound();
  }

  const userId = Number(session.user.id);
  const group = await prisma.ekubGroup.findUnique({
    where: { id: groupId },
    include: {
      owner: true,
      participants: {
        orderBy: [{ rotationOrder: "asc" }, { createdAt: "asc" }],
      },
      cycles: {
        include: {
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
        orderBy: [{ cycleNumber: "desc" }],
      },
    },
  });

  if (!group) {
    notFound();
  }

  if (session.user.role !== "admin" && group.ownerId !== userId) {
    redirect("/ekub");
  }

  const activeParticipants = getActiveParticipants(group.participants);
  const potSize = calculatePotSize(group.contributionAmount, activeParticipants.length);
  const currentCycle = group.cycles.find((cycle) => cycle.status !== "COMPLETED") ?? group.cycles[0] ?? null;
  const pastCycles = currentCycle ? group.cycles.filter((cycle) => cycle.id !== currentCycle.id) : group.cycles;

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <section className="section-command-surface">
          <div className="section-command-main">
            <p className="home-hero-kicker">Ekub Dashboard</p>
            <h1 className="page-title">{group.name}</h1>
            <p className="page-subtitle">
              {group.description ||
                "Manage the member circle, keep contributions current, and move the pot from cycle to cycle."}
            </p>
            <div className="section-command-strip">
              <Link href="/ekub" className="section-command-link">
                <strong>All Groups</strong>
                <span>Return to list</span>
              </Link>
              <Link href={`/ekub/${group.id}/participants`} className="section-command-link">
                <strong>Participants</strong>
                <span>Manage the member list</span>
              </Link>
              {currentCycle ? (
                <Link
                  href={`/ekub/${group.id}/cycles/${currentCycle.id}`}
                  className="section-command-link is-accent"
                >
                  <strong>Open Current Cycle</strong>
                  <span>Update contributions and payout</span>
                </Link>
              ) : null}
              <form action={deleteEkubGroup}>
                <input type="hidden" name="groupId" value={group.id} />
                <button type="submit" className="delete-button">
                  Delete Group
                </button>
              </form>
            </div>
          </div>

          <div className="section-command-panel">
            <p className="home-hero-panel-label">Group Status</p>
            <div className="home-command-metrics">
              <div>
                <span>Active members</span>
                <strong>{activeParticipants.length}</strong>
              </div>
              <div>
                <span>Pot size</span>
                <strong>{potSize.toFixed(2)}</strong>
              </div>
              <div>
                <span>Cycles</span>
                <strong>{group.cycles.length}</strong>
              </div>
            </div>
          </div>
        </section>

        <div className="ekub-dashboard-grid">
          <section className="card">
            <h2 className="trading-section-title">Group Snapshot</h2>
            <div className="ekub-metric-grid">
              <div>
                <span>Contribution Amount</span>
                <strong>{group.contributionAmount.toFixed(2)}</strong>
              </div>
              <div>
                <span>Cycle Frequency</span>
                <strong>{getCycleFrequencyLabel(group.cycleFrequency)}</strong>
              </div>
              <div>
                <span>Payout Method</span>
                <strong>{getPayoutMethodLabel(group.payoutMethod)}</strong>
              </div>
              <div>
                <span>Max Participants</span>
                <strong>{group.maxParticipants}</strong>
              </div>
              <div>
                <span>Owner</span>
                <strong>{group.owner.name ?? group.owner.username}</strong>
              </div>
              <div>
                <span>Updated</span>
                <strong>{new Date(group.updatedAt).toLocaleDateString()}</strong>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="ekub-card-header">
              <div>
                <h2 className="trading-section-title">Current Cycle</h2>
                <p className="meta">Open the current cycle to record payments, assign recipients, and pay out the pot.</p>
              </div>
              <form action={createNextEkubCycle}>
                <input type="hidden" name="groupId" value={group.id} />
                <button type="submit" className="button-link secondary">
                  Create Next Cycle
                </button>
              </form>
            </div>

            {currentCycle ? (
              <div className="ekub-cycle-highlight">
                <div className="ekub-metric-grid">
                  <div>
                    <span>Cycle</span>
                    <strong>#{currentCycle.cycleNumber}</strong>
                  </div>
                  <div>
                    <span>Due Date</span>
                    <strong>{new Date(currentCycle.dueDate).toLocaleDateString()}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{currentCycle.status}</strong>
                  </div>
                  <div>
                    <span>Recipient</span>
                    <strong>{currentCycle.recipient?.name ?? "Not assigned"}</strong>
                  </div>
                </div>

                <div className="ekub-progress-stack">
                  <div className="ekub-progress-meta">
                    <span>Collection Progress</span>
                    <strong>
                      {calculateCollectionProgress(currentCycle.contributions, activeParticipants.length)}%
                    </strong>
                  </div>
                  <div className="ekub-progress-bar">
                    <span
                      style={{
                        width: `${calculateCollectionProgress(
                          currentCycle.contributions,
                          activeParticipants.length,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="meta">
                    {currentCycle.totalCollected.toFixed(2)} collected out of{" "}
                    {currentCycle.totalExpectedContribution.toFixed(2)} expected
                  </p>
                </div>

                <Link href={`/ekub/${group.id}/cycles/${currentCycle.id}`} className="button-link">
                  Open Cycle Detail
                </Link>
              </div>
            ) : (
              <p className="preview">
                No cycle has been created yet. Add participants, then start the first collection round.
              </p>
            )}
          </section>
        </div>

        <div className="ekub-dashboard-grid">
          <section className="card">
            <div className="ekub-card-header">
              <div>
                <h2 className="trading-section-title">Participants</h2>
                <p className="meta">Rotation order and current member state.</p>
              </div>
              <Link href={`/ekub/${group.id}/participants`} className="button-link secondary">
                Manage Participants
              </Link>
            </div>
            <div className="ekub-list">
              {group.participants.map((participant) => (
                <div key={participant.id} className="ekub-list-row">
                  <div>
                    <strong>{participant.name}</strong>
                    <p className="meta">
                      {participant.email || "No email"} · order {participant.rotationOrder ?? "--"}
                    </p>
                  </div>
                  <span className="badge">
                    {participant.status}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2 className="trading-section-title">Past Cycles</h2>
            {pastCycles.length === 0 ? (
              <p className="preview">No previous cycles yet.</p>
            ) : (
              <div className="ekub-list">
                {pastCycles.map((cycle) => (
                  <Link
                    key={cycle.id}
                    href={`/ekub/${group.id}/cycles/${cycle.id}`}
                    className="ekub-list-row ekub-list-link"
                  >
                    <div>
                      <strong>Cycle #{cycle.cycleNumber}</strong>
                      <p className="meta">
                        {new Date(cycle.dueDate).toLocaleDateString()} · recipient{" "}
                        {cycle.payout?.recipient.name || cycle.recipient?.name || "Not assigned"}
                      </p>
                    </div>
                    <span className="badge">{cycle.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
