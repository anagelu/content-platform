"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  buildProvisionalPacket,
  generateUniquePatentSlug,
  getProvisionalDeadline,
} from "@/lib/patents";
import { redirect } from "next/navigation";

export async function createPatentRecord(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

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
  const slug = await generateUniquePatentSlug(title);
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

  const record = await prisma.patentRecord.create({
    data: {
      title,
      slug,
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
      authorId: Number(session.user.id),
    },
  });

  redirect(`/patents/${record.slug}`);
}
