"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ReaderSubsection = {
  id: number;
  kind: string;
  title: string;
  summary: string | null;
  content: string;
  characterIdsJson?: string | null;
  settingIdsJson?: string | null;
  sceneGoal?: string | null;
  sceneConflict?: string | null;
  povCharacterId?: string | null;
};

type ReaderSection = {
  id: number;
  kind: string;
  title: string;
  summary: string | null;
  content: string;
  characterIdsJson?: string | null;
  settingIdsJson?: string | null;
  sceneGoal?: string | null;
  sceneConflict?: string | null;
  povCharacterId?: string | null;
  subsections: ReaderSubsection[];
};

type ReaderEntry = {
  id: number;
  label: string;
  title: string;
  kind: string;
  level: "section" | "subsection";
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
      parentTitle: section.title,
    })),
  ]);
}

export function BookReaderWorkspace({
  sections,
}: {
  outline: string | null;
  sections: ReaderSection[];
  characterProfilesJson?: string | null;
  settingProfilesJson?: string | null;
}) {
  const entries = buildReaderEntries(sections);
  const [activeEntryId, setActiveEntryId] = useState<number | null>(entries[0]?.id ?? null);
  const [hoveredEntryId, setHoveredEntryId] = useState<number | null>(null);
  const [pinnedEntryIds, setPinnedEntryIds] = useState<number[]>(() =>
    entries[0] ? [entries[0].id] : [],
  );

  function focusEntry(id: number, pin = false) {
    setActiveEntryId(id);

    if (pin) {
      setPinnedEntryIds((current) => (current.includes(id) ? current : [...current, id]));
    }

    const target = document.getElementById(`section-${id}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function togglePinned(id: number) {
    setActiveEntryId(id);
    setPinnedEntryIds((current) =>
      current.includes(id) ? current.filter((entryId) => entryId !== id) : [...current, id],
    );
  }

  const activeIndex = entries.findIndex((entry) => entry.id === activeEntryId);
  const previousEntry = activeIndex > 0 ? entries[activeIndex - 1] : null;
  const nextEntry = activeIndex >= 0 && activeIndex < entries.length - 1 ? entries[activeIndex + 1] : null;

  return (
    <section className="book-reader-layout">
      <aside className="book-reader-outline">
        <div className="book-reader-outline-header">
          <div>
            <h2 className="trading-section-title">Chapters</h2>
            <p className="meta">
              Move chapter to chapter from the left rail, then use reader controls to step through the active manuscript path.
            </p>
          </div>
          <div className="book-reader-outline-meta">
            <strong>{sections.length}</strong>
            <span>chapters</span>
          </div>
        </div>
        <div className="book-reader-nav">
          {sections.map((section, index) => (
            <div key={section.id} className="book-reader-nav-group">
              <button
                type="button"
                onClick={() => focusEntry(section.id, true)}
                className={
                  activeEntryId === section.id
                    ? "book-reader-nav-link is-active"
                    : "book-reader-nav-link"
                }
                >
                  <span>
                    Chapter {index + 1}
                  </span>
                  <strong>{section.title}</strong>
                </button>
              {section.subsections.length > 0 ? (
                <p className="book-reader-nav-meta">
                  {section.subsections.length} section{section.subsections.length === 1 ? "" : "s"} inside this chapter
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </aside>

      <div className="book-reader-content">
        <div className="book-reader-sequence-bar">
          <div className="book-reader-sequence-copy">
            <span className="book-editor-status-kicker">Reader Position</span>
            <strong>
              {activeIndex >= 0 ? `${activeIndex + 1} of ${entries.length}` : `0 of ${entries.length}`}
            </strong>
            <p className="book-reader-sequence-note">
              Follow the manuscript in order or jump to a different stop from the outline.
            </p>
          </div>
          <div className="book-reader-sequence-actions">
            <button
              type="button"
              className="button-link secondary"
              onClick={() => previousEntry && focusEntry(previousEntry.id, true)}
              disabled={!previousEntry}
            >
              Previous
            </button>
            <button
              type="button"
              className="button-link secondary"
              onClick={() => nextEntry && focusEntry(nextEntry.id, true)}
              disabled={!nextEntry}
            >
              Next
            </button>
          </div>
        </div>

        {sections.map((section, index) => {
          const sectionExpanded =
            activeEntryId === section.id ||
            hoveredEntryId === section.id ||
            pinnedEntryIds.includes(section.id);

          return (
            <section
              key={section.id}
              id={`section-${section.id}`}
              className={sectionExpanded ? "book-reader-panel is-expanded" : "book-reader-panel"}
              onMouseEnter={() => {
                setHoveredEntryId(section.id);
                setActiveEntryId(section.id);
              }}
              onMouseLeave={() => setHoveredEntryId((current) => (current === section.id ? null : current))}
            >
              <div className="book-reader-folio">
                <span>Folio {index + 1}</span>
                <span>{section.kind}</span>
              </div>
              <div className="book-reader-panel-header">
                <div>
                  <p className="meta book-reader-label">
                    Section {index + 1} · {section.kind}
                  </p>
                  <h2 className="card-title book-reader-entry-title">{section.title}</h2>
                </div>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => togglePinned(section.id)}
                >
                  {pinnedEntryIds.includes(section.id) ? "Collapse" : "Pin Open"}
                </button>
              </div>
              {section.summary ? <p className="preview book-reader-summary">{section.summary}</p> : null}
              <div className="markdown book-reader-panel-body book-reader-prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {section.content || "No content yet."}
                </ReactMarkdown>
              </div>

              {section.subsections.length > 0 ? (
                <div className="book-subsection-stack">
                  {section.subsections.map((subsection, childIndex) => {
                    const subsectionExpanded =
                      activeEntryId === subsection.id ||
                      hoveredEntryId === subsection.id ||
                      pinnedEntryIds.includes(subsection.id);

                    return (
                      <section
                        key={subsection.id}
                        id={`section-${subsection.id}`}
                        className={
                          subsectionExpanded
                            ? "book-subsection-card book-reader-panel is-expanded"
                            : "book-subsection-card book-reader-panel"
                        }
                        onMouseEnter={() => {
                          setHoveredEntryId(subsection.id);
                          setActiveEntryId(subsection.id);
                        }}
                        onMouseLeave={() =>
                          setHoveredEntryId((current) => (current === subsection.id ? null : current))
                        }
                      >
                        <div className="book-reader-folio book-reader-folio-subsection">
                          <span>Folio {index + 1}.{childIndex + 1}</span>
                          <span>{subsection.kind}</span>
                        </div>
                        <div className="book-reader-panel-header">
                          <div>
                            <p className="meta book-reader-label">
                              Subsection {index + 1}.{childIndex + 1} · {subsection.kind}
                            </p>
                            <h3 className="card-title book-reader-entry-title">{subsection.title}</h3>
                          </div>
                          <button
                            type="button"
                            className="mini-button"
                            onClick={() => togglePinned(subsection.id)}
                          >
                            {pinnedEntryIds.includes(subsection.id) ? "Collapse" : "Pin Open"}
                          </button>
                        </div>
                        {subsection.summary ? (
                          <p className="preview book-reader-summary">{subsection.summary}</p>
                        ) : null}
                        <div className="markdown book-reader-panel-body book-reader-prose">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {subsection.content || "No content yet."}
                          </ReactMarkdown>
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </section>
  );
}
