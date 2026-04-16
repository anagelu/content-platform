-- CreateTable
CREATE TABLE "EkubGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "contributionAmount" REAL NOT NULL,
    "cycleFrequency" TEXT NOT NULL,
    "maxParticipants" INTEGER NOT NULL,
    "payoutMethod" TEXT NOT NULL,
    "reputationScore" REAL,
    "reserveLogic" TEXT,
    "feeLogic" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" INTEGER NOT NULL,
    CONSTRAINT "EkubGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EkubParticipant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "rotationOrder" INTEGER,
    "reputationScore" REAL,
    "walletAddress" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupId" INTEGER NOT NULL,
    CONSTRAINT "EkubParticipant_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EkubGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EkubCycle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cycleNumber" INTEGER NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "totalExpectedContribution" REAL NOT NULL,
    "totalCollected" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "recipientParticipantId" INTEGER,
    "drawRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupId" INTEGER NOT NULL,
    CONSTRAINT "EkubCycle_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EkubGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EkubCycle_recipientParticipantId_fkey" FOREIGN KEY ("recipientParticipantId") REFERENCES "EkubParticipant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EkubContribution" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "amountPaid" REAL NOT NULL DEFAULT 0,
    "paidAt" DATETIME,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cycleId" INTEGER NOT NULL,
    "participantId" INTEGER NOT NULL,
    CONSTRAINT "EkubContribution_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "EkubCycle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EkubContribution_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "EkubParticipant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EkubPayout" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "amountPaidOut" REAL NOT NULL,
    "payoutDate" DATETIME NOT NULL,
    "notes" TEXT,
    "transactionHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cycleId" INTEGER NOT NULL,
    "recipientParticipantId" INTEGER NOT NULL,
    CONSTRAINT "EkubPayout_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "EkubCycle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EkubPayout_recipientParticipantId_fkey" FOREIGN KEY ("recipientParticipantId") REFERENCES "EkubParticipant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EkubParticipant_groupId_rotationOrder_key" ON "EkubParticipant"("groupId", "rotationOrder");

-- CreateIndex
CREATE UNIQUE INDEX "EkubCycle_groupId_cycleNumber_key" ON "EkubCycle"("groupId", "cycleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EkubContribution_cycleId_participantId_key" ON "EkubContribution"("cycleId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "EkubPayout_cycleId_key" ON "EkubPayout"("cycleId");
