"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ReaderSubsection = {
  id: number;
  kind: string;
  title: string;
  summary: string | null;
  content: string;
};

type ReaderSection = {
  id: number;
  kind: string;
  title: string;
  summary: string | null;
  content: string;
  subsections: ReaderSubsection[];
};

type ReaderEntry = {
  id: number;
  label: string;
  title: string;
  kind: string;
  level: "section" | "subsection";
  parentId?: number;
  parentTitle?: string;
};

function buildReaderEntries(sections: ReaderSection[]): ReaderEntry[] {
  return sections.flatMap((section, index) => [
    {
      id: section.id,
      label: `${index + 1}`,
      title: section.title,
      kind: section.kind,
      level: "section" as const,
    },
    ...section.subsections.map((subsection, childIndex) => ({
      id: subsection.id,
      label: `${index + 1}.${childIndex + 1}`,
      title: subsection.title,
      kind: subsection.kind,
      level: "subsection" as const,
      parentId: section.id,
      parentTitle: section.title,
    })),
  ]);
}

export function BookReaderWorkspace({
  outline,
  sections,
}: {
  outline: string | null;
  sections: ReaderSection[];
  characterProfilesJson?: string | null;
  settingProfilesJson?: string | null;
}) {
  const entries = useMemo(() => buildReaderEntries(sections), [sections]);
  const [activeEntryId, setActiveEntryId] = useState<number | null>(entries[0]?.id ?? null);
  const [isOutlineOpen, setIsOutlineOpen] = useState(true);

  const activeEntry = entries.find((entry) => entry.id === activeEntryId) ?? entries[0] ?? null;
  const activeSection = sections.find(
    (section) => section.id === activeEntry?.id || section.id === activeEntry?.parentId,
  ) ?? sections[0] ?? null;
  const activeSubsection =
    activeEntry?.level === "subsection"
      ? activeSection?.subsections.find((subsection) => subsection.id === activeEntry.id) ?? null
      : null;

  const activeIndex = entries.findIndex((entry) => entry.id === activeEntry?.id);
  const previousEntry = activeIndex > 0 ? entries[activeIndex - 1] : null;
  const nextEntry = activeIndex >= 0 && activeIndex < entries.length - 1 ? entries[activeIndex + 1] : null;

  function closeOutline() {
    setIsOutlineOpen(false);
  }

  function focusEntry(id: number) {
    setActiveEntryId(id);
    closeOutline();
    window.requestAnimationFrame(() => {
      document.getElementById("book-reader-surface")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <section className="book-reader-shell">
      <div className="book-reader-stage">
        <aside className={isOutlineOpen ? "book-reader-overlay is-open" : "book-reader-overlay"}>
          <div className="book-reader-overlay-backdrop" onClick={closeOutline} />
          <div className="book-reader-overlay-panel">
            <div className="book-reader-overlay-header">
              <div>
                <p className="book-reader-overlay-kicker">Outline</p>
                <h2 className="trading-section-title">Reading Path</h2>
                <p className="meta">
                  Choose a chapter or subsection, then let the manuscript take over the page.
                </p>
              </div>
              <button
                type="button"
                className="mini-button"
                onClick={closeOutline}
              >
                Close
              </button>
            </div>

            {outline ? (
              <div className="book-reader-outline-note">
                <p className="book-reader-outline-note-label">Story Frame</p>
                <p>{outline}</p>
              </div>
            ) : null}

            <div className="book-reader-overlay-nav">
              {sections.map((section, index) => (
                <div key={section.id} className="book-reader-overlay-group">
                  <button
                    type="button"
                    className={
                      activeEntry?.id === section.id
                        ? "book-reader-overlay-link is-active"
                        : "book-reader-overlay-link"
                    }
                    onClick={() => focusEntry(section.id)}
                  >
                    <span>Chapter {index + 1}</span>
                    <strong>{section.title}</strong>
                  </button>
                  {section.subsections.length > 0 ? (
                    <div className="book-reader-overlay-subnav">
                      {section.subsections.map((subsection, childIndex) => (
                        <button
                          key={subsection.id}
                          type="button"
                          className={
                            activeEntry?.id === subsection.id
                              ? "book-reader-overlay-sublink is-active"
                              : "book-reader-overlay-sublink"
                          }
                          onClick={() => focusEntry(subsection.id)}
                        >
                          <span>{index + 1}.{childIndex + 1}</span>
                          <strong>{subsection.title}</strong>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div
          id="book-reader-surface"
          className="book-reader-window"
          onPointerDown={() => {
            if (isOutlineOpen) closeOutline();
          }}
        >
          <div className="book-reader-toolbar">
              <button
                type="button"
                className="button-link secondary"
                onClick={() => setIsOutlineOpen((current) => !current)}
              >
                {isOutlineOpen ? "Hide Outline" : "Show Outline"}
              </button>
            <button
              type="button"
              className="button-link"
              onClick={() => {
                if (entries[0]) {
                  focusEntry(entries[0].id);
                }
              }}
            >
              Start Reading
            </button>
            <div className="book-reader-sequence-actions">
              <button
                type="button"
                className="button-link secondary"
                onClick={() => previousEntry && focusEntry(previousEntry.id)}
                disabled={!previousEntry}
              >
                Previous
              </button>
              <button
                type="button"
                className="button-link secondary"
                onClick={() => nextEntry && focusEntry(nextEntry.id)}
                disabled={!nextEntry}
              >
                Next
              </button>
            </div>
          </div>

          <article className="book-reader-page">
            <header className="book-reader-page-header">
              <div>
                <p className="book-reader-page-kicker">
                  {activeEntry?.level === "subsection"
                    ? `${activeEntry.label} · ${activeEntry.kind}`
                    : `Chapter ${activeEntry?.label ?? "1"} · ${activeEntry?.kind ?? "Section"}`}
                </p>
                <h2 className="book-reader-page-title">{activeEntry?.title ?? activeSection?.title ?? "Begin reading"}</h2>
                <button
                  type="button"
                  className="book-reader-title-hitbox"
                  onClick={closeOutline}
                  aria-label="Keep reading and hide outline"
                >
                  Keep Reading
                </button>
                {activeEntry?.parentTitle ? (
                  <p className="book-reader-page-context">From {activeEntry.parentTitle}</p>
                ) : null}
              </div>
              <div className="book-reader-page-meta">
                <strong>
                  {activeIndex >= 0 ? `${activeIndex + 1} of ${entries.length}` : `0 of ${entries.length}`}
                </strong>
                <span>reading position</span>
              </div>
            </header>

            {activeSubsection ? (
              <div className="book-reader-manuscript">
                {activeSubsection.summary ? (
                  <div className="book-reader-summary-callout">
                    <p className="book-reader-summary-label">Section Summary</p>
                    <p className="book-reader-lead">{activeSubsection.summary}</p>
                  </div>
                ) : null}
                <div className="markdown book-reader-prose">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {activeSubsection.content || "No content yet."}
                  </ReactMarkdown>
                </div>
              </div>
            ) : activeSection ? (
              <div className="book-reader-manuscript">
                {activeSection.summary ? (
                  <div className="book-reader-summary-callout">
                    <p className="book-reader-summary-label">Section Summary</p>
                    <p className="book-reader-lead">{activeSection.summary}</p>
                  </div>
                ) : null}
                <div className="markdown book-reader-prose">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {activeSection.content || "No content yet."}
                  </ReactMarkdown>
                </div>
                {activeSection.subsections.length > 0 ? (
                  <div className="book-reader-subsections">
                    {activeSection.subsections.map((subsection, index) => (
                      <section key={subsection.id} className="book-reader-subsection-block">
                        <p className="book-reader-page-kicker">
                          {activeEntry?.label ?? "1"}.{index + 1} · {subsection.kind}
                        </p>
                        <h3 className="book-reader-subsection-title">{subsection.title}</h3>
                        {subsection.summary ? (
                          <div className="book-reader-summary-callout is-subsection">
                            <p className="book-reader-summary-label">Subsection Summary</p>
                            <p className="book-reader-subsection-summary">{subsection.summary}</p>
                          </div>
                        ) : null}
                        <div className="markdown book-reader-prose">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {subsection.content || "No content yet."}
                          </ReactMarkdown>
                        </div>
                      </section>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </article>
        </div>
      </div>
    </section>
  );
}
