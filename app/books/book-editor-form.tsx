"use client";

import { useEffect, useMemo, useState } from "react";
import { consumeHomeIdeaTransfer } from "@/lib/home-idea-transfer";
import {
  BOOK_SECTION_KIND_OPTIONS,
  BOOK_SUBSECTION_KIND_OPTIONS,
  buildBookOutline,
  createBookSectionDraft,
  createStoryCharacterDraft,
  createStorySettingDraft,
  findSectionById,
  insertSubsection,
  moveSectionWithinSiblings,
  removeSectionTree,
  updateSectionTree,
  type BookSectionDraft,
  type StoryCharacterDraft,
  type StorySettingDraft,
} from "@/lib/books";

type InitialBookSection = {
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
  subsections?: InitialBookSection[];
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

type BookEditorFormProps = {
  mode: "create" | "edit";
  submitAction: (formData: FormData) => void | Promise<void>;
  aiDraftEnabled: boolean;
  aiProviderLabel: string;
  aiTierLabel: string;
  initialBook?: {
    id: number;
    title: string;
    bookType: string;
    isPublic: boolean;
    targetLength: string | null;
    audience: string | null;
    tone: string | null;
    summary: string | null;
    outline: string | null;
    sourceDraft: string;
    authorNotes: string | null;
    storySynopsis: string | null;
    storyChapterCount: number | null;
    storyStructureNotes: string | null;
    characterProfilesJson: string | null;
    settingProfilesJson: string | null;
    sections: InitialBookSection[];
  };
  initialSeedSourceDraft?: string;
};

function hydrateSections(sections: InitialBookSection[]) {
  return sections.map((section) =>
    createBookSectionDraft({
      id: String(section.id),
      kind: section.kind,
      title: section.title,
      summary: section.summary || "",
      content: section.content,
      characterIds: parseStringArrayJson(section.characterIdsJson),
      settingIds: parseStringArrayJson(section.settingIdsJson),
      sceneGoal: section.sceneGoal || "",
      sceneConflict: section.sceneConflict || "",
      povCharacterId: section.povCharacterId || "",
      children: (section.subsections || []).map((child) =>
        createBookSectionDraft({
          id: String(child.id),
          kind: child.kind,
          title: child.title,
          summary: child.summary || "",
          content: child.content,
          characterIds: parseStringArrayJson(child.characterIdsJson),
          settingIds: parseStringArrayJson(child.settingIdsJson),
          sceneGoal: child.sceneGoal || "",
          sceneConflict: child.sceneConflict || "",
          povCharacterId: child.povCharacterId || "",
        }),
      ),
    }),
  );
}

function findParentSection(
  sections: BookSectionDraft[],
  childId: string,
): BookSectionDraft | null {
  for (const section of sections) {
    if (section.children.some((child) => child.id === childId)) {
      return section;
    }
  }

  return null;
}

function countSections(items: BookSectionDraft[]) {
  return items.reduce(
    (totals, section) => ({
      topLevel: totals.topLevel + 1,
      subsections: totals.subsections + section.children.length,
    }),
    { topLevel: 0, subsections: 0 },
  );
}

function countWords(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

function countStructuredProgress(items: BookSectionDraft[]) {
  const flattened = items.flatMap((section) => [section, ...section.children]);

  if (flattened.length === 0) {
    return 0;
  }

  const completed = flattened.filter(
    (section) =>
      section.title.trim() &&
      (section.summary.trim().length > 0 || section.content.trim().length > 0),
  ).length;

  return completed / flattened.length;
}

function inferStoryMode(bookType: string, initialBook?: BookEditorFormProps["initialBook"]) {
  if (
    initialBook?.storySynopsis ||
    initialBook?.storyStructureNotes ||
    initialBook?.characterProfilesJson ||
    initialBook?.settingProfilesJson
  ) {
    return true;
  }

  return /novel|story|fiction|novella|fantasy|romance|thriller/i.test(bookType);
}

function hydrateStoryCharacters(value: string | null | undefined) {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as Partial<StoryCharacterDraft>[];
    return Array.isArray(parsed) ? parsed.map((item) => createStoryCharacterDraft(item)) : [];
  } catch {
    return [];
  }
}

function hydrateStorySettings(value: string | null | undefined) {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as Partial<StorySettingDraft>[];
    return Array.isArray(parsed) ? parsed.map((item) => createStorySettingDraft(item)) : [];
  } catch {
    return [];
  }
}

export function BookEditorForm({
  mode,
  submitAction,
  aiDraftEnabled,
  aiProviderLabel,
  aiTierLabel,
  initialBook,
  initialSeedSourceDraft = "",
}: BookEditorFormProps) {
  const initialSections =
    initialBook?.sections?.length
      ? hydrateSections(initialBook.sections)
      : [
          createBookSectionDraft({
            kind: "Introduction",
            title: "Introduction",
            summary: "Open with the promise, context, and reader payoff.",
          }),
          createBookSectionDraft({
            kind: "Chapter",
            title: "Chapter 1",
            summary: "Develop the first major idea in this chapter.",
            children: [
              createBookSectionDraft({
                kind: "Subsection",
                title: "Section 1.1",
                summary: "Break the chapter into a focused subsection.",
              }),
            ],
          }),
        ];

  const [title, setTitle] = useState(initialBook?.title || "");
  const [bookType, setBookType] = useState(initialBook?.bookType || "Guide");
  const [isPublic, setIsPublic] = useState(initialBook?.isPublic || false);
  const [targetLength, setTargetLength] = useState(initialBook?.targetLength || "");
  const [audience, setAudience] = useState(initialBook?.audience || "");
  const [tone, setTone] = useState(initialBook?.tone || "");
  const [summary, setSummary] = useState(initialBook?.summary || "");
  const [outline, setOutline] = useState(initialBook?.outline || "");
  const [sourceDraft, setSourceDraft] = useState(initialBook?.sourceDraft || initialSeedSourceDraft);
  const [authorNotes, setAuthorNotes] = useState(initialBook?.authorNotes || "");
  const [storySynopsis, setStorySynopsis] = useState(initialBook?.storySynopsis || "");
  const [storyChapterCount, setStoryChapterCount] = useState(
    initialBook?.storyChapterCount ? String(initialBook.storyChapterCount) : "",
  );
  const [storyStructureNotes, setStoryStructureNotes] = useState(
    initialBook?.storyStructureNotes || "",
  );
  const [storyCharacters, setStoryCharacters] = useState<StoryCharacterDraft[]>(
    hydrateStoryCharacters(initialBook?.characterProfilesJson),
  );
  const [storySettings, setStorySettings] = useState<StorySettingDraft[]>(
    hydrateStorySettings(initialBook?.settingProfilesJson),
  );
  const [storyModeEnabled, setStoryModeEnabled] = useState(
    inferStoryMode(initialBook?.bookType || "Guide", initialBook),
  );
  const [sections, setSections] = useState<BookSectionDraft[]>(initialSections);
  const [activeSectionId, setActiveSectionId] = useState(initialSections[0]?.id || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefiningSection, setIsRefiningSection] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationNote, setGenerationNote] = useState("");

  useEffect(() => {
    if (initialBook?.sourceDraft || initialSeedSourceDraft.trim()) {
      return;
    }

    const transferredIdea = consumeHomeIdeaTransfer();

    if (transferredIdea) {
      setSourceDraft(transferredIdea);
    }
  }, [initialBook?.sourceDraft, initialSeedSourceDraft]);

  const activeSection = useMemo(
    () => findSectionById(sections, activeSectionId) || sections[0] || null,
    [activeSectionId, sections],
  );
  const activeParent = useMemo(
    () => (activeSection ? findParentSection(sections, activeSection.id) : null),
    [activeSection, sections],
  );
  const activeIsSubsection = Boolean(activeParent);
  const sectionCounts = useMemo(() => countSections(sections), [sections]);
  const sourceWordCount = useMemo(() => countWords(sourceDraft), [sourceDraft]);
  const activeWordCount = useMemo(
    () => countWords(activeSection?.content || ""),
    [activeSection],
  );
  const activeSectionHasSeedContext = useMemo(
    () =>
      Boolean(
        activeSection &&
          [
            activeSection.title,
            activeSection.summary,
            activeSection.content,
            activeSection.sceneGoal,
            activeSection.sceneConflict,
          ]
            .filter(Boolean)
            .join(" ")
            .trim(),
      ),
    [activeSection],
  );
  const activeSectionHasDraftContent = useMemo(
    () => Boolean(activeSection && [activeSection.summary, activeSection.content].join(" ").trim()),
    [activeSection],
  );
  const activeSectionCharacters = useMemo(
    () =>
      storyCharacters.filter((character) =>
        activeSection?.characterIds.includes(character.id),
      ),
    [activeSection, storyCharacters],
  );
  const activeSectionSettings = useMemo(
    () =>
      storySettings.filter((setting) =>
        activeSection?.settingIds.includes(setting.id),
      ),
    [activeSection, storySettings],
  );
  const structureProgress = useMemo(
    () => countStructuredProgress(sections),
    [sections],
  );
  const saveReadiness = useMemo(() => {
    if (!title.trim()) {
      return "Add a title to make this draft save-ready.";
    }

    if (!sourceDraft.trim()) {
      return "Add source material so the draft has a working foundation.";
    }

    return "Draft is ready to save. Keep refining locally or commit this version now.";
  }, [sourceDraft, title]);
  const activePath = useMemo(() => {
    if (!activeSection) {
      return "No section selected";
    }

    if (!activeParent) {
      return activeSection.title;
    }

    return `${activeParent.title} / ${activeSection.title}`;
  }, [activeParent, activeSection]);
  const isStoryMode =
    storyModeEnabled ||
    /novel|story|fiction|novella|fantasy|romance|thriller/i.test(bookType);

  function syncSections(nextSections: BookSectionDraft[]) {
    setSections(nextSections);

    if (!findSectionById(nextSections, activeSectionId)) {
      setActiveSectionId(nextSections[0]?.id || "");
    }
  }

  function handleStarterOutline() {
    const nextSections = [
      createBookSectionDraft({
        kind: "Introduction",
        title: title ? `Why ${title}` : "Introduction",
        summary: "Frame the core problem, story, or transformation.",
      }),
      createBookSectionDraft({
        kind: "Chapter",
        title: "Chapter 1",
        summary: "Establish the foundation or opening narrative arc.",
        children: [
          createBookSectionDraft({
            kind: "Subsection",
            title: "Section 1.1",
            summary: "Introduce the first supporting point or scene.",
          }),
          createBookSectionDraft({
            kind: "Example",
            title: "Example 1",
            summary: "Ground the chapter with an example, story, or case.",
          }),
        ],
      }),
      createBookSectionDraft({
        kind: "Chapter",
        title: "Chapter 2",
        summary: "Develop the second major idea, lesson, or conflict.",
        children: [
          createBookSectionDraft({
            kind: "Subsection",
            title: "Section 2.1",
            summary: "Expand the chapter with a focused sub-point.",
          }),
        ],
      }),
      createBookSectionDraft({
        kind: "Conclusion",
        title: "Conclusion",
        summary: "Close with synthesis and the reader's next move.",
      }),
    ];

    syncSections(nextSections);
    setActiveSectionId(nextSections[0]?.id || "");
    setOutline(buildBookOutline(nextSections));
    setGenerationError("");
    setGenerationNote("Starter outline created. Chapters and subsections are both editable.");
  }

  async function handleGenerateWithAi() {
    if (!sourceDraft.trim()) {
      setGenerationError("Add a draft, notes, or rough book concept first.");
      return;
    }

    setIsGenerating(true);
    setGenerationError("");
    setGenerationNote("");

    try {
      const response = await fetch("/api/ai/book-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          bookType,
          targetLength,
          audience,
          tone,
          sourceDraft,
          authorNotes,
          storySynopsis,
          storyChapterCount: storyChapterCount ? Number(storyChapterCount) : null,
          storyStructureNotes,
          characterProfilesJson: JSON.stringify(storyCharacters),
          settingProfilesJson: JSON.stringify(storySettings),
        }),
      });

      const payload = (await response.json()) as {
        title?: string;
        summary?: string;
        outline?: string;
        sections?: Array<{
          kind?: string;
          title?: string;
          summary?: string;
          content?: string;
        }>;
        model?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "AI book generation failed.");
      }

      const nextSections =
        payload.sections?.map((section) =>
          createBookSectionDraft({
            kind: section.kind,
            title: section.title,
            summary: section.summary,
            content: section.content,
          }),
        ) || [];

      if (payload.title) {
        setTitle(payload.title);
      }

      if (payload.summary) {
        setSummary(payload.summary);
      }

      if (payload.outline) {
        setOutline(payload.outline);
      } else if (nextSections.length > 0) {
        setOutline(buildBookOutline(nextSections));
      }

      if (nextSections.length > 0) {
        syncSections(nextSections);
        setActiveSectionId(nextSections[0]?.id || "");
      }

      setGenerationNote(
        payload.model
          ? `AI structured the draft with ${payload.model}. You can now refine chapters or subsections individually.`
          : "AI structured the draft.",
      );
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : "Something went wrong while generating the book.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRefineSectionWithAi() {
    if (!activeSection) {
      return;
    }

    if (!activeSectionHasSeedContext) {
      setGenerationError(
        isStoryMode
          ? "Add at least a section title, summary, or scene context before generating this section."
          : "Add some notes or draft content to this section before refining it.",
      );
      return;
    }

    setIsRefiningSection(true);
    setGenerationError("");
    setGenerationNote("");

    try {
      const response = await fetch("/api/ai/book-section", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookTitle: title,
          bookType,
          targetLength,
          audience,
          tone,
          bookSummary: summary,
          outline,
          authorNotes,
          storySynopsis,
          storyChapterCount: storyChapterCount ? Number(storyChapterCount) : null,
          storyStructureNotes,
          characterProfilesJson: JSON.stringify(storyCharacters),
          settingProfilesJson: JSON.stringify(storySettings),
          selectedCharacterProfilesJson: JSON.stringify(activeSectionCharacters),
          selectedSettingProfilesJson: JSON.stringify(activeSectionSettings),
          sceneGoal: activeSection.sceneGoal,
          sceneConflict: activeSection.sceneConflict,
          povCharacterName:
            storyCharacters.find(
              (character) => character.id === activeSection.povCharacterId,
            )?.name || "",
          sectionKind: activeSection.kind,
          sectionTitle: activeSection.title,
          sectionSummary: activeSection.summary,
          sectionContent: activeSection.content,
        }),
      });

      const payload = (await response.json()) as {
        kind?: string;
        title?: string;
        summary?: string;
        content?: string;
        model?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "AI section refinement failed.");
      }

      updateSection(activeSection.id, {
        kind: payload.kind || activeSection.kind,
        title: payload.title || activeSection.title,
        summary: payload.summary || activeSection.summary,
        content: payload.content || activeSection.content,
      });

      setGenerationNote(
        payload.model
          ? `This ${activeIsSubsection ? "subsection" : "section"} was refined with ${payload.model}.`
          : "This section was refined with AI.",
      );
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Something went wrong while refining this section.",
      );
    } finally {
      setIsRefiningSection(false);
    }
  }

  function updateSection(id: string, patch: Partial<BookSectionDraft>) {
    syncSections(
      updateSectionTree(sections, id, (section) => ({
        ...section,
        ...patch,
      })),
    );
  }

  function addSection(kind: string) {
    const nextSection = createBookSectionDraft({
      kind,
      title:
        kind === "Chapter"
          ? `Chapter ${sections.filter((item) => item.kind === "Chapter").length + 1}`
          : kind,
      summary: `Draft the ${kind.toLowerCase()} goals here.`,
    });
    const nextSections = [...sections, nextSection];
    syncSections(nextSections);
    setActiveSectionId(nextSection.id);
    setOutline((current) => current || buildBookOutline(nextSections));
  }

  function addSubsection(parentId: string) {
    const parent = findSectionById(sections, parentId);

    if (!parent) {
      return;
    }

    const nextChild = createBookSectionDraft({
      kind: "Subsection",
      title: `${parent.title} Subsection ${parent.children.length + 1}`,
      summary: "Draft the focus of this subsection here.",
    });

    const nextSections = insertSubsection(sections, parentId, nextChild);
    syncSections(nextSections);
    setActiveSectionId(nextChild.id);
  }

  function removeSection(id: string) {
    const nextSections = removeSectionTree(sections, id);

    if (nextSections.length === 0) {
      return;
    }

    syncSections(nextSections);
  }

  function moveSection(id: string, direction: -1 | 1) {
    syncSections(moveSectionWithinSiblings(sections, id, direction));
  }

  function toggleSectionCharacter(sectionId: string, characterId: string) {
    const currentSection = findSectionById(sections, sectionId);

    if (!currentSection) {
      return;
    }

    const nextCharacterIds = currentSection.characterIds.includes(characterId)
      ? currentSection.characterIds.filter((id) => id !== characterId)
      : [...currentSection.characterIds, characterId];

    updateSection(sectionId, {
      characterIds: nextCharacterIds,
      povCharacterId:
        currentSection.povCharacterId === characterId && !nextCharacterIds.includes(characterId)
          ? ""
          : currentSection.povCharacterId,
    });
  }

  function toggleSectionSetting(sectionId: string, settingId: string) {
    const currentSection = findSectionById(sections, sectionId);

    if (!currentSection) {
      return;
    }

    const nextSettingIds = currentSection.settingIds.includes(settingId)
      ? currentSection.settingIds.filter((id) => id !== settingId)
      : [...currentSection.settingIds, settingId];

    updateSection(sectionId, {
      settingIds: nextSettingIds,
    });
  }

  function updateStoryCharacter(id: string, patch: Partial<StoryCharacterDraft>) {
    setStoryCharacters((current) =>
      current.map((character) =>
        character.id === id ? { ...character, ...patch } : character,
      ),
    );
  }

  function updateStorySetting(id: string, patch: Partial<StorySettingDraft>) {
    setStorySettings((current) =>
      current.map((setting) =>
        setting.id === id ? { ...setting, ...patch } : setting,
      ),
    );
  }

  function addStoryCharacter() {
    setStoryCharacters((current) => [...current, createStoryCharacterDraft()]);
  }

  function addStorySetting() {
    setStorySettings((current) => [...current, createStorySettingDraft()]);
  }

  function removeStoryCharacter(id: string) {
    setStoryCharacters((current) => current.filter((character) => character.id !== id));
  }

  function removeStorySetting(id: string) {
    setStorySettings((current) => current.filter((setting) => setting.id !== id));
  }

  async function handleGenerateStoryCharacter(id: string) {
    const currentCharacter = storyCharacters.find((character) => character.id === id);

    if (!currentCharacter) {
      return;
    }

    setGenerationError("");
    setGenerationNote("");
    setIsRefiningSection(true);

    try {
      const response = await fetch("/api/ai/story-character", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookTitle: title,
          storySynopsis,
          storyChapterCount: storyChapterCount ? Number(storyChapterCount) : null,
          storyStructureNotes,
          settingProfilesJson: JSON.stringify(storySettings),
          characterName: currentCharacter.name,
          characterRole: currentCharacter.role,
          characterSeedNotes: currentCharacter.notes,
        }),
      });

      const payload = (await response.json()) as
        | (StoryCharacterDraft & { model?: string; error?: string })
        | { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "AI character generation failed.");
      }

      updateStoryCharacter(id, {
        name: "name" in payload ? payload.name : currentCharacter.name,
        role: "role" in payload ? payload.role : currentCharacter.role,
        goal: "goal" in payload ? payload.goal : currentCharacter.goal,
        conflict: "conflict" in payload ? payload.conflict : currentCharacter.conflict,
        arc: "arc" in payload ? payload.arc : currentCharacter.arc,
        voice: "voice" in payload ? payload.voice : currentCharacter.voice,
        notes: "notes" in payload ? payload.notes : currentCharacter.notes,
      });

      setGenerationNote(
        "model" in payload && payload.model
          ? `Character profile structured with ${payload.model}.`
          : "Character profile structured.",
      );
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : "Unable to generate the character profile.",
      );
    } finally {
      setIsRefiningSection(false);
    }
  }

  async function handleGenerateStorySetting(id: string) {
    const currentSetting = storySettings.find((setting) => setting.id === id);

    if (!currentSetting) {
      return;
    }

    setGenerationError("");
    setGenerationNote("");
    setIsRefiningSection(true);

    try {
      const response = await fetch("/api/ai/story-setting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookTitle: title,
          storySynopsis,
          storyChapterCount: storyChapterCount ? Number(storyChapterCount) : null,
          storyStructureNotes,
          characterProfilesJson: JSON.stringify(storyCharacters),
          settingName: currentSetting.name,
          settingPurpose: currentSetting.purpose,
          settingSeedNotes: currentSetting.description || currentSetting.rules,
        }),
      });

      const payload = (await response.json()) as
        | (StorySettingDraft & { model?: string; error?: string })
        | { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "AI setting generation failed.");
      }

      updateStorySetting(id, {
        name: "name" in payload ? payload.name : currentSetting.name,
        purpose: "purpose" in payload ? payload.purpose : currentSetting.purpose,
        description:
          "description" in payload ? payload.description : currentSetting.description,
        sensoryNotes:
          "sensoryNotes" in payload
            ? payload.sensoryNotes
            : currentSetting.sensoryNotes,
        rules: "rules" in payload ? payload.rules : currentSetting.rules,
      });

      setGenerationNote(
        "model" in payload && payload.model
          ? `Setting profile structured with ${payload.model}.`
          : "Setting profile structured.",
      );
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : "Unable to generate the setting profile.",
      );
    } finally {
      setIsRefiningSection(false);
    }
  }

  function renderOutlineItems(items: BookSectionDraft[], depth = 0) {
    return items.map((section, index) => {
      const isActive = section.id === activeSection?.id;
      const childLabel = depth === 0 ? `Section ${index + 1}` : `Subsection ${index + 1}`;

      return (
        <div key={section.id} className="book-outline-node">
          <button
            type="button"
            className={isActive ? "book-outline-item is-active" : "book-outline-item"}
            onClick={() => setActiveSectionId(section.id)}
            style={depth > 0 ? { marginLeft: "1rem" } : undefined}
          >
            <span className="book-outline-kicker">
              {childLabel} · {section.kind}
            </span>
            <strong>{section.title}</strong>
            <span>{section.summary || "No summary yet."}</span>
          </button>

          {depth === 0 ? (
            <div className="book-outline-actions">
              <button
                type="button"
                className="mini-button"
                onClick={() => addSubsection(section.id)}
              >
                Add Subsection
              </button>
            </div>
          ) : null}

          {section.children.length > 0 ? renderOutlineItems(section.children, depth + 1) : null}
        </div>
      );
    });
  }

  return (
    <div className="form-card">
      <form action={submitAction}>
        {mode === "edit" && initialBook ? (
          <input type="hidden" name="id" value={initialBook.id} />
        ) : null}
        <input type="hidden" name="sectionsJson" value={JSON.stringify(sections)} />
        <input type="hidden" name="isPublic" value={isPublic ? "on" : ""} />
        <input
          type="hidden"
          name="characterProfilesJson"
          value={JSON.stringify(storyCharacters)}
        />
        <input
          type="hidden"
          name="settingProfilesJson"
          value={JSON.stringify(storySettings)}
        />

        <div className="form-callout">
          <h2 className="form-callout-title">Draft To Book</h2>
          <p className="form-callout-text">
            Start with a rough idea, answer a few framing questions, then shape the book section by section.
            Chapters can now hold their own subsections, and each selected part can be refined with AI on its own.
          </p>
        </div>

        <section className="book-editor-status-band" aria-label="Book draft status">
          <div className="book-editor-status-card book-editor-status-card-primary">
            <span className="book-editor-status-kicker">Current Focus</span>
            <strong>{activePath}</strong>
            <p className="book-editor-status-copy">
              {activeIsSubsection
                ? `Working inside ${activeParent?.title || "a parent section"}.`
                : "Top-level manuscript structure is selected."}
            </p>
          </div>
          <div className="book-editor-status-card">
            <span className="book-editor-status-kicker">Structure</span>
            <strong>
              {sectionCounts.topLevel} sections / {sectionCounts.subsections} subsections
            </strong>
            <p className="book-editor-status-copy">
              {Math.round(structureProgress * 100)}% of the outline has a title plus supporting draft material.
            </p>
            <div
              className="book-editor-progress-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(structureProgress * 100)}
            >
              <span style={{ width: `${Math.max(10, Math.round(structureProgress * 100))}%` }} />
            </div>
          </div>
          <div className="book-editor-status-card">
            <span className="book-editor-status-kicker">Draft Signals</span>
            <strong>{sourceWordCount} source words</strong>
            <p className="book-editor-status-copy">
              Active section holds {activeWordCount} words. {saveReadiness}
            </p>
          </div>
        </section>

        <div className="book-planner-grid">
          <div className="form-group">
            <label className="form-label">Book mode</label>
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <button
                type="button"
                className={isStoryMode ? "button-link secondary" : "button-link"}
                onClick={() => {
                  setStoryModeEnabled(false);
                  if (/novel|story|fiction|novella/i.test(bookType)) {
                    setBookType("Guide");
                  }
                }}
              >
                Standard Book
              </button>
              <button
                type="button"
                className={isStoryMode ? "button-link" : "button-link secondary"}
                onClick={() => {
                  setStoryModeEnabled(true);
                  if (!/novel|story|fiction|novella/i.test(bookType)) {
                    setBookType("Novel");
                  }
                }}
              >
                Novel / Story
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="bookType" className="form-label">
              What kind of book is this?
            </label>
            <input
              id="bookType"
              name="bookType"
              type="text"
              className="form-input"
              value={bookType}
              onChange={(event) => setBookType(event.target.value)}
              placeholder="Guide, memoir, novel, manifesto, business book..."
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="targetLength" className="form-label">
              How long should it be?
            </label>
            <input
              id="targetLength"
              name="targetLength"
              type="text"
              className="form-input"
              value={targetLength}
              onChange={(event) => setTargetLength(event.target.value)}
              placeholder="Short book, 8 chapters, 30,000 words..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="audience" className="form-label">
              Who is it for?
            </label>
            <input
              id="audience"
              name="audience"
              type="text"
              className="form-input"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              placeholder="New founders, young readers, engineers..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="tone" className="form-label">
              Tone or voice
            </label>
            <input
              id="tone"
              name="tone"
              type="text"
              className="form-input"
              value={tone}
              onChange={(event) => setTone(event.target.value)}
              placeholder="Practical, cinematic, warm, academic..."
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="title" className="form-label">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            className="form-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Choose a working title"
            required
          />
        </div>

        <div className="checkbox-row">
          <input
            id="isPublic"
            type="checkbox"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
          />
          <label htmlFor="isPublic">
            Make this book visible on the public site
          </label>
        </div>

        {isStoryMode ? (
          <section className="post-step-card" style={{ marginBottom: "1.5rem" }}>
            <div className="post-step-heading">
              <p className="home-section-kicker">Story Bible</p>
              <h2 className="trading-section-title">Novel / Story context</h2>
              <p className="form-help" style={{ marginBottom: 0 }}>
                Build the story anatomy, character profiles, and setting references that Gemini can use while helping you draft scenes and chapters.
              </p>
            </div>

            <div className="book-planner-grid">
              <div className="form-group">
                <label htmlFor="storySynopsis" className="form-label">
                  Story synopsis
                </label>
                <textarea
                  id="storySynopsis"
                  name="storySynopsis"
                  className="form-textarea form-textarea-compact"
                  rows={5}
                  value={storySynopsis}
                  onChange={(event) => setStorySynopsis(event.target.value)}
                  placeholder="What is the story about at a high level?"
                />
              </div>

              <div className="form-group">
                <label htmlFor="storyChapterCount" className="form-label">
                  Planned chapter count
                </label>
                <input
                  id="storyChapterCount"
                  name="storyChapterCount"
                  type="number"
                  min={1}
                  className="form-input"
                  value={storyChapterCount}
                  onChange={(event) => setStoryChapterCount(event.target.value)}
                  placeholder="12"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="storyStructureNotes" className="form-label">
                Story anatomy / structure notes
              </label>
              <textarea
                id="storyStructureNotes"
                name="storyStructureNotes"
                className="form-textarea form-textarea-compact"
                rows={5}
                value={storyStructureNotes}
                onChange={(event) => setStoryStructureNotes(event.target.value)}
                placeholder="Act structure, POV rules, themes, plot threads, climax notes..."
              />
            </div>

            <div className="book-story-grid">
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="book-story-header">
                  <div>
                    <h3 className="card-title">Character Profiles</h3>
                    <p className="meta">Create character cards and let AI help tighten them into usable story context.</p>
                  </div>
                  <button type="button" className="button-link secondary" onClick={addStoryCharacter}>
                    Add Character
                  </button>
                </div>

                <div className="book-story-stack">
                  {storyCharacters.length === 0 ? (
                    <p className="meta">No characters yet. Add one to start building the cast.</p>
                  ) : (
                    storyCharacters.map((character) => (
                      <div key={character.id} className="book-story-card">
                        <div className="book-planner-grid">
                          <div className="form-group">
                            <label className="form-label">Name</label>
                            <input
                              className="form-input"
                              value={character.name}
                              onChange={(event) =>
                                updateStoryCharacter(character.id, { name: event.target.value })
                              }
                              placeholder="Character name"
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Role</label>
                            <input
                              className="form-input"
                              value={character.role}
                              onChange={(event) =>
                                updateStoryCharacter(character.id, { role: event.target.value })
                              }
                              placeholder="Protagonist, rival, mentor..."
                            />
                          </div>
                        </div>

                        <div className="book-planner-grid">
                          <div className="form-group">
                            <label className="form-label">Goal</label>
                            <textarea
                              className="form-textarea form-textarea-compact"
                              rows={3}
                              value={character.goal}
                              onChange={(event) =>
                                updateStoryCharacter(character.id, { goal: event.target.value })
                              }
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Conflict</label>
                            <textarea
                              className="form-textarea form-textarea-compact"
                              rows={3}
                              value={character.conflict}
                              onChange={(event) =>
                                updateStoryCharacter(character.id, { conflict: event.target.value })
                              }
                            />
                          </div>
                        </div>

                        <div className="book-planner-grid">
                          <div className="form-group">
                            <label className="form-label">Arc</label>
                            <textarea
                              className="form-textarea form-textarea-compact"
                              rows={3}
                              value={character.arc}
                              onChange={(event) =>
                                updateStoryCharacter(character.id, { arc: event.target.value })
                              }
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Voice</label>
                            <textarea
                              className="form-textarea form-textarea-compact"
                              rows={3}
                              value={character.voice}
                              onChange={(event) =>
                                updateStoryCharacter(character.id, { voice: event.target.value })
                              }
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Seed notes</label>
                          <textarea
                            className="form-textarea form-textarea-compact"
                            rows={4}
                            value={character.notes}
                            onChange={(event) =>
                              updateStoryCharacter(character.id, { notes: event.target.value })
                            }
                            placeholder="Any rough notes, references, or traits you want preserved."
                          />
                        </div>

                        <div className="toolbar" style={{ marginBottom: 0 }}>
                          <button
                            type="button"
                            className="button-link secondary"
                            onClick={() => handleGenerateStoryCharacter(character.id)}
                            disabled={isRefiningSection}
                          >
                            {isRefiningSection ? "Generating..." : "Generate Character Profile"}
                          </button>
                          <button
                            type="button"
                            className="mini-button"
                            onClick={() => removeStoryCharacter(character.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="card" style={{ marginBottom: 0 }}>
                <div className="book-story-header">
                  <div>
                    <h3 className="card-title">Settings / World</h3>
                    <p className="meta">Capture the places, atmosphere, and rules that scenes should stay anchored to.</p>
                  </div>
                  <button type="button" className="button-link secondary" onClick={addStorySetting}>
                    Add Setting
                  </button>
                </div>

                <div className="book-story-stack">
                  {storySettings.length === 0 ? (
                    <p className="meta">No settings yet. Add one to start building the world.</p>
                  ) : (
                    storySettings.map((setting) => (
                      <div key={setting.id} className="book-story-card">
                        <div className="book-planner-grid">
                          <div className="form-group">
                            <label className="form-label">Setting name</label>
                            <input
                              className="form-input"
                              value={setting.name}
                              onChange={(event) =>
                                updateStorySetting(setting.id, { name: event.target.value })
                              }
                              placeholder="City, house, station, kingdom..."
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Purpose in story</label>
                            <input
                              className="form-input"
                              value={setting.purpose}
                              onChange={(event) =>
                                updateStorySetting(setting.id, { purpose: event.target.value })
                              }
                              placeholder="Home base, conflict zone, secret refuge..."
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Description</label>
                          <textarea
                            className="form-textarea form-textarea-compact"
                            rows={4}
                            value={setting.description}
                            onChange={(event) =>
                              updateStorySetting(setting.id, {
                                description: event.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="book-planner-grid">
                          <div className="form-group">
                            <label className="form-label">Sensory notes</label>
                            <textarea
                              className="form-textarea form-textarea-compact"
                              rows={3}
                              value={setting.sensoryNotes}
                              onChange={(event) =>
                                updateStorySetting(setting.id, {
                                  sensoryNotes: event.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Rules / constraints</label>
                            <textarea
                              className="form-textarea form-textarea-compact"
                              rows={3}
                              value={setting.rules}
                              onChange={(event) =>
                                updateStorySetting(setting.id, { rules: event.target.value })
                              }
                            />
                          </div>
                        </div>

                        <div className="toolbar" style={{ marginBottom: 0 }}>
                          <button
                            type="button"
                            className="button-link secondary"
                            onClick={() => handleGenerateStorySetting(setting.id)}
                            disabled={isRefiningSection}
                          >
                            {isRefiningSection ? "Generating..." : "Generate Setting Profile"}
                          </button>
                          <button
                            type="button"
                            className="mini-button"
                            onClick={() => removeStorySetting(setting.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <div className="generate-row">
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className="button-link secondary"
              onClick={handleStarterOutline}
            >
              Build Starter Outline
            </button>
            <button
              type="button"
              className="button-link"
              onClick={handleGenerateWithAi}
              disabled={!aiDraftEnabled || isGenerating}
            >
              {isGenerating ? "Generating..." : "Generate With AI"}
            </button>
          </div>

          {aiDraftEnabled ? (
            <p className="form-help generate-help">
              AI draft assist uses {aiProviderLabel} on the {aiTierLabel} tier to shape the overall book.
            </p>
          ) : (
            <p className="form-help generate-help">
              AI draft assist is unavailable until a provider is configured.
            </p>
          )}
        </div>

        {generationError ? <p className="form-error">{generationError}</p> : null}
        {generationNote ? <p className="form-help">{generationNote}</p> : null}

        <div className="form-group">
          <label htmlFor="sourceDraft" className="form-label">
            Rough draft or source material
          </label>
          <textarea
            id="sourceDraft"
            name="sourceDraft"
            className="form-textarea"
            value={sourceDraft}
            onChange={(event) => setSourceDraft(event.target.value)}
            placeholder="Paste your rough draft, notes, transcript, premise, scenes, or chapter ideas."
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="authorNotes" className="form-label">
            Author notes
          </label>
          <textarea
            id="authorNotes"
            name="authorNotes"
            className="form-textarea form-textarea-compact"
            rows={5}
            value={authorNotes}
            onChange={(event) => setAuthorNotes(event.target.value)}
            placeholder="Any constraints, themes, examples, or scenes to preserve."
          />
        </div>

        <div className="book-outline-shell">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="summary" className="form-label">
              Book summary
            </label>
            <textarea
              id="summary"
              name="summary"
              className="form-textarea form-textarea-compact"
              rows={4}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="A short synopsis or promise for the book."
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="outline" className="form-label">
              Outline overview
            </label>
            <textarea
              id="outline"
              name="outline"
              className="form-textarea form-textarea-compact"
              rows={8}
              value={outline}
              onChange={(event) => setOutline(event.target.value)}
              placeholder="High-level outline notes. This can differ from the detailed section structure below."
            />
          </div>
        </div>

        <section className="book-workbench">
          <div className="book-workbench-sidebar">
            <div className="book-workbench-header">
              <h2 className="trading-section-title">Outline</h2>
              <p className="form-help">
                Select a chapter or subsection, then update only that part without changing sibling sections.
              </p>
            </div>

            <div className="book-outline-list">{renderOutlineItems(sections)}</div>

            <div className="toolbar" style={{ marginBottom: 0 }}>
              <button
                type="button"
                className="button-link secondary"
                onClick={() => addSection("Introduction")}
              >
                Add Intro
              </button>
              <button
                type="button"
                className="button-link secondary"
                onClick={() => addSection("Chapter")}
              >
                Add Chapter
              </button>
              <button
                type="button"
                className="button-link secondary"
                onClick={() => addSection("Conclusion")}
              >
                Add Ending
              </button>
            </div>
          </div>

          <div className="book-workbench-panel">
            {activeSection ? (
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="book-section-toolbar">
                  <div>
                    <p className="book-editor-breadcrumb">{activePath}</p>
                    <h2 className="trading-section-title" style={{ marginBottom: 0 }}>
                      {activeIsSubsection ? "Edit Subsection" : "Edit Section"}
                    </h2>
                    <p className="form-help" style={{ marginTop: "0.35rem", marginBottom: 0 }}>
                      {activeIsSubsection
                        ? `Inside ${activeParent?.title || "parent section"}`
                        : "Top-level chapter or section"}
                    </p>
                    <p className="form-help" style={{ marginTop: "0.35rem", marginBottom: 0 }}>
                      {isStoryMode
                        ? activeSectionHasDraftContent
                          ? "AI will refine only this selected story section and leave the rest of the outline alone."
                          : "AI will draft only this selected story section from its local context, story bible, and rough book inputs."
                        : "AI updates stay scoped to the selected section only."}
                    </p>
                  </div>

                  <div className="toolbar" style={{ marginBottom: 0 }}>
                    <button
                      type="button"
                      className="button-link secondary"
                      onClick={handleRefineSectionWithAi}
                      disabled={!aiDraftEnabled || isRefiningSection}
                    >
                      {isRefiningSection
                        ? isStoryMode && !activeSectionHasDraftContent
                          ? "Generating..."
                          : "Refining..."
                        : isStoryMode && !activeSectionHasDraftContent
                          ? "Generate With AI"
                          : "Refine With AI"}
                    </button>
                    {!activeIsSubsection ? (
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => addSubsection(activeSection.id)}
                      >
                        Add Subsection
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="mini-button"
                      onClick={() => moveSection(activeSection.id, -1)}
                    >
                      Move Up
                    </button>
                    <button
                      type="button"
                      className="mini-button"
                      onClick={() => moveSection(activeSection.id, 1)}
                    >
                      Move Down
                    </button>
                    <button
                      type="button"
                      className="mini-button"
                      onClick={() => removeSection(activeSection.id)}
                      disabled={sections.length === 1 && !activeIsSubsection}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="book-planner-grid">
                  <div className="form-group">
                    <label htmlFor="activeSectionKind" className="form-label">
                      {activeIsSubsection ? "Subsection type" : "Section type"}
                    </label>
                    <select
                      id="activeSectionKind"
                      className="form-select"
                      value={activeSection.kind}
                      onChange={(event) =>
                        updateSection(activeSection.id, {
                          kind: event.target.value,
                        })
                      }
                    >
                      {(activeIsSubsection
                        ? BOOK_SUBSECTION_KIND_OPTIONS
                        : BOOK_SECTION_KIND_OPTIONS
                      ).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="activeSectionTitle" className="form-label">
                      {activeIsSubsection ? "Subsection title" : "Section title"}
                    </label>
                    <input
                      id="activeSectionTitle"
                      type="text"
                      className="form-input"
                      value={activeSection.title}
                      onChange={(event) =>
                        updateSection(activeSection.id, {
                          title: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="activeSectionSummary" className="form-label">
                    {activeIsSubsection ? "Subsection summary" : "Section summary"}
                  </label>
                  <textarea
                    id="activeSectionSummary"
                    className="form-textarea form-textarea-compact"
                    rows={4}
                    value={activeSection.summary}
                    onChange={(event) =>
                      updateSection(activeSection.id, {
                        summary: event.target.value,
                      })
                    }
                  />
                </div>

                {isStoryMode ? (
                  <section className="book-section-context">
                    <div className="book-story-header">
                      <div>
                        <h3 className="card-title">Section Story Context</h3>
                        <p className="meta">
                          Choose the characters, setting, and scene intent that matter for this specific section.
                        </p>
                      </div>
                    </div>

                    <div className="book-planner-grid">
                      <div className="form-group">
                        <label htmlFor="activeSectionPov" className="form-label">
                          Primary POV character
                        </label>
                        <select
                          id="activeSectionPov"
                          className="form-select"
                          value={activeSection.povCharacterId}
                          onChange={(event) =>
                            updateSection(activeSection.id, {
                              povCharacterId: event.target.value,
                            })
                          }
                        >
                          <option value="">No POV selected</option>
                          {storyCharacters.map((character) => (
                            <option key={character.id} value={character.id}>
                              {character.name || "Untitled character"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="activeSectionSceneGoal" className="form-label">
                          Scene goal
                        </label>
                        <input
                          id="activeSectionSceneGoal"
                          type="text"
                          className="form-input"
                          value={activeSection.sceneGoal}
                          onChange={(event) =>
                            updateSection(activeSection.id, {
                              sceneGoal: event.target.value,
                            })
                          }
                          placeholder="What should this scene accomplish?"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="activeSectionSceneConflict" className="form-label">
                        Scene conflict
                      </label>
                      <textarea
                        id="activeSectionSceneConflict"
                        className="form-textarea form-textarea-compact"
                        rows={3}
                        value={activeSection.sceneConflict}
                        onChange={(event) =>
                          updateSection(activeSection.id, {
                            sceneConflict: event.target.value,
                          })
                        }
                        placeholder="What tension, obstacle, or friction drives this section?"
                      />
                    </div>

                    <div className="book-section-context-grid">
                      <div className="book-section-context-card">
                        <h4 className="book-section-context-title">Characters In This Section</h4>
                        {storyCharacters.length === 0 ? (
                          <p className="meta">Add characters in the story bible first.</p>
                        ) : (
                          <div className="book-selection-stack">
                            {storyCharacters.map((character) => (
                              <label key={character.id} className="book-selection-chip">
                                <input
                                  type="checkbox"
                                  checked={activeSection.characterIds.includes(character.id)}
                                  onChange={() =>
                                    toggleSectionCharacter(activeSection.id, character.id)
                                  }
                                />
                                <span>
                                  <strong>{character.name || "Untitled character"}</strong>
                                  <small>{character.role || "Role not set"}</small>
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="book-section-context-card">
                        <h4 className="book-section-context-title">Settings In This Section</h4>
                        {storySettings.length === 0 ? (
                          <p className="meta">Add settings in the story bible first.</p>
                        ) : (
                          <div className="book-selection-stack">
                            {storySettings.map((setting) => (
                              <label key={setting.id} className="book-selection-chip">
                                <input
                                  type="checkbox"
                                  checked={activeSection.settingIds.includes(setting.id)}
                                  onChange={() =>
                                    toggleSectionSetting(activeSection.id, setting.id)
                                  }
                                />
                                <span>
                                  <strong>{setting.name || "Untitled setting"}</strong>
                                  <small>{setting.purpose || "Purpose not set"}</small>
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                ) : null}

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="activeSectionContent" className="form-label">
                    {activeIsSubsection ? "Subsection content" : "Section content"}
                  </label>
                  <textarea
                    id="activeSectionContent"
                    className="form-textarea"
                    value={activeSection.content}
                    onChange={(event) =>
                      updateSection(activeSection.id, {
                        content: event.target.value,
                      })
                    }
                    placeholder="Write or refine this part here."
                  />
                </div>
              </div>
            ) : (
              <div className="card" style={{ marginBottom: 0 }}>
                <p className="form-help" style={{ marginBottom: 0 }}>
                  Add a section to start building the book.
                </p>
              </div>
            )}
          </div>
        </section>

        <div className="toolbar" style={{ marginTop: "1.5rem", marginBottom: 0 }}>
          <button type="submit" className="submit-button">
            {mode === "create" ? "Save Book Draft" : "Update Book Draft"}
          </button>
        </div>
      </form>
    </div>
  );
}
