-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TradingSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "setupType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "thesis" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "entryMin" REAL NOT NULL,
    "entryMax" REAL NOT NULL,
    "stopLoss" REAL NOT NULL,
    "targetOne" REAL NOT NULL,
    "targetTwo" REAL,
    "confidence" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'PENDING',
    "sourceChat" TEXT,
    "workflowNotes" TEXT,
    "personalizedInsight" TEXT,
    "featuredPublic" BOOLEAN NOT NULL DEFAULT false,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "suggestionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" INTEGER NOT NULL,
    CONSTRAINT "TradingSession_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TradingSession" ("authorId", "confidence", "createdAt", "direction", "entryMax", "entryMin", "featuredPublic", "id", "market", "outcome", "personalizedInsight", "setupType", "slug", "sourceChat", "stopLoss", "suggestionCount", "summary", "targetOne", "targetTwo", "thesis", "timeframe", "title", "updatedAt", "votes", "workflowNotes") SELECT "authorId", "confidence", "createdAt", "direction", "entryMax", "entryMin", "featuredPublic", "id", "market", "outcome", "personalizedInsight", "setupType", "slug", "sourceChat", "stopLoss", "suggestionCount", "summary", "targetOne", "targetTwo", "thesis", "timeframe", "title", "updatedAt", "votes", "workflowNotes" FROM "TradingSession";
DROP TABLE "TradingSession";
ALTER TABLE "new_TradingSession" RENAME TO "TradingSession";
CREATE UNIQUE INDEX "TradingSession_slug_key" ON "TradingSession"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
