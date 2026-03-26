import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/passwords";

let adminSyncPromise: Promise<void> | null = null;

async function syncEnvAdminUserInternal() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    return;
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      username,
    },
  });

  if (!existingUser) {
    await prisma.user.create({
      data: {
        username,
        name: "Admin",
        email: "admin@local.dev",
        passwordHash: hashPassword(password),
        role: "ADMIN",
      },
    });

    return;
  }

  const needsPasswordUpdate = !verifyPassword(password, existingUser.passwordHash);
  const needsRoleUpdate = existingUser.role !== "ADMIN";

  if (!needsPasswordUpdate && !needsRoleUpdate) {
    return;
  }

  await prisma.user.update({
    where: {
      id: existingUser.id,
    },
    data: {
      passwordHash: needsPasswordUpdate
        ? hashPassword(password)
        : existingUser.passwordHash,
      role: "ADMIN",
    },
  });
}

export async function syncEnvAdminUser() {
  if (!adminSyncPromise) {
    adminSyncPromise = syncEnvAdminUserInternal().finally(() => {
      adminSyncPromise = null;
    });
  }

  return adminSyncPromise;
}
