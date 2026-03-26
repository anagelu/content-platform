"use server";

import { auth } from "@/auth";
import {
  createMessageInboxItem,
  deleteMessageInboxItem,
} from "@/lib/message-inbox";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireSignedInUser() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return Number(session.user.id);
}

export async function importMessageInboxItem(formData: FormData) {
  const userId = await requireSignedInUser();
  const title = formData.get("title")?.toString().trim() || "";
  const sourceLabel = formData.get("sourceLabel")?.toString().trim() || "";
  const pastedConversation =
    formData.get("conversation")?.toString().trim() || "";
  const authorNotes = formData.get("authorNotes")?.toString().trim() || "";
  const uploadedFile = formData.get("conversationFile");
  let fileConversation = "";

  if (uploadedFile instanceof File && uploadedFile.size > 0) {
    fileConversation = (await uploadedFile.text()).trim();
  }

  const conversation = pastedConversation || fileConversation;

  if (!conversation) {
    throw new Error("Paste a conversation or upload a text-based conversation file.");
  }

  await createMessageInboxItem({
    userId,
    title,
    sourceLabel,
    conversation,
    authorNotes,
  });

  revalidatePath("/inbox/messages");
}

export async function removeMessageInboxItem(formData: FormData) {
  const userId = await requireSignedInUser();
  const id = Number(formData.get("id"));

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Inbox item ID is required.");
  }

  await deleteMessageInboxItem(userId, id);
  revalidatePath("/inbox/messages");
}
