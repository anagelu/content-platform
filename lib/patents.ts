import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

export async function generateUniquePatentSlug(title: string) {
  const baseSlug = slugify(title) || "patent-record";
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.patentRecord.findUnique({
      where: { slug },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export function buildProvisionalPacket(input: {
  title: string;
  inventorNames: string;
  problem: string;
  solution: string;
  novelty: string;
  useCases: string;
  alternatives: string;
  figureNotes: string;
  publicDisclosureState: string;
}) {
  return [
    `Invention Title: ${input.title}`,
    `Inventors: ${input.inventorNames}`,
    `Public Disclosure Status: ${input.publicDisclosureState}`,
    "",
    "1. Problem",
    input.problem,
    "",
    "2. Solution",
    input.solution,
    "",
    "3. Novelty / Distinguishing Features",
    input.novelty,
    "",
    "4. Use Cases",
    input.useCases || "No use cases captured yet.",
    "",
    "5. Alternatives / Variations",
    input.alternatives || "No alternatives captured yet.",
    "",
    "6. Figure / Diagram Notes",
    input.figureNotes || "No figure notes captured yet.",
    "",
    "7. Filing Reminder",
    "This packet is a preparation aid for a provisional-style disclosure. It is not legal advice or a filed application.",
  ].join("\n");
}

export function getProvisionalDeadline(provisionalFiledAt: Date | null) {
  if (!provisionalFiledAt) {
    return null;
  }

  const deadline = new Date(provisionalFiledAt);
  deadline.setFullYear(deadline.getFullYear() + 1);
  return deadline;
}
