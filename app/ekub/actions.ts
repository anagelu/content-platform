"use server";

import { auth } from "@/auth";
import {
  EkubCycleFrequency,
  EkubParticipantStatus,
  EkubPayoutMethod,
} from "@prisma/client";
import {
  calculatePotSize,
  chooseRandomRecipient,
  getActiveParticipants,
  getNextCycleDueDate,
  getNextRotationRecipient,
  getTotalCollected,
  parseOptionalDate,
  parsePositiveNumber,
} from "@/lib/ekub";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireEkubUser() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = Number(session.user.id);

  if (!Number.isFinite(userId)) {
    throw new Error("Valid user session required.");
  }

  return {
    userId,
    isAdmin: session.user.role === "admin",
  };
}

async function getAuthorizedGroup(groupId: number) {
  const { userId, isAdmin } = await requireEkubUser();
  const group = await prisma.ekubGroup.findUnique({
    where: { id: groupId },
    include: {
      participants: {
        orderBy: [{ rotationOrder: "asc" }, { createdAt: "asc" }],
      },
      cycles: {
        include: {
          payout: true,
          contributions: true,
        },
        orderBy: { cycleNumber: "asc" },
      },
    },
  });

  if (!group) {
    throw new Error("Ekub group not found.");
  }

  if (!isAdmin && group.ownerId !== userId) {
    throw new Error("You do not have permission to manage this Ekub group.");
  }

  return group;
}

async function recomputeCycleTotals(cycleId: number) {
  const cycle = await prisma.ekubCycle.findUnique({
    where: { id: cycleId },
    include: {
      contributions: true,
    },
  });

  if (!cycle) {
    throw new Error("Cycle not found.");
  }

  const totalCollected = getTotalCollected(cycle.contributions);

  return prisma.ekubCycle.update({
    where: { id: cycleId },
    data: {
      totalCollected,
      status: cycle.status === "COMPLETED" ? "COMPLETED" : "OPEN",
    },
  });
}

export async function createEkubGroup(formData: FormData) {
  const { userId } = await requireEkubUser();
  const name = formData.get("name")?.toString().trim() || "";
  const description = formData.get("description")?.toString().trim() || "";
  const contributionAmount = parsePositiveNumber(
    formData.get("contributionAmount"),
    "Contribution amount",
  );
  const maxParticipants = Math.max(
    1,
    Math.floor(parsePositiveNumber(formData.get("maxParticipants"), "Max participants")),
  );
  const cycleFrequency = (formData.get("cycleFrequency")?.toString() ||
    "WEEKLY") as EkubCycleFrequency;
  const payoutMethod = (formData.get("payoutMethod")?.toString() ||
    "FIXED_ROTATION") as EkubPayoutMethod;

  if (!name) {
    throw new Error("Group name is required.");
  }

  const group = await prisma.ekubGroup.create({
    data: {
      name,
      description: description || null,
      contributionAmount,
      cycleFrequency,
      maxParticipants,
      payoutMethod,
      ownerId: userId,
    },
  });

  revalidatePath("/ekub");
  redirect(`/ekub/${group.id}`);
}

export async function addEkubParticipant(formData: FormData) {
  const groupId = Number(formData.get("groupId"));

  if (!Number.isFinite(groupId) || groupId <= 0) {
    throw new Error("Group ID is required.");
  }

  const group = await getAuthorizedGroup(groupId);
  const name = formData.get("name")?.toString().trim() || "";
  const email = formData.get("email")?.toString().trim() || "";
  const status = (formData.get("status")?.toString() ||
    "ACTIVE") as EkubParticipantStatus;

  if (!name) {
    throw new Error("Participant name is required.");
  }

  if (group.participants.length >= group.maxParticipants) {
    throw new Error("This group has reached its max participant limit.");
  }

  const nextRotationOrder =
    group.participants.reduce((max, participant) => {
      return Math.max(max, participant.rotationOrder ?? 0);
    }, 0) + 1;

  await prisma.ekubParticipant.create({
    data: {
      groupId,
      name,
      email: email || null,
      status,
      rotationOrder: nextRotationOrder,
    },
  });

  revalidatePath(`/ekub/${groupId}`);
  revalidatePath(`/ekub/${groupId}/participants`);
}

export async function updateEkubParticipant(formData: FormData) {
  const participantId = Number(formData.get("participantId"));
  const groupId = Number(formData.get("groupId"));

  if (!Number.isFinite(participantId) || participantId <= 0) {
    throw new Error("Participant ID is required.");
  }

  if (!Number.isFinite(groupId) || groupId <= 0) {
    throw new Error("Group ID is required.");
  }

  await getAuthorizedGroup(groupId);

  const status = (formData.get("status")?.toString() ||
    "ACTIVE") as EkubParticipantStatus;
  const rotationOrderValue = formData.get("rotationOrder")?.toString().trim() || "";
  const rotationOrder = rotationOrderValue ? Number(rotationOrderValue) : null;

  await prisma.ekubParticipant.update({
    where: { id: participantId },
    data: {
      status,
      rotationOrder: rotationOrder && Number.isFinite(rotationOrder) ? Math.max(1, Math.floor(rotationOrder)) : null,
    },
  });

  revalidatePath(`/ekub/${groupId}`);
  revalidatePath(`/ekub/${groupId}/participants`);
}

export async function removeEkubParticipant(formData: FormData) {
  const participantId = Number(formData.get("participantId"));
  const groupId = Number(formData.get("groupId"));

  if (!Number.isFinite(participantId) || participantId <= 0) {
    throw new Error("Participant ID is required.");
  }

  if (!Number.isFinite(groupId) || groupId <= 0) {
    throw new Error("Group ID is required.");
  }

  await getAuthorizedGroup(groupId);

  await prisma.ekubParticipant.delete({
    where: { id: participantId },
  });

  revalidatePath(`/ekub/${groupId}`);
  revalidatePath(`/ekub/${groupId}/participants`);
}

export async function createNextEkubCycle(formData: FormData) {
  const groupId = Number(formData.get("groupId"));

  if (!Number.isFinite(groupId) || groupId <= 0) {
    throw new Error("Group ID is required.");
  }

  const group = await getAuthorizedGroup(groupId);
  const activeParticipants = getActiveParticipants(group.participants);

  if (activeParticipants.length === 0) {
    throw new Error("Add at least one active participant before creating a cycle.");
  }

  if (group.cycles.some((cycle) => cycle.status !== "COMPLETED")) {
    throw new Error("Complete the current cycle before creating the next one.");
  }

  const lastCycle = [...group.cycles].sort((a, b) => b.cycleNumber - a.cycleNumber)[0] ?? null;
  const cycleNumber = (lastCycle?.cycleNumber ?? 0) + 1;
  const dueDate = getNextCycleDueDate(lastCycle?.dueDate ?? null, group.cycleFrequency);
  const totalExpectedContribution = calculatePotSize(
    group.contributionAmount,
    activeParticipants.length,
  );

  const cycle = await prisma.ekubCycle.create({
    data: {
      groupId,
      cycleNumber,
      dueDate,
      totalExpectedContribution,
      status: "OPEN",
      contributions: {
        create: activeParticipants.map((participant) => ({
          participantId: participant.id,
          amountPaid: 0,
          isPaid: false,
        })),
      },
    },
  });

  revalidatePath(`/ekub/${groupId}`);
  revalidatePath(`/ekub/${groupId}/cycles/${cycle.id}`);
}

export async function assignEkubRecipient(formData: FormData) {
  const cycleId = Number(formData.get("cycleId"));
  const groupId = Number(formData.get("groupId"));

  if (!Number.isFinite(cycleId) || cycleId <= 0) {
    throw new Error("Cycle ID is required.");
  }

  if (!Number.isFinite(groupId) || groupId <= 0) {
    throw new Error("Group ID is required.");
  }

  const group = await getAuthorizedGroup(groupId);
  const cycle = group.cycles.find((entry) => entry.id === cycleId);

  if (!cycle) {
    throw new Error("Cycle not found.");
  }

  if (cycle.payout) {
    throw new Error("This cycle already has a payout recorded.");
  }

  const payouts = group.cycles
    .map((entry) => entry.payout)
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const recipient =
    group.payoutMethod === "FIXED_ROTATION"
      ? getNextRotationRecipient(group.participants, payouts)
      : chooseRandomRecipient(group.participants, payouts);

  if (!recipient) {
    throw new Error("No eligible recipient found for this cycle.");
  }

  await prisma.ekubCycle.update({
    where: { id: cycleId },
    data: {
      recipientParticipantId: recipient.id,
      drawRunAt: new Date(),
      status: "OPEN",
    },
  });

  revalidatePath(`/ekub/${groupId}`);
  revalidatePath(`/ekub/${groupId}/cycles/${cycleId}`);
}

export async function updateEkubContribution(formData: FormData) {
  const groupId = Number(formData.get("groupId"));
  const cycleId = Number(formData.get("cycleId"));
  const contributionId = Number(formData.get("contributionId"));

  if (!Number.isFinite(groupId) || groupId <= 0) {
    throw new Error("Group ID is required.");
  }

  if (!Number.isFinite(cycleId) || cycleId <= 0) {
    throw new Error("Cycle ID is required.");
  }

  if (!Number.isFinite(contributionId) || contributionId <= 0) {
    throw new Error("Contribution ID is required.");
  }

  await getAuthorizedGroup(groupId);

  const amountPaidValue = formData.get("amountPaid")?.toString().trim() || "0";
  const amountPaid = Number(amountPaidValue);
  const isPaid = formData.get("isPaid")?.toString() === "on";
  const paidDate = parseOptionalDate(formData.get("paidDate"));

  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    throw new Error("Amount paid must be zero or greater.");
  }

  await prisma.ekubContribution.update({
    where: { id: contributionId },
    data: {
      amountPaid,
      isPaid,
      paidAt: isPaid ? paidDate ?? new Date() : null,
    },
  });

  await recomputeCycleTotals(cycleId);

  revalidatePath(`/ekub/${groupId}`);
  revalidatePath(`/ekub/${groupId}/cycles/${cycleId}`);
}

export async function recordEkubPayout(formData: FormData) {
  const groupId = Number(formData.get("groupId"));
  const cycleId = Number(formData.get("cycleId"));

  if (!Number.isFinite(groupId) || groupId <= 0) {
    throw new Error("Group ID is required.");
  }

  if (!Number.isFinite(cycleId) || cycleId <= 0) {
    throw new Error("Cycle ID is required.");
  }

  const group = await getAuthorizedGroup(groupId);
  const cycle = await prisma.ekubCycle.findUnique({
    where: { id: cycleId },
    include: {
      payout: true,
      contributions: true,
      recipient: true,
    },
  });

  if (!cycle || cycle.groupId !== group.id) {
    throw new Error("Cycle not found.");
  }

  if (cycle.payout) {
    throw new Error("A payout has already been recorded for this cycle.");
  }

  const recipientParticipantId =
    Number(formData.get("recipientParticipantId")) || cycle.recipientParticipantId;

  if (!recipientParticipantId) {
    throw new Error("Choose a recipient before recording payout.");
  }

  const amountPaidOutInput = formData.get("amountPaidOut")?.toString().trim() || "";
  const amountPaidOut =
    amountPaidOutInput !== ""
      ? parsePositiveNumber(formData.get("amountPaidOut"), "Payout amount")
      : getTotalCollected(cycle.contributions);
  const payoutDate = parseOptionalDate(formData.get("payoutDate")) ?? new Date();
  const notes = formData.get("notes")?.toString().trim() || "";

  await prisma.$transaction(async (tx) => {
    await tx.ekubPayout.create({
      data: {
        cycleId,
        recipientParticipantId,
        amountPaidOut,
        payoutDate,
        notes: notes || null,
      },
    });

    await tx.ekubCycle.update({
      where: { id: cycleId },
      data: {
        recipientParticipantId,
        status: "COMPLETED",
        totalCollected: getTotalCollected(cycle.contributions),
      },
    });
  });

  revalidatePath(`/ekub/${groupId}`);
  revalidatePath(`/ekub/${groupId}/cycles/${cycleId}`);
}

export async function deleteEkubGroup(formData: FormData) {
  const groupId = Number(formData.get("groupId"));

  if (!Number.isFinite(groupId) || groupId <= 0) {
    throw new Error("Group ID is required.");
  }

  await getAuthorizedGroup(groupId);

  await prisma.ekubGroup.delete({
    where: { id: groupId },
  });

  revalidatePath("/ekub");
  redirect("/ekub");
}
