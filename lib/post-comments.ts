import { prisma } from "@/lib/prisma";

export type ReactionCount = {
  emoji: string;
  count: number;
};

type PostCommentRow = {
  id: number;
  postId: number;
  userId: number | null;
  parentCommentId: number | null;
  authorName: string;
  body: string;
  createdAt: string;
};

export type PostComment = PostCommentRow & {
  reactions: ReactionCount[];
  replies: PostComment[];
};

let ensuredPostDiscussionTables = false;

async function ensurePostCommentsParentColumn() {
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info(post_comments)`,
  );

  const hasParentColumn = columns.some(
    (column) => column.name === "parentCommentId",
  );

  if (!hasParentColumn) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE post_comments ADD COLUMN parentCommentId INTEGER`,
    );
  }
}

async function ensureReactionActorKeyColumn(tableName: "post_reactions" | "post_comment_reactions") {
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info(${tableName})`,
  );

  const hasActorKeyColumn = columns.some((column) => column.name === "actorKey");

  if (!hasActorKeyColumn) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE ${tableName} ADD COLUMN actorKey TEXT`,
    );
  }
}

export async function ensurePostDiscussionTables() {
  if (ensuredPostDiscussionTables) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS post_comments (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      postId INTEGER NOT NULL,
      userId INTEGER,
      parentCommentId INTEGER,
      authorName TEXT NOT NULL,
      body TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (postId) REFERENCES Post(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY (parentCommentId) REFERENCES post_comments(id) ON DELETE CASCADE
    )
  `);

  await ensurePostCommentsParentColumn();

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS post_comments_postId_createdAt_idx
    ON post_comments (postId, createdAt DESC)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS post_comments_parentCommentId_idx
    ON post_comments (parentCommentId)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS post_reactions (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      postId INTEGER NOT NULL,
      userId INTEGER,
      emoji TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (postId) REFERENCES Post(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS post_reactions_postId_emoji_idx
    ON post_reactions (postId, emoji)
  `);

  await ensureReactionActorKeyColumn("post_reactions");

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS post_reactions_postId_emoji_actorKey_idx
    ON post_reactions (postId, emoji, actorKey)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS post_comment_reactions (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      commentId INTEGER NOT NULL,
      userId INTEGER,
      emoji TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (commentId) REFERENCES post_comments(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS post_comment_reactions_commentId_emoji_idx
    ON post_comment_reactions (commentId, emoji)
  `);

  await ensureReactionActorKeyColumn("post_comment_reactions");

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS post_comment_reactions_commentId_emoji_actorKey_idx
    ON post_comment_reactions (commentId, emoji, actorKey)
  `);

  ensuredPostDiscussionTables = true;
}

function buildCommentTree(
  rows: PostCommentRow[],
  reactionRows: Array<{ commentId: number; emoji: string; count: number }>,
) {
  const reactionMap = new Map<number, ReactionCount[]>();

  for (const row of reactionRows) {
    const existing = reactionMap.get(row.commentId) ?? [];
    existing.push({
      emoji: row.emoji,
      count: Number(row.count),
    });
    reactionMap.set(row.commentId, existing);
  }

  const commentMap = new Map<number, PostComment>();

  for (const row of rows) {
    commentMap.set(row.id, {
      ...row,
      reactions: reactionMap.get(row.id) ?? [],
      replies: [],
    });
  }

  const roots: PostComment[] = [];

  for (const row of rows) {
    const comment = commentMap.get(row.id);

    if (!comment) {
      continue;
    }

    if (row.parentCommentId) {
      const parent = commentMap.get(row.parentCommentId);

      if (parent) {
        parent.replies.push(comment);
        continue;
      }
    }

    roots.push(comment);
  }

  return roots;
}

export async function listPostComments(postId: number): Promise<PostComment[]> {
  await ensurePostDiscussionTables();

  const rows = await prisma.$queryRawUnsafe<PostCommentRow[]>(
    `
      SELECT id, postId, userId, parentCommentId, authorName, body, createdAt
      FROM post_comments
      WHERE postId = ?
      ORDER BY datetime(createdAt) ASC, id ASC
    `,
    postId,
  );

  const reactionRows = await prisma.$queryRawUnsafe<
    Array<{ commentId: number; emoji: string; count: number }>
  >(
    `
      SELECT commentId, emoji, COUNT(*) as count
      FROM post_comment_reactions
      WHERE commentId IN (
        SELECT id FROM post_comments WHERE postId = ?
      )
      GROUP BY commentId, emoji
      ORDER BY emoji ASC
    `,
    postId,
  );

  return buildCommentTree(rows, reactionRows);
}

export async function listPostReactionCounts(postId: number): Promise<ReactionCount[]> {
  await ensurePostDiscussionTables();

  const rows = await prisma.$queryRawUnsafe<Array<{ emoji: string; count: number }>>(
    `
      SELECT emoji, COUNT(*) as count
      FROM post_reactions
      WHERE postId = ?
      GROUP BY emoji
      ORDER BY emoji ASC
    `,
    postId,
  );

  return rows.map((row) => ({
    emoji: row.emoji,
    count: Number(row.count),
  }));
}

export async function createPostComment({
  postId,
  userId,
  parentCommentId,
  authorName,
  body,
}: {
  postId: number;
  userId: number | null;
  parentCommentId?: number | null;
  authorName: string;
  body: string;
}) {
  await ensurePostDiscussionTables();

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO post_comments (postId, userId, parentCommentId, authorName, body)
      VALUES (?, ?, ?, ?, ?)
    `,
    postId,
    userId,
    parentCommentId ?? null,
    authorName,
    body,
  );
}

export async function addPostReaction({
  postId,
  userId,
  actorKey,
  emoji,
}: {
  postId: number;
  userId: number | null;
  actorKey: string;
  emoji: string;
}) {
  await ensurePostDiscussionTables();

  const existingRows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `
      SELECT id
      FROM post_reactions
      WHERE postId = ? AND emoji = ? AND actorKey = ?
    `,
    postId,
    emoji,
    actorKey,
  );

  if (existingRows.length > 0) {
    await prisma.$executeRawUnsafe(
      `
        DELETE FROM post_reactions
        WHERE postId = ? AND emoji = ? AND actorKey = ?
      `,
      postId,
      emoji,
      actorKey,
    );
    return;
  }

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO post_reactions (postId, userId, actorKey, emoji)
      VALUES (?, ?, ?, ?)
    `,
    postId,
    userId,
    actorKey,
    emoji,
  );
}

export async function addCommentReaction({
  commentId,
  userId,
  actorKey,
  emoji,
}: {
  commentId: number;
  userId: number | null;
  actorKey: string;
  emoji: string;
}) {
  await ensurePostDiscussionTables();

  const existingRows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `
      SELECT id
      FROM post_comment_reactions
      WHERE commentId = ? AND emoji = ? AND actorKey = ?
    `,
    commentId,
    emoji,
    actorKey,
  );

  if (existingRows.length > 0) {
    await prisma.$executeRawUnsafe(
      `
        DELETE FROM post_comment_reactions
        WHERE commentId = ? AND emoji = ? AND actorKey = ?
      `,
      commentId,
      emoji,
      actorKey,
    );
    return;
  }

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO post_comment_reactions (commentId, userId, actorKey, emoji)
      VALUES (?, ?, ?, ?)
    `,
    commentId,
    userId,
    actorKey,
    emoji,
  );
}
