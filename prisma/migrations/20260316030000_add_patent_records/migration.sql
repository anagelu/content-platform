CREATE TABLE "PatentRecord" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "inventorNames" TEXT NOT NULL,
  "problem" TEXT NOT NULL,
  "solution" TEXT NOT NULL,
  "novelty" TEXT NOT NULL,
  "useCases" TEXT,
  "alternatives" TEXT,
  "figureNotes" TEXT,
  "publicDisclosureState" TEXT NOT NULL,
  "provisionalFiledAt" DATETIME,
  "provisionalDeadline" DATETIME,
  "packetBody" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorId" INTEGER NOT NULL,
  CONSTRAINT "PatentRecord_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PatentRecord_slug_key" ON "PatentRecord"("slug");
