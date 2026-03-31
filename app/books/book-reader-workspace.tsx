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

type ReaderStoryCharacter = {
  id: string;
  name: string;
  role: string;
};

type ReaderStorySetting = {
  id: string;
  name: string;
  purpose: string;
};

type ReaderEntry = {
  id: number;
  label: string;
  title: string;
  kind: string;
  level: "section" | "subsection";
  parentTitle?: string;
  characterCount: number;
  settingCount: number;
};

function parseStringArrayJson(value: string | null | undefined) {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parseStoryCharacters(value: string | null | undefined) {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (item): item is Partial<ReaderStoryCharacter> =>
              Boolean(item) && typeof item === "object",
          )
          .map((item) => ({
            id: typeof item.id === "string" ? item.id : "",
            name: typeof item.name === "string" ? item.name : "",
            role: typeof item.role === "string" ? item.role : "",
          }))
          .filter((item) => item.id)
      : [];
  } catch {
    return [];
  }
}

function parseStorySettings(value: string | null | undefined) {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (item): item is Partial<ReaderStorySetting> =>
              Boolean(item) && typeof item === "object",
          )
          .map((item) => ({
            id: typeof item.id === "string" ? item.id : "",
            name: typeof item.name === "string" ? item.name : "",
            purpose: typeof item.purpose === "string" ? item.purpose : "",
          }))
          .filter((item) => item.id)
      : [];
  } catch {
    return [];
  }
}

function buildReaderEntries(sections: ReaderSection[]): ReaderEntry[] {
  return sections.flatMap((section, index) => [
    {
      id: section.id,
      label: `${index + 1}`,
      title: section.title,
      kind: section.kind,
      level: "section" as const,
      characterCount: parseStringArrayJson(section.characterIdsJson).length,
      settingCount: parseStringArrayJson(section.settingIdsJson).length,
    },
    ...section.subsections.map((subsection, childIndex) => ({
      id: subsection.id,
      label: `${index + 1}.${childIndex + 1}`,
      title: subsection.title,
      kind: subsection.kind,
      level: "subsection" as const,
      parentTitle: section.title,
      characterCount: parseStringArrayJson(subsection.characterIdsJson).length,
      settingCount: parseStringArrayJson(subsection.settingIdsJson).length,
    })),
  ]);
}

function resolveSectionContext(
  item: Pick<
    ReaderSection,
    "characterIdsJson" | "settingIdsJson" | "povCharacterId" | "sceneGoal" | "sceneConflict"
  >,
  characters: ReaderStoryCharacter[],
  settings: ReaderStorySetting[],
) {
  const characterIds = parseStringArrayJson(item.characterIdsJson);
  const settingIds = parseStringArrayJson(item.settingIdsJson);

  return {
    characters: characters.filter((character) => characterIds.includes(character.id)),
    settings: settings.filter((setting) => settingIds.includes(setting.id)),
    povCharacter:
      characters.find((character) => character.id === (item.povCharacterId || "")) || null,
    sceneGoal: item.sceneGoal?.trim() || "",
    sceneConflict: item.sceneConflict?.trim() || "",
  };
}

export function BookReaderWorkspace({
  outline,
  sections,
  characterProfilesJson,
  settingProfilesJson,
}: {
  outline: string | null;
  sections: ReaderSection[];
  characterProfilesJson?: string | null;
  settingProfilesJson?: string | null;
}) {
  const storyCharacters = useMemo(
    () => parseStoryCharacters(characterProfilesJson),
    [characterProfilesJson],
  );
  const storySettings = useMemo(
    () => parseStorySettings(settingProfilesJson),
    [settingProfilesJson],
  );
  const entries = useMemo(() => buildReaderEntries(sections), [sections]);
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
            <h2 className="trading-section-title">Outline</h2>
            <p className="meta">
              Hover to preview more, click to pin open, and move sequentially with the reader controls.
            </p>
          </div>
          <div className="book-reader-outline-meta">
            <strong>{entries.length}</strong>
            <span>readable stops</span>
          </div>
        </div>
        {outline ? <pre className="book-outline-preview">{outline}</pre> : null}
        {(storyCharacters.length > 0 || storySettings.length > 0) ? (
          <div className="book-reader-story-bible">
            <div className="book-reader-story-bible-card">
              <span className="book-editor-status-kicker">Cast</span>
              <strong>{storyCharacters.length}</strong>
              <p className="meta">
                {storyCharacters
                  .slice(0, 3)
                  .map((character) => character.name || "Untitled character")
                  .join(", ") || "No character names yet."}
              </p>
            </div>
            <div className="book-reader-story-bible-card">
              <span className="book-editor-status-kicker">World</span>
              <strong>{storySettings.length}</strong>
              <p className="meta">
                {storySettings
                  .slice(0, 3)
                  .map((setting) => setting.name || "Untitled setting")
                  .join(", ") || "No settings yet."}
              </p>
            </div>
          </div>
        ) : null}
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
                  {index + 1}. {section.kind}
                </span>
                <strong>{section.title}</strong>
                {parseStringArrayJson(section.characterIdsJson).length > 0 ||
                parseStringArrayJson(section.settingIdsJson).length > 0 ? (
                  <small className="book-reader-nav-meta">
                    {parseStringArrayJson(section.characterIdsJson).length > 0
                      ? `${parseStringArrayJson(section.characterIdsJson).length} characters`
                      : "No cast"}
                    {" · "}
                    {parseStringArrayJson(section.settingIdsJson).length > 0
                      ? `${parseStringArrayJson(section.settingIdsJson).length} settings`
                      : "No setting"}
                  </small>
                ) : null}
              </button>

              {section.subsections.map((subsection, childIndex) => (
                <button
                  key={subsection.id}
                  type="button"
                  onClick={() => focusEntry(subsection.id, true)}
                  className={
                    activeEntryId === subsection.id
                      ? "book-reader-nav-link book-reader-subnav-link is-active"
                      : "book-reader-nav-link book-reader-subnav-link"
                  }
                >
                  <span>
                    {index + 1}.{childIndex + 1} {subsection.kind}
                  </span>
                  <strong>{subsection.title}</strong>
                  {parseStringArrayJson(subsection.characterIdsJson).length > 0 ||
                  parseStringArrayJson(subsection.settingIdsJson).length > 0 ? (
                    <small className="book-reader-nav-meta">
                      {parseStringArrayJson(subsection.characterIdsJson).length > 0
                        ? `${parseStringArrayJson(subsection.characterIdsJson).length} characters`
                        : "No cast"}
                      {" · "}
                      {parseStringArrayJson(subsection.settingIdsJson).length > 0
                        ? `${parseStringArrayJson(subsection.settingIdsJson).length} settings`
                        : "No setting"}
                    </small>
                  ) : null}
                </button>
              ))}
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
          const sectionContext = resolveSectionContext(
            section,
            storyCharacters,
            storySettings,
          );
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
              {sectionContext.characters.length > 0 ||
              sectionContext.settings.length > 0 ||
              sectionContext.povCharacter ||
              sectionContext.sceneGoal ||
              sectionContext.sceneConflict ? (
                <div className="book-reader-context-band">
                  {sectionContext.povCharacter ? (
                    <div className="book-reader-context-card">
                      <span className="book-editor-status-kicker">POV</span>
                      <strong>{sectionContext.povCharacter.name || "Unnamed POV"}</strong>
                      <p className="meta">{sectionContext.povCharacter.role || "Character focus"}</p>
                    </div>
                  ) : null}
                  {sectionContext.sceneGoal ? (
                    <div className="book-reader-context-card">
                      <span className="book-editor-status-kicker">Scene Goal</span>
                      <strong>{sectionContext.sceneGoal}</strong>
                    </div>
                  ) : null}
                  {sectionContext.sceneConflict ? (
                    <div className="book-reader-context-card">
                      <span className="book-editor-status-kicker">Conflict</span>
                      <strong>{sectionContext.sceneConflict}</strong>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {sectionContext.characters.length > 0 || sectionContext.settings.length > 0 ? (
                <div className="book-reader-chip-row">
                  {sectionContext.characters.map((character) => (
                    <span key={character.id} className="book-reader-chip">
                      {character.name || "Untitled character"}
                    </span>
                  ))}
                  {sectionContext.settings.map((setting) => (
                    <span key={setting.id} className="book-reader-chip book-reader-chip-setting">
                      {setting.name || "Untitled setting"}
                    </span>
                  ))}
                </div>
              ) : null}
              {section.summary ? <p className="preview book-reader-summary">{section.summary}</p> : null}
              <div className="markdown book-reader-panel-body book-reader-prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {section.content || "No content yet."}
                </ReactMarkdown>
              </div>

              {section.subsections.length > 0 ? (
                <div className="book-subsection-stack">
                  {section.subsections.map((subsection, childIndex) => {
                    const subsectionContext = resolveSectionContext(
                      subsection,
                      storyCharacters,
                      storySettings,
                    );
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
                        {subsectionContext.characters.length > 0 ||
                        subsectionContext.settings.length > 0 ||
                        subsectionContext.povCharacter ||
                        subsectionContext.sceneGoal ||
                        subsectionContext.sceneConflict ? (
                          <div className="book-reader-context-band">
                            {subsectionContext.povCharacter ? (
                              <div className="book-reader-context-card">
                                <span className="book-editor-status-kicker">POV</span>
                                <strong>
                                  {subsectionContext.povCharacter.name || "Unnamed POV"}
                                </strong>
                                <p className="meta">
                                  {subsectionContext.povCharacter.role || "Character focus"}
                                </p>
                              </div>
                            ) : null}
                            {subsectionContext.sceneGoal ? (
                              <div className="book-reader-context-card">
                                <span className="book-editor-status-kicker">Scene Goal</span>
                                <strong>{subsectionContext.sceneGoal}</strong>
                              </div>
                            ) : null}
                            {subsectionContext.sceneConflict ? (
                              <div className="book-reader-context-card">
                                <span className="book-editor-status-kicker">Conflict</span>
                                <strong>{subsectionContext.sceneConflict}</strong>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {subsectionContext.characters.length > 0 ||
                        subsectionContext.settings.length > 0 ? (
                          <div className="book-reader-chip-row">
                            {subsectionContext.characters.map((character) => (
                              <span key={character.id} className="book-reader-chip">
                                {character.name || "Untitled character"}
                              </span>
                            ))}
                            {subsectionContext.settings.map((setting) => (
                              <span
                                key={setting.id}
                                className="book-reader-chip book-reader-chip-setting"
                              >
                                {setting.name || "Untitled setting"}
                              </span>
                            ))}
                          </div>
                        ) : null}
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
