import { auth } from "@/auth";
import {
  getAiCapacityTier,
  getAiProvider,
  getProviderLabel,
  getTierLabel,
  isAiProviderConfigured,
} from "@/lib/ai-admin";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createBook } from "../actions";
import { BookEditorForm } from "../book-editor-form";

export default async function NewBookPage({
  searchParams,
}: {
  searchParams?: Promise<{
    idea?: string;
  }>;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const seededIdea = params?.idea?.trim() || "";

  const [aiDraftEnabled, aiProvider, aiTier] = await Promise.all([
    isAiProviderConfigured(),
    getAiProvider(),
    getAiCapacityTier(),
  ]);

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">Create New Book</h1>
        <p className="page-subtitle">
          Start with a questionnaire, choose a title, then build the manuscript through an editable outline and section editor.
        </p>

        <div className="toolbar">
          <Link href="/books" className="button-link secondary">
            Back to Books
          </Link>
          <Link href="/posts/new" className="button-link secondary">
            Open Post Editor
          </Link>
        </div>

        <BookEditorForm
          mode="create"
          submitAction={createBook}
          aiDraftEnabled={aiDraftEnabled}
          aiProviderLabel={getProviderLabel(aiProvider)}
          aiTierLabel={getTierLabel(aiTier)}
          initialSeedSourceDraft={seededIdea}
        />
      </div>
    </main>
  );
}
