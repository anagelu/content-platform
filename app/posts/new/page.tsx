import { prisma } from "@/lib/prisma";
import { ensureDefaultCategories } from "@/lib/categories";
import Link from "next/link";
import { auth } from "@/auth";
import {
  getAiCapacityTier,
  getAiProvider,
  getProviderLabel,
  getTierLabel,
  isAiProviderConfigured,
} from "@/lib/ai-admin";
import { redirect } from "next/navigation";
import { PostEditorForm } from "./post-editor-form";
import { getMessageInboxItem } from "@/lib/message-inbox";

export default async function NewPostPage({
  searchParams,
}: {
  searchParams?: Promise<{
    inboxId?: string;
    idea?: string;
  }>;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const inboxId = Number(params?.inboxId);
  const seededIdea = params?.idea?.trim() || "";
  const inboxItem =
    Number.isFinite(inboxId) && inboxId > 0
      ? await getMessageInboxItem(Number(session.user.id), inboxId)
      : null;

  await ensureDefaultCategories();

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });
  const [aiDraftEnabled, aiProvider, aiTier] = await Promise.all([
    isAiProviderConfigured(),
    getAiProvider(),
    getAiCapacityTier(),
  ]);

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">Create New Post</h1>
        <p className="page-subtitle">
          Paste a raw AI conversation, shape it into an article or essay, and
          keep a short summary for previews.
        </p>

        <div className="toolbar">
          <Link href="/posts" className="button-link secondary">
            Back to Posts
          </Link>
          <Link href="/inbox/messages" className="button-link secondary">
            Open Message Inbox
          </Link>
        </div>

        <PostEditorForm
          categories={categories}
          aiDraftEnabled={aiDraftEnabled}
          aiProviderLabel={getProviderLabel(aiProvider)}
          aiTierLabel={getTierLabel(aiTier)}
          initialTitle={inboxItem?.title ?? ""}
          initialSourceChat={inboxItem?.conversation ?? seededIdea}
          initialAuthorNotes={inboxItem?.authorNotes ?? ""}
        />
      </div>
    </main>
  );
}
