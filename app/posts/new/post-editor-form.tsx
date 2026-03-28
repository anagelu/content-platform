"use client";

import { useRef, useState } from "react";
import { inferCategoryNameFromText } from "@/lib/category-inference";
import { generateQuickDraftFromSourceChat } from "@/lib/local-draft";
import { POST_NOTE_PRESETS } from "@/lib/post-note-presets";
import {
  POST_TO_TRADING_DRAFT_KEY,
  type PostToTradingDraft,
} from "@/lib/trading-draft-transfer";
import { createPost } from "./actions";

const MAX_AI_SOURCE_CHARS = 6000;

function buildLongSourceError() {
  return `This AI draft flow works best under ${MAX_AI_SOURCE_CHARS} characters. If the original session is longer, condense it first or ask the source AI to summarize the main idea, key turns, and final takeaways.`;
}

type CategoryOption = {
  id: number;
  name: string;
};

export function PostEditorForm({
  categories,
  aiDraftEnabled,
  aiProviderLabel,
  aiTierLabel,
  initialTitle = "",
  initialSourceChat = "",
  initialAuthorNotes = "",
}: {
  categories: CategoryOption[];
  aiDraftEnabled: boolean;
  aiProviderLabel: string;
  aiTierLabel: string;
  initialTitle?: string;
  initialSourceChat?: string;
  initialAuthorNotes?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingWithAi, setIsGeneratingWithAi] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationNote, setGenerationNote] = useState("");
  const [suggestedCategoryName, setSuggestedCategoryName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [reviewVisible, setReviewVisible] = useState(false);
  const [draftTitle, setDraftTitle] = useState(initialTitle);
  const [draftSummary, setDraftSummary] = useState("");
  const [draftPresentationOutline, setDraftPresentationOutline] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [authorNotesValue, setAuthorNotesValue] = useState(initialAuthorNotes);
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
    setSuggestedCategoryName(inferCategoryNameFromText([sourceChat, authorNotes].join("\n\n")));

    try {
      const result = generateQuickDraftFromSourceChat({
        title,
        sourceChat: [sourceChat, authorNotes].filter(Boolean).join("\n\n"),
      });
      setDraftTitle((current) => current.trim() || result.title);
      setDraftSummary(result.summary);
      setDraftContent(result.article);
      setDraftPresentationOutline("");

      setReviewVisible(true);
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

    if (sourceChat.length > MAX_AI_SOURCE_CHARS) {
      setGenerationError(buildLongSourceError());
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
      if (payload.title) {
        setDraftTitle(payload.title);
      }

      if (payload.summary) {
        setDraftSummary(payload.summary);
      }

      if (payload.article) {
        setDraftContent(payload.article);
      }

      if (payload.presentationOutline) {
        setDraftPresentationOutline(payload.presentationOutline);
      }

      setReviewVisible(true);

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

    const sourceChat = (form.elements.namedItem("sourceChat") as HTMLTextAreaElement | null)?.value ?? "";
    const authorNotes = (form.elements.namedItem("authorNotes") as HTMLTextAreaElement | null)?.value ?? "";
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

  function handleApplyNotesPreset(notes: string) {
    setAuthorNotesValue(notes);
  }

  return (
    <div className="form-card">
      <form ref={formRef} action={createPost}>
        <div className="form-callout">
          <h2 className="form-callout-title">Conversation to Post</h2>
          <p className="form-callout-text">
            Start with the raw material first. Then add your own perspective,
            generate a draft, and refine the post before publishing it.
          </p>
        </div>

        <section className="post-step-card">
          <div className="post-step-heading">
            <p className="home-section-kicker">Step 1</p>
            <h2 className="trading-section-title">Paste your conversation</h2>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <p className="form-help">
              Paste the raw conversation exactly as you have it. This is the primary source for the draft.
            </p>
            <textarea
              id="sourceChat"
              name="sourceChat"
              rows={14}
              className="form-textarea"
              placeholder="Paste your conversation here..."
              defaultValue={initialSourceChat}
            />
          </div>
        </section>

        <section className="post-step-card">
          <div className="post-step-heading">
            <p className="home-section-kicker">Step 2</p>
            <h2 className="trading-section-title">Add your perspective (optional)</h2>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <p className="form-help">
              Strongly recommended: add a thoughtful note here. This is where your originality should shine. Use the generator like pen and paper, not as a substitute for your point of view.
            </p>
            <div className="post-note-preset-row" aria-label="Author note presets">
              {POST_NOTE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="button-link secondary post-note-preset-button"
                  onClick={() => handleApplyNotesPreset(preset.notes)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <p className="form-help">
              Presets are editable starting points. Apply one, then rewrite it in your own words.
            </p>
            <textarea
              id="authorNotes"
              name="authorNotes"
              rows={6}
              className="form-textarea form-textarea-compact"
              placeholder="What is your real angle, takeaway, or opinion here? What should be emphasized, cut, challenged, or made more original?"
              value={authorNotesValue}
              onChange={(event) => setAuthorNotesValue(event.target.value)}
            />
          </div>
        </section>

        <section className="post-step-card">
          <div className="post-step-heading">
            <p className="home-section-kicker">Step 3</p>
            <h2 className="trading-section-title">Generate</h2>
          </div>
          <p className="form-help generate-help">
            We&apos;ll create a structured draft from your input.
          </p>

          <div className="generate-row">
            <button
              type="button"
              className="button-link secondary"
              onClick={handleGenerateDraft}
              disabled={isGenerating || isGeneratingWithAi}
            >
              {isGenerating ? "Building Quick Draft..." : "Quick Draft"}
            </button>

            {!reviewVisible ? (
              <button
                type="button"
                className="button-link"
                onClick={handleGenerateDraftWithAi}
                disabled={!aiDraftEnabled || isGenerating || isGeneratingWithAi}
              >
                {isGeneratingWithAi ? "Generating your draft..." : "Generate with AI"}
              </button>
            ) : null}
          </div>
        </section>

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

        {reviewVisible ? (
          <section className="post-step-card">
            <div className="post-step-heading">
              <p className="home-section-kicker">Step 4</p>
              <h2 className="trading-section-title">Review & Edit</h2>
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
                className="form-input"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="summary" className="form-label">
                Summary
              </label>
              <p className="form-help">
                Use 1 to 3 sentences that capture the main idea for cards and previews.
              </p>
              <textarea
                id="summary"
                name="summary"
                rows={4}
                className="form-textarea form-textarea-compact"
                placeholder="A concise version of the idea, argument, or takeaway."
                value={draftSummary}
                onChange={(event) => setDraftSummary(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="presentationOutline" className="form-label">
                Presentation outline
              </label>
              <p className="form-help">
                Optional speaker outline generated from the conversation. This stays as prep material.
              </p>
              <textarea
                id="presentationOutline"
                name="presentationOutline"
                rows={6}
                className="form-textarea form-textarea-compact"
                placeholder="A short presentation outline will appear here."
                value={draftPresentationOutline}
                onChange={(event) => setDraftPresentationOutline(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="content" className="form-label">
                Article or essay
              </label>
              <p className="form-help">
                Edit the cleaned-up version readers should see. Markdown is supported.
              </p>
              <textarea
                id="content"
                name="content"
                required
                rows={18}
                className="form-textarea"
                value={draftContent}
                onChange={(event) => setDraftContent(event.target.value)}
                placeholder={`## Opening idea

Start with the main insight or question.

## Why it matters

Explain the argument in clear language.

## Supporting points

- Key point one
- Key point two
- Key point three

## Conclusion

End with the takeaway or next step.`}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="categoryId" className="form-label">
                Category
              </label>
              <select
                id="categoryId"
                name="categoryId"
                defaultValue=""
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
                <p className="form-help">
                  Suggested category: {suggestedCategoryName}
                </p>
              ) : (
                <p className="form-help">
                  Keep categories broad. The app can suggest one from the conversation.
                </p>
              )}
            </div>

            {isTradingSelected ? (
              <div className="form-callout" style={{ marginTop: "1.25rem", marginBottom: 0 }}>
                <h2 className="form-callout-title">Trading Works Better In Trading</h2>
                <p className="form-callout-text">
                  The Trading section includes market, ticker, direction, setup,
                  entry, stop, target, and workflow fields that a normal post does
                  not. You can keep working here, or move this conversation into
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

            <div className="toolbar" style={{ marginTop: "1.5rem", marginBottom: 0 }}>
              <button type="submit" className="submit-button">
                Create Post
              </button>
            </div>
          </section>
        ) : null}
      </form>
    </div>
  );
}
