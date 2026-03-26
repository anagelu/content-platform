"use client";

import { useRef, useState } from "react";
import { inferCategoryNameFromText } from "@/lib/category-inference";
import { generateQuickDraftFromSourceChat } from "@/lib/local-draft";
import {
  POST_TO_TRADING_DRAFT_KEY,
  type PostToTradingDraft,
} from "@/lib/trading-draft-transfer";
import { updatePost } from "./actions";

type CategoryOption = {
  id: number;
  name: string;
};

export function EditPostForm({
  post,
  categories,
  aiDraftEnabled,
  aiProviderLabel,
  aiTierLabel,
}: {
  post: {
    id: number;
    title: string;
    summary: string | null;
    body: string;
    sourceChat: string | null;
    categoryId: number | null;
  };
  categories: CategoryOption[];
  aiDraftEnabled: boolean;
  aiProviderLabel: string;
  aiTierLabel: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingWithAi, setIsGeneratingWithAi] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationNote, setGenerationNote] = useState("");
  const [suggestedCategoryName, setSuggestedCategoryName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    post.categoryId ? String(post.categoryId) : "",
  );
  const tradingCategory = categories.find(
    (category) => category.name.toLowerCase() === "trading",
  );
  const isTradingSelected = tradingCategory
    ? selectedCategoryId === String(tradingCategory.id)
    : false;

  function handleGenerateDraft() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const title = formData.get("title")?.toString().trim() || "";
    const sourceChat = formData.get("sourceChat")?.toString().trim() || "";
    const authorNotes = formData.get("authorNotes")?.toString().trim() || "";

    if (!sourceChat) {
      setGenerationError("Paste the AI conversation first.");
      return;
    }

    setIsGenerating(true);
    setGenerationError("");
    setGenerationNote("");
    setSuggestedCategoryName(
      inferCategoryNameFromText([sourceChat, authorNotes].join("\n\n")),
    );

    try {
      const result = generateQuickDraftFromSourceChat({
        title,
        sourceChat: [sourceChat, authorNotes].filter(Boolean).join("\n\n"),
      });

      const titleInput = form.elements.namedItem("title") as
        | HTMLInputElement
        | null;
      const summaryInput = form.elements.namedItem("summary") as
        | HTMLTextAreaElement
        | null;
      const contentInput = form.elements.namedItem("content") as
        | HTMLTextAreaElement
        | null;

      if (titleInput && !titleInput.value.trim()) {
        titleInput.value = result.title;
      }

      if (summaryInput) {
        summaryInput.value = result.summary;
      }

      if (contentInput) {
        contentInput.value = result.article;
      }
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Something went wrong while generating the quick summary.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerateDraftWithAi() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const title = formData.get("title")?.toString().trim() || "";
    const sourceChat = formData.get("sourceChat")?.toString().trim() || "";
    const authorNotes = formData.get("authorNotes")?.toString().trim() || "";

    if (!sourceChat) {
      setGenerationError("Paste the AI conversation first.");
      return;
    }

    setIsGeneratingWithAi(true);
    setGenerationError("");
    setGenerationNote("");
    setSuggestedCategoryName(inferCategoryNameFromText([sourceChat, authorNotes].join("\n\n")));

    try {
      const response = await fetch("/api/ai/post-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          sourceChat,
          authorNotes,
        }),
      });

      const payload = (await response.json()) as {
        title?: string;
        summary?: string;
        presentationOutline?: string;
        article?: string;
        model?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "AI draft generation failed.");
      }

      const titleInput = form.elements.namedItem("title") as HTMLInputElement | null;
      const summaryInput = form.elements.namedItem("summary") as
        | HTMLTextAreaElement
        | null;
      const contentInput = form.elements.namedItem("content") as
        | HTMLTextAreaElement
        | null;
      const outlineInput = form.elements.namedItem("presentationOutline") as
        | HTMLTextAreaElement
        | null;

      if (titleInput && payload.title) {
        titleInput.value = payload.title;
      }

      if (summaryInput && payload.summary) {
        summaryInput.value = payload.summary;
      }

      if (contentInput && payload.article) {
        contentInput.value = payload.article;
      }

      if (outlineInput && payload.presentationOutline) {
        outlineInput.value = payload.presentationOutline;
      }

      setGenerationNote(
        payload.model
          ? `AI draft loaded with ${payload.model}. It fills the summary, presentation outline, and article under 500 words.`
          : "AI draft loaded.",
      );
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Something went wrong while generating the AI draft.",
      );
    } finally {
      setIsGeneratingWithAi(false);
      }
  }

  function handleSuggestCategory() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const sourceChat =
      (form.elements.namedItem("sourceChat") as HTMLTextAreaElement | null)?.value ?? "";
    const authorNotes =
      (form.elements.namedItem("authorNotes") as HTMLTextAreaElement | null)?.value ?? "";
    const suggestedName = inferCategoryNameFromText([sourceChat, authorNotes].join("\n\n"));
    setSuggestedCategoryName(suggestedName);

    if (!suggestedName) {
      return;
    }

    const categorySelect = form.elements.namedItem("categoryId") as
      | HTMLSelectElement
      | null;

    const matchedCategory = categories.find(
      (category) => category.name.toLowerCase() === suggestedName.toLowerCase(),
    );

    if (categorySelect && matchedCategory) {
      categorySelect.value = String(matchedCategory.id);
      setSelectedCategoryId(String(matchedCategory.id));
    }
  }

  function handleContinueToTrading() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const draft: PostToTradingDraft = {
      title: formData.get("title")?.toString().trim() || "",
      sourceChat: formData.get("sourceChat")?.toString().trim() || "",
      authorNotes: formData.get("authorNotes")?.toString().trim() || "",
    };
    window.sessionStorage.setItem(POST_TO_TRADING_DRAFT_KEY, JSON.stringify(draft));
    window.location.assign("/trading/new?from=posts");
  }

  return (
    <div className="form-card">
      <form ref={formRef} action={updatePost}>
        <input type="hidden" name="id" value={post.id} />

        <div className="form-callout">
          <h2 className="form-callout-title">Conversation to Post</h2>
          <p className="form-callout-text">
            Update the pasted AI conversation, adjust the category, add your
            own note, and regenerate the summary, presentation outline, and
            short article if needed.
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="title" className="form-label">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={post.title}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="categoryId" className="form-label">
            Category
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={post.categoryId ?? ""}
            className="form-select"
            onChange={(event) => setSelectedCategoryId(event.target.value)}
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <div className="toolbar" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
            <button
              type="button"
              className="button-link secondary"
              onClick={handleSuggestCategory}
            >
              Suggest Category
            </button>
          </div>
          {suggestedCategoryName ? (
            <p className="form-help">Suggested category: {suggestedCategoryName}</p>
          ) : (
            <p className="form-help">
              Keep categories broad. The app can suggest one from the conversation.
            </p>
          )}
        </div>

        {isTradingSelected ? (
          <div className="form-callout">
            <h2 className="form-callout-title">Trading Works Better In Trading</h2>
            <p className="form-callout-text">
              The Trading section includes market, ticker, direction, setup,
              entry, stop, target, and workflow fields that a normal post does
              not. You can keep editing here, or move this conversation into
              the Trading Session form.
            </p>
            <div className="toolbar" style={{ marginTop: "1rem", marginBottom: 0 }}>
              <button
                type="button"
                className="button-link"
                onClick={handleContinueToTrading}
              >
                Continue In Trading Session
              </button>
            </div>
          </div>
        ) : null}

        <div className="form-group">
          <label htmlFor="sourceChat" className="form-label">
            AI conversation
          </label>
          <p className="form-help">
            Paste the raw conversation exactly as you have it.
          </p>
          <textarea
            id="sourceChat"
            name="sourceChat"
            rows={12}
            defaultValue={post.sourceChat ?? ""}
            className="form-textarea"
          />
        </div>

        <div className="form-group">
          <label htmlFor="authorNotes" className="form-label">
            Your note
          </label>
          <p className="form-help">
            Strongly recommended: add a thoughtful note here. This is where your originality should shine. Use the generator like pen and paper, not as a substitute for your point of view.
          </p>
          <textarea
            id="authorNotes"
            name="authorNotes"
            rows={6}
            className="form-textarea form-textarea-compact"
            placeholder="What is your real angle, takeaway, or opinion here? What should be emphasized, cut, challenged, or made more original?"
          />
        </div>

        <div className="generate-row">
          <button
            type="button"
            className="button-link"
            onClick={handleGenerateDraft}
            disabled={isGenerating || isGeneratingWithAi}
          >
            {isGenerating ? "Formatting Conversation..." : "Quick Local Draft"}
          </button>

          <button
            type="button"
            className="button-link secondary"
            onClick={handleGenerateDraftWithAi}
            disabled={!aiDraftEnabled || isGenerating || isGeneratingWithAi}
          >
            {isGeneratingWithAi ? "Generating AI Draft..." : "Generate With AI"}
          </button>

          <p className="form-help generate-help">
            The quick draft uses local heuristics. The AI draft fills the
            summary, presentation outline, and short article.
          </p>
        </div>

        {aiDraftEnabled ? (
          <p className="form-help">
            AI is enabled. Provider: {aiProviderLabel}. Tier: {aiTierLabel}.
            It will generate a summary, presentation outline, and an article
            capped under 500 words.
          </p>
        ) : (
          <p className="form-help">
            AI is disabled. Configure the selected provider key in admin to enable draft generation here.
          </p>
        )}

        {generationError ? <p className="form-error">{generationError}</p> : null}
        {generationNote ? <p className="form-help">{generationNote}</p> : null}

        <div className="form-group">
          <label htmlFor="summary" className="form-label">
            Summary
          </label>
          <p className="form-help">
            Leave blank to regenerate a summary from the article content.
          </p>
          <textarea
            id="summary"
            name="summary"
            rows={4}
            defaultValue={post.summary ?? ""}
            className="form-textarea form-textarea-compact"
          />
        </div>

        <div className="form-group">
          <label htmlFor="presentationOutline" className="form-label">
            Presentation outline
          </label>
          <p className="form-help">
            Optional speaker outline generated from the conversation. This is
            for prep and is not currently published as part of the post.
          </p>
          <textarea
            id="presentationOutline"
            name="presentationOutline"
            rows={6}
            className="form-textarea form-textarea-compact"
            placeholder="A short presentation outline will appear here."
          />
        </div>

        <div className="form-group">
          <label htmlFor="content" className="form-label">
            Article or essay
          </label>
          <p className="form-help">
            This is the polished version readers will see on the post page.
          </p>
          <textarea
            id="content"
            name="content"
            required
            rows={18}
            defaultValue={post.body}
            className="form-textarea"
          />
        </div>

        <button type="submit" className="submit-button">
          Update Post
        </button>
      </form>
    </div>
  );
}
