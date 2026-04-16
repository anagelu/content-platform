import { auth } from "@/auth";
import { calculatePotSize, getActiveParticipants, getCycleFrequencyLabel, getPayoutMethodLabel } from "@/lib/ekub";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function EkubPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = Number(session.user.id);
  const groups = await prisma.ekubGroup.findMany({
    where:
      session.user.role === "admin"
        ? undefined
        : {
            ownerId: userId,
          },
    include: {
      participants: {
        orderBy: [{ rotationOrder: "asc" }, { createdAt: "asc" }],
      },
      cycles: {
        include: {
          payout: true,
        },
        orderBy: { cycleNumber: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <section className="section-command-surface">
          <div className="section-command-main">
            <p className="home-hero-kicker">Community Pools</p>
            <h1 className="page-title">Run small Ekub groups with simple cycle tracking.</h1>
            <p className="page-subtitle">
              Create a group, add members, open cycles, collect contributions, and record payouts without introducing blockchain complexity yet.
            </p>
            <div className="section-command-strip">
              <Link href="/ekub/new" className="section-command-link is-accent">
                <strong>Create Group</strong>
                <span>Start a new cycle pool</span>
              </Link>
              <Link href="/" className="section-command-link">
                <strong>Home</strong>
                <span>Return to hub</span>
              </Link>
            </div>
          </div>

          <div className="section-command-panel">
            <p className="home-hero-panel-label">Ekub Status</p>
            <div className="home-command-metrics">
              <div>
                <span>Groups</span>
                <strong>{groups.length}</strong>
              </div>
              <div>
                <span>Active members</span>
                <strong>
                  {groups.reduce((sum, group) => sum + getActiveParticipants(group.participants).length, 0)}
                </strong>
              </div>
              <div>
                <span>Open cycles</span>
                <strong>
                  {groups.reduce(
                    (sum, group) => sum + group.cycles.filter((cycle) => cycle.status !== "COMPLETED").length,
                    0,
                  )}
                </strong>
              </div>
            </div>
          </div>
        </section>

        {groups.length === 0 ? (
          <div className="card">
            <p className="preview">
              No Ekub groups yet. Create the first group and start with a small circle.
            </p>
          </div>
        ) : (
          <div className="ekub-card-grid">
            {groups.map((group) => {
              const activeParticipants = getActiveParticipants(group.participants);
              const currentCycle =
                group.cycles.find((cycle) => cycle.status !== "COMPLETED") ?? group.cycles[0] ?? null;
              const potSize = calculatePotSize(group.contributionAmount, activeParticipants.length);

              return (
                <article key={group.id} className="card ekub-group-card">
                  <div className="ekub-card-header">
                    <div>
                      <p className="home-preview-kicker">Ekub Group</p>
                      <h2 className="card-title">
                        <Link href={`/ekub/${group.id}`}>{group.name}</Link>
                      </h2>
                    </div>
                    <span className="badge">
                      {getPayoutMethodLabel(group.payoutMethod)}
                    </span>
                  </div>
                  {group.description ? <p className="preview">{group.description}</p> : null}
                  <p className="meta">
                    {group.contributionAmount.toFixed(2)} contribution ·{" "}
                    {getCycleFrequencyLabel(group.cycleFrequency)} · max {group.maxParticipants}
                  </p>
                  <div className="ekub-metric-grid">
                    <div>
                      <span>Active Participants</span>
                      <strong>{activeParticipants.length}</strong>
                    </div>
                    <div>
                      <span>Pot Size</span>
                      <strong>{potSize.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span>Current Cycle</span>
                      <strong>{currentCycle ? `#${currentCycle.cycleNumber}` : "None"}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>{currentCycle?.status ?? "Not started"}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
