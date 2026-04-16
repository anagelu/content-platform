import { auth } from "@/auth";
import { getParticipantStatusLabel } from "@/lib/ekub";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { addEkubParticipant, removeEkubParticipant, updateEkubParticipant } from "../../actions";
import { EkubParticipantForm } from "../participant-form";

export default async function EkubParticipantsPage({
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
      participants: {
        orderBy: [{ rotationOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!group) {
    notFound();
  }

  if (session.user.role !== "admin" && group.ownerId !== userId) {
    redirect("/ekub");
  }

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">Manage Participants</h1>
        <p className="page-subtitle">
          Add members to <strong>{group.name}</strong>, control whether they are active, and keep the fixed rotation order clean.
        </p>

        <div className="toolbar">
          <Link href={`/ekub/${group.id}`} className="button-link secondary">
            Back to Group
          </Link>
          <Link href="/ekub" className="button-link secondary">
            All Groups
          </Link>
        </div>

        <div className="ekub-dashboard-grid">
          <EkubParticipantForm groupId={group.id} submitAction={addEkubParticipant} />

          <section className="card">
            <h2 className="trading-section-title">Current Member List</h2>
            <div className="ekub-list">
              {group.participants.map((participant) => (
                <div key={participant.id} className="ekub-list-row">
                  <div>
                    <strong>{participant.name}</strong>
                    <p className="meta">
                      {participant.email || "No email"} · {getParticipantStatusLabel(participant.status)}
                    </p>
                  </div>
                  <form action={updateEkubParticipant} className="ekub-inline-form">
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="participantId" value={participant.id} />
                    <input
                      type="number"
                      name="rotationOrder"
                      className="form-input"
                      min="1"
                      step="1"
                      defaultValue={participant.rotationOrder ?? undefined}
                    />
                    <select
                      name="status"
                      className="form-input"
                      defaultValue={participant.status}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                    <button type="submit" className="mini-button">
                      Save
                    </button>
                  </form>
                  <form action={removeEkubParticipant}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="participantId" value={participant.id} />
                    <button type="submit" className="delete-button">
                      Remove
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
