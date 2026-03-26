import { prisma } from "@/lib/prisma";

export const prismaWithDistribution = prisma as typeof prisma & {
  contentDerivative: {
    findMany: (args?: unknown) => Promise<unknown>;
    findUnique: (args?: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
  };
};
