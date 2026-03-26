"use server";

import { auth } from "@/auth";
import {
  parseBookSectionsJson,
  buildBookOutline,
  parseStoryCharactersJson,
  parseStorySettingsJson,
} from "@/lib/books";
import { prisma } from "@/lib/prisma";
import { generateUniqueBookSlug } from "@/lib/slugify";
import { redirect } from "next/navigation";
import type { BookSectionDraft } from "@/lib/books";

function parseBookPayload(formData: FormData) {
  const title = formData.get("title")?.toString().trim() || "";
  const bookType = formData.get("bookType")?.toString().trim() || "";
  const isPublic = formData.get("isPublic")?.toString() === "on";
  const targetLength = formData.get("targetLength")?.toString().trim() || "";
  const audience = formData.get("audience")?.toString().trim() || "";
  const tone = formData.get("tone")?.toString().trim() || "";
  const summary = formData.get("summary")?.toString().trim() || "";
  const sourceDraft = formData.get("sourceDraft")?.toString().trim() || "";
  const authorNotes = formData.get("authorNotes")?.toString().trim() || "";
  const storySynopsis = formData.get("storySynopsis")?.toString().trim() || "";
  const storyChapterCountValue =
    formData.get("storyChapterCount")?.toString().trim() || "";
  const storyStructureNotes =
    formData.get("storyStructureNotes")?.toString().trim() || "";
  const outlineValue = formData.get("outline")?.toString().trim() || "";
  const sections = parseBookSectionsJson(formData.get("sectionsJson")?.toString());
  const characterProfiles = parseStoryCharactersJson(
    formData.get("characterProfilesJson")?.toString(),
  );
  const settingProfiles = parseStorySettingsJson(
    formData.get("settingProfilesJson")?.toString(),
  );
  const storyChapterCount = Number.parseInt(storyChapterCountValue, 10);

  if (!title || !bookType || !sourceDraft) {
    throw new Error("Title, book type, and source draft are required.");
  }

  return {
    title,
    bookType,
    isPublic,
    targetLength,
    audience,
    tone,
    summary,
    sourceDraft,
    authorNotes,
    storySynopsis,
    storyChapterCount: Number.isFinite(storyChapterCount) ? storyChapterCount : null,
    storyStructureNotes,
    characterProfilesJson:
      characterProfiles.length > 0 ? JSON.stringify(characterProfiles) : "",
    settingProfilesJson:
      settingProfiles.length > 0 ? JSON.stringify(settingProfiles) : "",
    outline: outlineValue || buildBookOutline(sections),
    sections,
  };
}

async function createBookSections(
  bookId: number,
  sections: BookSectionDraft[],
  parentSectionId: number | null = null,
) {
  for (const [index, section] of sections.entries()) {
    const created = await prisma.bookSection.create({
      data: {
        bookId,
        parentSectionId,
        kind: section.kind,
        title: section.title,
        summary: section.summary || null,
        content: section.content,
        characterIdsJson:
          section.characterIds.length > 0 ? JSON.stringify(section.characterIds) : null,
        settingIdsJson:
          section.settingIds.length > 0 ? JSON.stringify(section.settingIds) : null,
        sceneGoal: section.sceneGoal || null,
        sceneConflict: section.sceneConflict || null,
        povCharacterId: section.povCharacterId || null,
        position: index,
      },
    });

    if (section.children.length > 0) {
      await createBookSections(bookId, section.children, created.id);
    }
  }
}

export async function createBook(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const authorId = Number(session.user.id);

  if (!Number.isFinite(authorId)) {
    throw new Error("Valid user session required.");
  }

  const payload = parseBookPayload(formData);
  const slug = await generateUniqueBookSlug(payload.title);

  const book = await prisma.book.create({
    data: {
      title: payload.title,
      slug,
      bookType: payload.bookType,
      isPublic: payload.isPublic,
      targetLength: payload.targetLength || null,
      audience: payload.audience || null,
      tone: payload.tone || null,
      summary: payload.summary || null,
      outline: payload.outline || null,
      sourceDraft: payload.sourceDraft,
      authorNotes: payload.authorNotes || null,
      storySynopsis: payload.storySynopsis || null,
      storyChapterCount: payload.storyChapterCount,
      storyStructureNotes: payload.storyStructureNotes || null,
      characterProfilesJson: payload.characterProfilesJson || null,
      settingProfilesJson: payload.settingProfilesJson || null,
      authorId,
    },
  });

  await createBookSections(book.id, payload.sections);

  redirect(`/books/${book.slug}`);
}

export async function updateBook(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const id = Number(formData.get("id"));

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Book ID is required.");
  }

  const existingBook = await prisma.book.findUnique({
    where: { id },
  });

  if (!existingBook) {
    throw new Error("Book not found.");
  }

  const userId = Number(session.user.id);
  const isAdmin = session.user.role === "admin";

  if (!isAdmin && existingBook.authorId !== userId) {
    throw new Error("You do not have permission to edit this book.");
  }

  const payload = parseBookPayload(formData);

  await prisma.bookSection.deleteMany({
    where: {
      bookId: id,
    },
  });

  await prisma.book.update({
    where: { id },
    data: {
      title: payload.title,
      bookType: payload.bookType,
      isPublic: payload.isPublic,
      targetLength: payload.targetLength || null,
      audience: payload.audience || null,
      tone: payload.tone || null,
      summary: payload.summary || null,
      outline: payload.outline || null,
      sourceDraft: payload.sourceDraft,
      authorNotes: payload.authorNotes || null,
      storySynopsis: payload.storySynopsis || null,
      storyChapterCount: payload.storyChapterCount,
      storyStructureNotes: payload.storyStructureNotes || null,
      characterProfilesJson: payload.characterProfilesJson || null,
      settingProfilesJson: payload.settingProfilesJson || null,
    },
  });

  await createBookSections(id, payload.sections);

  redirect(`/books/${existingBook.slug}`);
}

export async function deleteBook(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const id = Number(formData.get("id"));

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Book ID is required.");
  }

  const book = await prisma.book.findUnique({
    where: { id },
  });

  if (!book) {
    redirect("/books");
  }

  const userId = Number(session.user.id);
  const isAdmin = session.user.role === "admin";

  if (!isAdmin && book.authorId !== userId) {
    throw new Error("You do not have permission to delete this book.");
  }

  await prisma.book.delete({
    where: { id },
  });

  redirect("/books");
}
