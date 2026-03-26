import { auth } from "@/auth";
import {
  getAiCapacityTier,
  getAiProvider,
  getProviderLabel,
  getTierLabel,
  isAiProviderConfigured,
} from "@/lib/ai-admin";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BookEditorForm } from "../../book-editor-form";
import { updateBook } from "../../actions";

export default async function EditBookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { slug } = await params;
  const book = await prisma.book.findUnique({
    where: { slug },
    include: {
      sections: {
        where: {
          parentSectionId: null,
        },
        orderBy: { position: "asc" },
        include: {
          subsections: {
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });

  if (!book) {
    return <div style={{ padding: "2rem" }}>Book not found.</div>;
  }

  const userId = Number(session.user.id);
  const canManage = session.user.role === "admin" || book.authorId === userId;

  if (!canManage) {
    return <div style={{ padding: "2rem" }}>Book not found.</div>;
  }

  const [aiDraftEnabled, aiProvider, aiTier] = await Promise.all([
    isAiProviderConfigured(),
    getAiProvider(),
    getAiCapacityTier(),
  ]);

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">Edit Book</h1>
        <p className="page-subtitle">
          Update the questionnaire, refine the outline, and keep each section easy to navigate.
        </p>

        <BookEditorForm
          mode="edit"
          submitAction={updateBook}
          aiDraftEnabled={aiDraftEnabled}
          aiProviderLabel={getProviderLabel(aiProvider)}
          aiTierLabel={getTierLabel(aiTier)}
          initialBook={book}
        />
      </div>
    </main>
  );
}
