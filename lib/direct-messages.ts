import { prisma } from "@/lib/prisma";

function sortParticipantIds(left: number, right: number) {
  return left < right ? [left, right] : [right, left];
}

function buildThreadLabel(name: string | null | undefined, username: string) {
  return name?.trim() || username;
}

export async function listDirectMessageCandidates(userId: number) {
  return prisma.user.findMany({
    where: {
      id: { not: userId },
    },
    orderBy: [{ name: "asc" }, { username: "asc" }],
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
    },
  });
}

export async function listDirectMessageThreads(userId: number) {
  const threads = await prisma.directMessageThread.findMany({
    where: {
      OR: [{ participantAId: userId }, { participantBId: userId }],
    },
    include: {
      participantA: {
        select: { id: true, name: true, username: true },
      },
      participantB: {
        select: { id: true, name: true, username: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          body: true,
          createdAt: true,
          senderId: true,
          readAt: true,
        },
      },
      _count: {
        select: {
          messages: {
            where: {
              senderId: { not: userId },
              readAt: null,
            },
          },
        },
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  return threads.map((thread) => {
    const counterpart =
      thread.participantAId === userId ? thread.participantB : thread.participantA;
    const lastMessage = thread.messages[0] ?? null;

    return {
      id: thread.id,
      subject: thread.subject,
      lastMessageAt: thread.lastMessageAt,
      counterpart,
      counterpartLabel: buildThreadLabel(counterpart.name, counterpart.username),
      unreadCount: thread._count.messages,
      lastMessage,
    };
  });
}

export async function getDirectMessageThread(userId: number, threadId: number) {
  const thread = await prisma.directMessageThread.findFirst({
    where: {
      id: threadId,
      OR: [{ participantAId: userId }, { participantBId: userId }],
    },
    include: {
      participantA: {
        select: { id: true, name: true, username: true, email: true },
      },
      participantB: {
        select: { id: true, name: true, username: true, email: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: {
            select: { id: true, name: true, username: true },
          },
        },
      },
    },
  });

  if (!thread) {
    return null;
  }

  const counterpart =
    thread.participantAId === userId ? thread.participantB : thread.participantA;

  return {
    ...thread,
    counterpart,
    counterpartLabel: buildThreadLabel(counterpart.name, counterpart.username),
  };
}

export async function markDirectThreadRead(userId: number, threadId: number) {
  await prisma.directMessage.updateMany({
    where: {
      threadId,
      senderId: { not: userId },
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
}

export async function createOrGetDirectMessageThread(input: {
  senderId: number;
  recipientId: number;
  subject?: string;
  initialBody?: string;
}) {
  const { senderId, recipientId, subject = "", initialBody = "" } = input;

  if (senderId === recipientId) {
    throw new Error("You cannot message yourself.");
  }

  const [participantAId, participantBId] = sortParticipantIds(senderId, recipientId);
  const trimmedSubject = subject.trim();
  const trimmedBody = initialBody.trim();

  const existing = await prisma.directMessageThread.findUnique({
    where: {
      participantAId_participantBId: {
        participantAId,
        participantBId,
      },
    },
  });

  if (existing) {
    if (trimmedBody) {
      await prisma.directMessage.create({
        data: {
          threadId: existing.id,
          senderId,
          body: trimmedBody,
        },
      });

      await prisma.directMessageThread.update({
        where: { id: existing.id },
        data: {
          lastMessageAt: new Date(),
          subject: existing.subject || trimmedSubject || null,
        },
      });
    }

    return existing.id;
  }

  const created = await prisma.directMessageThread.create({
    data: {
      starterId: senderId,
      participantAId,
      participantBId,
      subject: trimmedSubject || null,
      lastMessageAt: new Date(),
      messages: trimmedBody
        ? {
            create: {
              senderId,
              body: trimmedBody,
            },
          }
        : undefined,
    },
  });

  return created.id;
}

export async function sendDirectMessage(input: {
  senderId: number;
  threadId: number;
  body: string;
}) {
  const { senderId, threadId, body } = input;
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    throw new Error("Message text is required.");
  }

  const thread = await prisma.directMessageThread.findFirst({
    where: {
      id: threadId,
      OR: [{ participantAId: senderId }, { participantBId: senderId }],
    },
    select: {
      id: true,
    },
  });

  if (!thread) {
    throw new Error("Conversation not found.");
  }

  await prisma.$transaction([
    prisma.directMessage.create({
      data: {
        threadId,
        senderId,
        body: trimmedBody,
      },
    }),
    prisma.directMessageThread.update({
      where: { id: threadId },
      data: {
        lastMessageAt: new Date(),
      },
    }),
  ]);
}
