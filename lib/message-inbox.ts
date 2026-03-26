import { prisma } from "@/lib/prisma";
import { generateSummary } from "@/lib/post-summary";
import { createHash } from "node:crypto";

export type MessageInboxItem = {
  id: number;
  userId: number;
  title: string;
  sourceLabel: string | null;
  conversation: string;
  authorNotes: string | null;
  summary: string | null;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
};

let ensuredMessageInboxTable = false;

export async function ensureMessageInboxTable() {
  if (ensuredMessageInboxTable) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS message_inbox_items (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      title TEXT NOT NULL,
      sourceLabel TEXT,
      conversation TEXT NOT NULL,
      authorNotes TEXT,
      summary TEXT,
      contentHash TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
    )
  `);

  try {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE message_inbox_items ADD COLUMN contentHash TEXT",
    );
  } catch {
    // Column already exists in the local SQLite table.
  }

  ensuredMessageInboxTable = true;
}

function inferInboxTitle(conversation: string, fallback = "Imported conversation") {
  const firstLine = conversation
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return fallback;
  }

  return firstLine.slice(0, 80);
}

function buildContentHash(conversation: string) {
  return createHash("sha256").update(conversation.trim()).digest("hex");
}

export async function createMessageInboxItem(input: {
  userId: number;
  title?: string;
  sourceLabel?: string | null;
  conversation: string;
  authorNotes?: string | null;
}) {
  await ensureMessageInboxTable();

  const conversation = input.conversation.trim();
  const authorNotes = input.authorNotes?.trim() || null;
  const title = input.title?.trim() || inferInboxTitle(conversation);
  const sourceLabel = input.sourceLabel?.trim() || null;
  const summary = generateSummary(
    [conversation, authorNotes].filter(Boolean).join("\n\n"),
  );
  const contentHash = buildContentHash(conversation);
  const existing = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `
      SELECT id
      FROM message_inbox_items
      WHERE userId = ? AND contentHash = ?
      LIMIT 1
    `,
    input.userId,
    contentHash,
  );

  if (existing[0]) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE message_inbox_items
        SET
          title = ?,
          sourceLabel = ?,
          authorNotes = COALESCE(?, authorNotes),
          summary = ?,
          updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      title,
      sourceLabel,
      authorNotes,
      summary || null,
      existing[0].id,
    );

    return {
      id: existing[0].id,
      deduped: true,
    };
  }

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO message_inbox_items (
        userId,
        title,
        sourceLabel,
        conversation,
        authorNotes,
        summary,
        contentHash,
        updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
    input.userId,
    title,
    sourceLabel,
    conversation,
    authorNotes,
    summary || null,
    contentHash,
  );

  return {
    deduped: false,
  };
}

export async function listMessageInboxItems(
  userId: number,
): Promise<MessageInboxItem[]> {
  await ensureMessageInboxTable();

  return prisma.$queryRawUnsafe<MessageInboxItem[]>(
    `
      SELECT *
      FROM message_inbox_items
      WHERE userId = ?
      ORDER BY datetime(updatedAt) DESC, id DESC
    `,
    userId,
  );
}

export async function getMessageInboxItem(
  userId: number,
  id: number,
): Promise<MessageInboxItem | null> {
  await ensureMessageInboxTable();

  const rows = await prisma.$queryRawUnsafe<MessageInboxItem[]>(
    `
      SELECT *
      FROM message_inbox_items
      WHERE userId = ? AND id = ?
      LIMIT 1
    `,
    userId,
    id,
  );

  return rows[0] ?? null;
}

export async function deleteMessageInboxItem(userId: number, id: number) {
  await ensureMessageInboxTable();

  await prisma.$executeRawUnsafe(
    `
      DELETE FROM message_inbox_items
      WHERE userId = ? AND id = ?
    `,
    userId,
    id,
  );
}
