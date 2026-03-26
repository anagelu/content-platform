"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

async function requireTradingSessionAccess(id: number) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const tradingSession = await prisma.tradingSession.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      slug: true,
      authorId: true,
    },
  });

  if (!tradingSession) {
    throw new Error("Trading session not found.");
  }

  const canManage =
    session.user.role === "admin" ||
    session.user.id === String(tradingSession.authorId);

  if (!canManage) {
    throw new Error("You do not have permission to manage this trading session.");
  }

  return tradingSession;
}

export async function deleteTradingSession(formData: FormData) {
  const id = Number(formData.get("id"));

  if (!id) {
    throw new Error("Trading session ID is required.");
  }

  await requireTradingSessionAccess(id);

  await prisma.tradingSession.delete({
    where: {
      id,
    },
  });

  redirect("/trading");
}
