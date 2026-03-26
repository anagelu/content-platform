ALTER TABLE "User" ADD COLUMN "publicTradingProfile" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "tradingBio" TEXT;
ALTER TABLE "User" ADD COLUMN "tradingFocus" TEXT;

CREATE TABLE "TradingSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "setupType" TEXT NOT NULL,
    "thesis" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
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

CREATE UNIQUE INDEX "TradingSession_slug_key" ON "TradingSession"("slug");
