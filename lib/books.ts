export type BookSectionDraft = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  content: string;
  characterIds: string[];
  settingIds: string[];
  sceneGoal: string;
  sceneConflict: string;
  povCharacterId: string;
  children: BookSectionDraft[];
};

export type StoryCharacterDraft = {
  id: string;
  name: string;
  role: string;
  goal: string;
  conflict: string;
  arc: string;
  voice: string;
  notes: string;
};

export type StorySettingDraft = {
  id: string;
  name: string;
  purpose: string;
  description: string;
  sensoryNotes: string;
  rules: string;
};

export const BOOK_SECTION_KIND_OPTIONS = [
  "Introduction",
  "Chapter",
  "Interlude",
  "Case Study",
  "Conclusion",
  "Appendix",
] as const;

export const BOOK_SUBSECTION_KIND_OPTIONS = [
  "Subsection",
  "Scene",
  "Example",
  "Exercise",
  "Case Study",
  "Reflection",
] as const;

function createSectionId() {
  return `section-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

function createStoryEntityId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

export function createBookSectionDraft(
  partial: Partial<BookSectionDraft> = {},
): BookSectionDraft {
  return {
    id: partial.id || createSectionId(),
    kind: partial.kind?.trim() || "Chapter",
    title: partial.title?.trim() || "Untitled Section",
    summary: partial.summary?.trim() || "",
    content: partial.content || "",
    characterIds: Array.isArray(partial.characterIds)
      ? partial.characterIds.filter((value): value is string => typeof value === "string")
      : [],
    settingIds: Array.isArray(partial.settingIds)
      ? partial.settingIds.filter((value): value is string => typeof value === "string")
      : [],
    sceneGoal: partial.sceneGoal?.trim() || "",
    sceneConflict: partial.sceneConflict?.trim() || "",
    povCharacterId: partial.povCharacterId?.trim() || "",
    children: Array.isArray(partial.children)
      ? partial.children.map((child) => createBookSectionDraft(child))
      : [],
  };
}

export function createStoryCharacterDraft(
  partial: Partial<StoryCharacterDraft> = {},
): StoryCharacterDraft {
  return {
    id: partial.id || createStoryEntityId("character"),
    name: partial.name?.trim() || "",
    role: partial.role?.trim() || "",
    goal: partial.goal?.trim() || "",
    conflict: partial.conflict?.trim() || "",
    arc: partial.arc?.trim() || "",
    voice: partial.voice?.trim() || "",
    notes: partial.notes?.trim() || "",
  };
}

export function createStorySettingDraft(
  partial: Partial<StorySettingDraft> = {},
): StorySettingDraft {
  return {
    id: partial.id || createStoryEntityId("setting"),
    name: partial.name?.trim() || "",
    purpose: partial.purpose?.trim() || "",
    description: partial.description?.trim() || "",
    sensoryNotes: partial.sensoryNotes?.trim() || "",
    rules: partial.rules?.trim() || "",
  };
}

export function getDefaultBookSections() {
  return [
    createBookSectionDraft({
      kind: "Introduction",
      title: "Introduction",
      summary: "Set expectations for the reader and frame the main promise.",
    }),
    createBookSectionDraft({
      kind: "Chapter",
      title: "Chapter 1",
      summary: "Develop the first major idea or narrative turn.",
      children: [
        createBookSectionDraft({
          kind: "Subsection",
          title: "Key Idea",
          summary: "Break the chapter into one focused, editable subsection.",
        }),
      ],
    }),
    createBookSectionDraft({
      kind: "Conclusion",
      title: "Conclusion",
      summary: "Wrap the book and point to the reader's next step.",
    }),
  ];
}

export function parseBookSectionsJson(value: string | null | undefined) {
  if (!value?.trim()) {
    return getDefaultBookSections();
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return getDefaultBookSections();
    }

    const sections = parsed
      .filter(
        (item): item is Partial<BookSectionDraft> =>
          Boolean(item) && typeof item === "object",
      )
      .map((item) => createBookSectionDraft(item))
      .filter((item) => item.title.trim() || item.content.trim() || item.children.length > 0);

    return sections.length > 0 ? sections : getDefaultBookSections();
  } catch {
    return getDefaultBookSections();
  }
}

export function parseStoryCharactersJson(value: string | null | undefined) {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (item): item is Partial<StoryCharacterDraft> =>
          Boolean(item) && typeof item === "object",
      )
      .map((item) => createStoryCharacterDraft(item))
      .filter((item) => item.name.trim() || item.role.trim() || item.notes.trim());
  } catch {
    return [];
  }
}

export function parseStorySettingsJson(value: string | null | undefined) {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (item): item is Partial<StorySettingDraft> =>
          Boolean(item) && typeof item === "object",
      )
      .map((item) => createStorySettingDraft(item))
      .filter((item) => item.name.trim() || item.description.trim() || item.purpose.trim());
  } catch {
    return [];
  }
}

export function buildBookOutline(sections: BookSectionDraft[]) {
  const lines: string[] = [];

  function visit(items: BookSectionDraft[], prefix: string[] = []) {
    items.forEach((section, index) => {
      const numbering = [...prefix, String(index + 1)];
      const line = `${numbering.join(".")}. ${section.kind}: ${section.title}`;
      lines.push(line);

      if (section.summary.trim()) {
        lines.push(`   ${section.summary.trim()}`);
      }

      if (section.children.length > 0) {
        visit(section.children, numbering);
      }
    });
  }

  visit(sections);
  return lines.join("\n");
}

export function findSectionById(
  sections: BookSectionDraft[],
  id: string,
): BookSectionDraft | null {
  for (const section of sections) {
    if (section.id === id) {
      return section;
    }

    const child = findSectionById(section.children, id);

    if (child) {
      return child;
    }
  }

  return null;
}

export function updateSectionTree(
  sections: BookSectionDraft[],
  id: string,
  updater: (section: BookSectionDraft) => BookSectionDraft,
): BookSectionDraft[] {
  return sections.map((section) => {
    if (section.id === id) {
      return updater(section);
    }

    if (section.children.length === 0) {
      return section;
    }

    return {
      ...section,
      children: updateSectionTree(section.children, id, updater),
    };
  });
}

export function removeSectionTree(
  sections: BookSectionDraft[],
  id: string,
): BookSectionDraft[] {
  return sections
    .filter((section) => section.id !== id)
    .map((section) => ({
      ...section,
      children: removeSectionTree(section.children, id),
    }));
}

export function insertSubsection(
  sections: BookSectionDraft[],
  parentId: string,
  child: BookSectionDraft,
): BookSectionDraft[] {
  return sections.map((section) => {
    if (section.id === parentId) {
      return {
        ...section,
        children: [...section.children, child],
      };
    }

    if (section.children.length === 0) {
      return section;
    }

    return {
      ...section,
      children: insertSubsection(section.children, parentId, child),
    };
  });
}

export function moveSectionWithinSiblings(
  sections: BookSectionDraft[],
  id: string,
  direction: -1 | 1,
): BookSectionDraft[] {
  const index = sections.findIndex((section) => section.id === id);

  if (index >= 0) {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= sections.length) {
      return sections;
    }

    const nextSections = [...sections];
    const [moved] = nextSections.splice(index, 1);
    nextSections.splice(nextIndex, 0, moved);
    return nextSections;
  }

  return sections.map((section) => ({
    ...section,
    children: moveSectionWithinSiblings(section.children, id, direction),
  }));
}

export function flattenBookSections(
  sections: BookSectionDraft[],
  parentSectionId: number | null = null,
) {
  return sections.flatMap((section, index) => [
    {
      tempId: section.id,
      parentTempId: parentSectionId,
      kind: section.kind,
      title: section.title,
      summary: section.summary || null,
      content: section.content,
      position: index,
      children: section.children,
    },
  ]);
}
