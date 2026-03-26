import { auth } from "@/auth";
import { NotesFormattedTextarea } from "@/app/trading/notes-formatted-textarea";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createPatentRecord } from "./actions";

export default async function NewPatentRecordPage({
  searchParams,
}: {
  searchParams?: Promise<{
    idea?: string;
  }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const seededIdea = params?.idea?.trim() || "";

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">New Patent Record</h1>
        <p className="page-subtitle">
          Capture the invention clearly, generate a provisional-style disclosure
          packet, and track the deadline if a provisional has already been filed.
        </p>

        <div className="toolbar">
          <Link href="/patents" className="button-link secondary">
            Patent Workspace
          </Link>
          <Link href="/" className="button-link secondary">
            Home
          </Link>
        </div>

        <div className="form-card">
          <form action={createPatentRecord}>
            <div className="trading-grid">
              <div className="form-group">
                <label htmlFor="title" className="form-label">
                  Invention title
                </label>
                <input id="title" name="title" required className="form-input" />
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
                />
                <p className="form-help">
                  Optional. If entered, the workspace will track the 12-month provisional deadline.
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
                defaultValue={seededIdea}
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
              Save Patent Record
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
