CREATE TABLE "Book" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "bookType" TEXT NOT NULL,
  "targetLength" TEXT,
  "audience" TEXT,
  "tone" TEXT,
  "summary" TEXT,
  "outline" TEXT,
  "sourceDraft" TEXT NOT NULL,
  "authorNotes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorId" INTEGER NOT NULL,
  CONSTRAINT "Book_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BookSection" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "content" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bookId" INTEGER NOT NULL,
  CONSTRAINT "BookSection_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Book_slug_key" ON "Book"("slug");
CREATE INDEX "Book_authorId_idx" ON "Book"("authorId");
CREATE INDEX "BookSection_bookId_position_idx" ON "BookSection"("bookId", "position");
