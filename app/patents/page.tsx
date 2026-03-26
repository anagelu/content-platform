import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

function formatDeadline(deadline: Date | null) {
  if (!deadline) {
    return "No provisional deadline yet";
  }

  const now = new Date();
  const due = new Date(deadline);
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) {
    return `Deadline passed ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} ago`;
  }

  return `${diff} day${diff === 1 ? "" : "s"} until deadline`;
}

export default async function PatentWorkspacePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = Number(session.user.id);
  const records = await prisma.patentRecord.findMany({
    where:
      session.user.role === "admin"
        ? undefined
        : {
            authorId: userId,
          },
    include: {
      author: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">Patent Workspace</h1>
        <p className="page-subtitle">
          Prepare invention disclosures, assemble a provisional-style packet,
          and keep an eye on filing timing without forcing users through the
          entire legal process inside the app.
        </p>

        <div className="toolbar">
          <Link href="/patents/new" className="button-link">
            New Patent Record
          </Link>
          <a
            href="https://www.uspto.gov/patents/apply/patent-center"
            className="button-link secondary"
            target="_blank"
            rel="noreferrer"
          >
            USPTO Patent Center
          </a>
          <Link href="/" className="button-link secondary">
            Home
          </Link>
        </div>

        {records.length === 0 ? (
          <div className="card">
            <p>No patent records yet.</p>
          </div>
        ) : (
          <ul className="card-list">
            {records.map((record) => (
              <li key={record.id} className="card">
                <h2 className="card-title">
                  <Link href={`/patents/${record.slug}`}>{record.title}</Link>
                </h2>
                <p className="meta">
                  Inventors: {record.inventorNames}
                </p>
                <p className="meta">
                  {record.publicDisclosureState} · {formatDeadline(record.provisionalDeadline)}
                </p>
                <p className="meta">
                  By {record.author.name ?? record.author.username}
                </p>
                <p className="preview">{record.novelty}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
