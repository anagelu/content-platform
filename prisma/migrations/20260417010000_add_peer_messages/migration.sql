-- CreateTable
CREATE TABLE "DirectMessageThread" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "subject" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "starterId" INTEGER NOT NULL,
  "participantAId" INTEGER NOT NULL,
  "participantBId" INTEGER NOT NULL,
  CONSTRAINT "DirectMessageThread_starterId_fkey" FOREIGN KEY ("starterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DirectMessageThread_participantAId_fkey" FOREIGN KEY ("participantAId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DirectMessageThread_participantBId_fkey" FOREIGN KEY ("participantBId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DirectMessage" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "body" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" DATETIME,
  "threadId" INTEGER NOT NULL,
  "senderId" INTEGER NOT NULL,
  CONSTRAINT "DirectMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DirectMessageThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectMessageThread_participantAId_participantBId_key" ON "DirectMessageThread"("participantAId", "participantBId");

-- CreateIndex
CREATE INDEX "DirectMessageThread_lastMessageAt_idx" ON "DirectMessageThread"("lastMessageAt");

-- CreateIndex
CREATE INDEX "DirectMessage_threadId_createdAt_idx" ON "DirectMessage"("threadId", "createdAt");
