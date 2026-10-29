import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NotesFormattedTextarea } from "@/app/trading/notes-formatted-textarea";
import Link from "next/link";
import { redirect } from "next/navigation";
import { updatePatentRecord } from "../actions";

function toDateInputValue(value: Date | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

export default async function EditPatentRecordPage({
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
    where: { slug },
  });

  if (!record) {
    return (
      <main>
        <div className="site-shell">
          <div className="card">
            <h1 className="page-title">Patent record not found</h1>
            <Link href="/patents" className="button-link secondary">
              Back to Patents
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const userId = Number(session.user.id);
  const isAdmin = session.user.role === "admin";

  if (!isAdmin && record.authorId !== userId) {
    return (
      <main>
        <div className="site-shell">
          <div className="card">
            <h1 className="page-title">You can&apos;t edit this patent record</h1>
            <p className="form-help">
              Only the record&apos;s author or an admin can make changes here.
            </p>
            <Link href={`/patents/${record.slug}`} className="button-link secondary">
              Back to Record
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">Edit Patent Record</h1>
        <p className="page-subtitle">
          Update the disclosure, correct details, or record the real filing date
          once a provisional has actually been submitted to the USPTO.
        </p>

        <div className="toolbar">
          <Link href={`/patents/${record.slug}`} className="button-link secondary">
            Back to Record
          </Link>
          <Link href="/patents" className="button-link secondary">
            Patent Workspace
          </Link>
        </div>

        <div className="form-card">
          <form action={updatePatentRecord}>
            <input type="hidden" name="id" value={record.id} />

            <div className="trading-grid">
              <div className="form-group">
                <label htmlFor="title" className="form-label">
                  Invention title
                </label>
                <input
                  id="title"
                  name="title"
                  required
                  className="form-input"
                  defaultValue={record.title}
                />
              </div>

              <div className="form-group">
                <label htmlFor="inventorNames" className="form-label">
                  Inventor names
                </label>
                <input
                  id="inventorNames"
                  name="inventorNames"
                  required
                  className="form-input"
                  placeholder="Full legal names of all inventors"
                  defaultValue={record.inventorNames}
                />
              </div>

              <div className="form-group">
                <label htmlFor="publicDisclosureState" className="form-label">
                  Public disclosure state
                </label>
                <select
                  id="publicDisclosureState"
                  name="publicDisclosureState"
                  className="form-select"
                  defaultValue={record.publicDisclosureState}
                >
                  <option>Not publicly disclosed</option>
                  <option>Privately shared only</option>
                  <option>Publicly disclosed</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="provisionalFiledAt" className="form-label">
                  Provisional filed date
                </label>
                <input
                  id="provisionalFiledAt"
                  name="provisionalFiledAt"
                  type="date"
                  className="form-input"
                  defaultValue={toDateInputValue(record.provisionalFiledAt)}
                />
                <p className="form-help">
                  Set or update this once a provisional has actually been filed
                  with the USPTO. The 12-month deadline recalculates from this date.
                </p>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="problem" className="form-label">
                Problem
              </label>
              <NotesFormattedTextarea
                id="problem"
                name="problem"
                rows={7}
                required
                placeholder="What problem does this invention solve and why does it matter?"
                defaultValue={record.problem}
              />
            </div>

            <div className="form-group">
              <label htmlFor="solution" className="form-label">
                Solution
              </label>
              <NotesFormattedTextarea
                id="solution"
                name="solution"
                rows={8}
                required
                placeholder="Describe the invention, how it works, and the core mechanism."
                defaultValue={record.solution}
              />
            </div>

            <div className="form-group">
              <label htmlFor="novelty" className="form-label">
                Novelty / differentiators
              </label>
              <NotesFormattedTextarea
                id="novelty"
                name="novelty"
                rows={7}
                required
                placeholder="What appears new, different, or potentially protectable?"
                defaultValue={record.novelty}
              />
            </div>

            <div className="form-group">
              <label htmlFor="useCases" className="form-label">
                Use cases
              </label>
              <NotesFormattedTextarea
                id="useCases"
                name="useCases"
                rows={6}
                placeholder="Where can this invention be applied?"
                defaultValue={record.useCases ?? ""}
              />
            </div>

            <div className="form-group">
              <label htmlFor="alternatives" className="form-label">
                Alternatives / variations
              </label>
              <NotesFormattedTextarea
                id="alternatives"
                name="alternatives"
                rows={6}
                placeholder="Alternative implementations, embodiments, or edge cases."
                defaultValue={record.alternatives ?? ""}
              />
            </div>

            <div className="form-group">
              <label htmlFor="figureNotes" className="form-label">
                Figure / diagram notes
              </label>
              <NotesFormattedTextarea
                id="figureNotes"
                name="figureNotes"
                rows={6}
                placeholder="Describe diagrams or figures that should be included in a filing packet."
                defaultValue={record.figureNotes ?? ""}
              />
            </div>

            <div className="form-callout">
              <h2 className="form-callout-title">Important</h2>
              <p className="form-callout-text">
                This workspace helps organize disclosure and prep filing materials.
                It does not replace legal advice or submit anything to the USPTO.
              </p>
            </div>

            <button type="submit" className="submit-button">
              Update Patent Record
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
