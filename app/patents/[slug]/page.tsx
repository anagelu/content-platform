import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

function formatDate(value: Date | null) {
  return value ? new Date(value).toLocaleDateString() : "Not set";
}

export default async function PatentRecordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { slug } = await params;

  const record = await prisma.patentRecord.findUnique({
    where: {
      slug,
    },
    include: {
      author: true,
    },
  });

  if (!record) {
    return (
      <main>
        <div className="site-shell">
          <div className="card">
            <h2 className="page-title">Patent record not found</h2>
            <Link href="/patents" className="button-link secondary">
              Back to Patents
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const canView =
    session.user.role === "admin" || session.user.id === String(record.authorId);

  if (!canView) {
    redirect("/patents");
  }

  return (
    <main>
      <div className="site-shell">
        <article className="article-card">
          <h1 className="article-title">{record.title}</h1>
          <p className="meta">
            Inventors: {record.inventorNames}
          </p>
          <p className="meta">
            Disclosure status: {record.publicDisclosureState}
          </p>
          <p className="meta">
            Provisional filed: {formatDate(record.provisionalFiledAt)}
          </p>
          <p className="meta" style={{ fontWeight: 600 }}>
            Provisional deadline: {formatDate(record.provisionalDeadline)}
          </p>

          <div className="trading-detail-grid">
            <section className="card">
              <h2 className="trading-section-title">Problem</h2>
              <p>{record.problem}</p>
            </section>

            <section className="card">
              <h2 className="trading-section-title">Solution</h2>
              <p>{record.solution}</p>
            </section>
          </div>

          <div className="trading-detail-grid">
            <section className="card">
              <h2 className="trading-section-title">Novelty</h2>
              <p>{record.novelty}</p>
            </section>

            <section className="card">
              <h2 className="trading-section-title">Use Cases</h2>
              <p>{record.useCases || "No use cases captured yet."}</p>
            </section>
          </div>

          <div className="trading-detail-grid">
            <section className="card">
              <h2 className="trading-section-title">Alternatives</h2>
              <p>{record.alternatives || "No alternatives captured yet."}</p>
            </section>

            <section className="card">
              <h2 className="trading-section-title">Figure Notes</h2>
              <p>{record.figureNotes || "No figure notes captured yet."}</p>
            </section>
          </div>

          <section className="card">
            <h2 className="trading-section-title">Provisional Packet Draft</h2>
            <pre className="trading-source-chat">{record.packetBody}</pre>
          </section>

          <div className="form-callout" style={{ marginTop: "1.5rem" }}>
            <h2 className="form-callout-title">USPTO Filing Reminder</h2>
            <p className="form-callout-text">
              Patent Center is the USPTO filing system, and provisional applications last 12 months.
              This workspace is prep support, not legal advice or filing automation.
            </p>
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <a
                href="https://www.uspto.gov/patents/apply/patent-center"
                className="button-link secondary"
                target="_blank"
                rel="noreferrer"
              >
                Open Patent Center
              </a>
            </div>
          </div>

          <div className="toolbar">
            <Link href="/patents" className="button-link secondary">
              Back to Patent Workspace
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
