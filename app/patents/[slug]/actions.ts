"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  buildProvisionalPacket,
  getProvisionalDeadline,
} from "@/lib/patents";
import { redirect } from "next/navigation";

async function requireManageableRecord(id: number) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const record = await prisma.patentRecord.findUnique({
    where: { id },
  });

  if (!record) {
    throw new Error("Patent record not found.");
  }

  const userId = Number(session.user.id);
  const isAdmin = session.user.role === "admin";

  if (!isAdmin && record.authorId !== userId) {
    throw new Error("You do not have permission to manage this patent record.");
  }

  return record;
}

export async function updatePatentRecord(formData: FormData) {
  const id = Number(formData.get("id"));

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Patent record ID is required.");
  }

  await requireManageableRecord(id);

  const title = formData.get("title")?.toString().trim() || "";
  const inventorNames = formData.get("inventorNames")?.toString().trim() || "";
  const problem = formData.get("problem")?.toString().trim() || "";
  const solution = formData.get("solution")?.toString().trim() || "";
  const novelty = formData.get("novelty")?.toString().trim() || "";
  const useCases = formData.get("useCases")?.toString().trim() || "";
  const alternatives = formData.get("alternatives")?.toString().trim() || "";
  const figureNotes = formData.get("figureNotes")?.toString().trim() || "";
  const publicDisclosureState =
    formData.get("publicDisclosureState")?.toString().trim() || "Not publicly disclosed";
  const provisionalFiledAtValue =
    formData.get("provisionalFiledAt")?.toString().trim() || "";

  if (!title || !inventorNames || !problem || !solution || !novelty) {
    throw new Error("Title, inventors, problem, solution, and novelty are required.");
  }

  const provisionalFiledAt = provisionalFiledAtValue
    ? new Date(provisionalFiledAtValue)
    : null;
  const provisionalDeadline = getProvisionalDeadline(provisionalFiledAt);
  const packetBody = buildProvisionalPacket({
    title,
    inventorNames,
    problem,
    solution,
    novelty,
    useCases,
    alternatives,
    figureNotes,
    publicDisclosureState,
  });

  const updated = await prisma.patentRecord.update({
    where: { id },
    data: {
      title,
      inventorNames,
      problem,
      solution,
      novelty,
      useCases: useCases || null,
      alternatives: alternatives || null,
      figureNotes: figureNotes || null,
      publicDisclosureState,
      provisionalFiledAt,
      provisionalDeadline,
      packetBody,
    },
  });

  redirect(`/patents/${updated.slug}`);
}

export async function markPatentFiled(formData: FormData) {
  const id = Number(formData.get("id"));

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Patent record ID is required.");
  }

  const record = await requireManageableRecord(id);

  const provisionalFiledAtValue =
    formData.get("provisionalFiledAt")?.toString().trim() || "";

  if (!provisionalFiledAtValue) {
    throw new Error("A filed date is required.");
  }

  const provisionalFiledAt = new Date(provisionalFiledAtValue);
  const provisionalDeadline = getProvisionalDeadline(provisionalFiledAt);

  const packetBody = buildProvisionalPacket({
    title: record.title,
    inventorNames: record.inventorNames,
    problem: record.problem,
    solution: record.solution,
    novelty: record.novelty,
    useCases: record.useCases || "",
    alternatives: record.alternatives || "",
    figureNotes: record.figureNotes || "",
    publicDisclosureState: record.publicDisclosureState,
  });

  const updated = await prisma.patentRecord.update({
    where: { id },
    data: {
      provisionalFiledAt,
      provisionalDeadline,
      packetBody,
    },
  });

  redirect(`/patents/${updated.slug}`);
}

export async function deletePatentRecord(formData: FormData) {
  const id = Number(formData.get("id"));

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Patent record ID is required.");
  }

  await requireManageableRecord(id);

  await prisma.patentRecord.delete({
    where: { id },
  });

  redirect("/patents");
}
