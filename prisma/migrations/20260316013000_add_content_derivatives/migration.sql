CREATE TABLE "ContentDerivative" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "channel" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorId" INTEGER NOT NULL,
  "postId" INTEGER,
  "tradingSessionId" INTEGER,
  CONSTRAINT "ContentDerivative_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContentDerivative_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContentDerivative_tradingSessionId_fkey"
    FOREIGN KEY ("tradingSessionId") REFERENCES "TradingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
