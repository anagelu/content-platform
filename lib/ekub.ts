import {
  EkubCycleFrequency,
  EkubParticipantStatus,
  EkubPayoutMethod,
  type EkubContribution,
  type EkubParticipant,
  type EkubPayout,
} from "@prisma/client";

type ParticipantLike = Pick<
  EkubParticipant,
  "id" | "name" | "status" | "rotationOrder"
>;

type ContributionLike = Pick<
  EkubContribution,
  "participantId" | "amountPaid" | "isPaid" | "paidAt"
>;

type PayoutLike = Pick<EkubPayout, "recipientParticipantId">;

export function getCycleFrequencyLabel(value: EkubCycleFrequency) {
  return value === "WEEKLY" ? "Weekly" : "Monthly";
}

export function getPayoutMethodLabel(value: EkubPayoutMethod) {
  return value === "FIXED_ROTATION" ? "Fixed rotation" : "Random draw";
}

export function getParticipantStatusLabel(value: EkubParticipantStatus) {
  return value === "ACTIVE" ? "Active" : "Inactive";
}

export function getActiveParticipants<T extends ParticipantLike>(participants: T[]) {
  return participants.filter((participant) => participant.status === "ACTIVE");
}

export function calculatePotSize(contributionAmount: number, activeParticipantCount: number) {
  return contributionAmount * activeParticipantCount;
}

export function calculateCollectionProgress(
  contributions: ContributionLike[],
  activeParticipantCount: number,
) {
  if (activeParticipantCount <= 0) {
    return 0;
  }

  const paidCount = contributions.filter((contribution) => contribution.isPaid).length;
  return Math.round((paidCount / activeParticipantCount) * 100);
}

export function getTotalCollected(contributions: ContributionLike[]) {
  return contributions.reduce((sum, contribution) => sum + contribution.amountPaid, 0);
}

export function getReceivedParticipantIds(payouts: PayoutLike[]) {
  return new Set(payouts.map((payout) => payout.recipientParticipantId));
}

export function getEligibleRandomParticipants<T extends ParticipantLike>(
  participants: T[],
  payouts: PayoutLike[],
) {
  const activeParticipants = getActiveParticipants(participants);
  const receivedIds = getReceivedParticipantIds(payouts);
  const remaining = activeParticipants.filter((participant) => !receivedIds.has(participant.id));

  return remaining.length > 0 ? remaining : activeParticipants;
}

export function chooseRandomRecipient<T extends ParticipantLike>(
  participants: T[],
  payouts: PayoutLike[],
) {
  const eligible = getEligibleRandomParticipants(participants, payouts);

  if (eligible.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * eligible.length);
  return eligible[index] ?? null;
}

export function getNextRotationRecipient<T extends ParticipantLike>(
  participants: T[],
  payouts: PayoutLike[],
) {
  const activeParticipants = getActiveParticipants(participants).sort((a, b) => {
    const orderA = a.rotationOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.rotationOrder ?? Number.MAX_SAFE_INTEGER;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.id - b.id;
  });

  if (activeParticipants.length === 0) {
    return null;
  }

  const receivedIds = getReceivedParticipantIds(payouts);
  const remaining = activeParticipants.filter((participant) => !receivedIds.has(participant.id));

  return (remaining[0] ?? activeParticipants[0]) || null;
}

export function getNextCycleDueDate(
  previousDueDate: Date | null,
  frequency: EkubCycleFrequency,
) {
  const base = previousDueDate ? new Date(previousDueDate) : new Date();

  if (frequency === "WEEKLY") {
    base.setDate(base.getDate() + 7);
    return base;
  }

  base.setMonth(base.getMonth() + 1);
  return base;
}

export function parsePositiveNumber(value: FormDataEntryValue | null, label: string) {
  const parsed = Number(value?.toString().trim() || "");

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }

  return parsed;
}

export function parseOptionalDate(value: FormDataEntryValue | null) {
  const raw = value?.toString().trim();

  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
