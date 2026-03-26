CREATE TABLE "TradingJournalEntry" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "timeframe" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "entryDate" DATETIME NOT NULL,
  "exitDate" DATETIME,
  "entryPrice" REAL NOT NULL,
  "exitPrice" REAL,
  "summary" TEXT NOT NULL,
  "executionNotes" TEXT,
  "mistakeReview" TEXT,
  "lessonLearned" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorId" INTEGER NOT NULL,
  CONSTRAINT "TradingJournalEntry_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TradingJournalEntry_slug_key" ON "TradingJournalEntry"("slug");
