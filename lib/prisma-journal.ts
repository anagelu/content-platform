import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

type TradingJournalDelegate = PrismaClient["tradingSession"] & {
  findMany: (args?: Prisma.TradingJournalEntryFindManyArgs) => Promise<unknown>;
  findUnique: (
    args: Prisma.TradingJournalEntryFindUniqueArgs,
  ) => Promise<unknown>;
  create: (args: Prisma.TradingJournalEntryCreateArgs) => Promise<unknown>;
  update: (args: Prisma.TradingJournalEntryUpdateArgs) => Promise<unknown>;
  delete: (args: Prisma.TradingJournalEntryDeleteArgs) => Promise<unknown>;
};

export const prismaWithJournal = prisma as typeof prisma & {
  tradingJournalEntry: TradingJournalDelegate;
};
