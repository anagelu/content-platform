"use client";

import { startTransition, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { saveInlinePostDraft } from "./actions";

type IterationIntent =
  | "regenerate"
  | "improve"
  | "shorter"
  | "detailed"
  | "simplify"
  | "persuasive"
  | "tone";

const ITERATION_MESSAGES: Record<IterationIntent, string> = {
  regenerate:
    "Regenerate is a good next step when the structure is right but the current draft missed the strongest version of the idea.",
  improve:
    "Improve writing is useful when the draft has the right argument but needs cleaner rhythm, sharper phrasing, or stronger transitions.",
  shorter:
    "Make shorter is best when the core point is already strong and you want a tighter, faster version without losing the main takeaway.",
  detailed:
    "Make more detailed is best when the idea is promising but still needs examples, explanation, or supporting context.",
  simplify:
    "Simplify is best when the draft feels too dense, too abstract, or harder to follow than it should be.",
  persuasive:
    "Make more persuasive is best when the core point is clear but the argument needs more conviction and force.",
  tone:
    "Change tone lets you shift how the draft sounds without rewriting the core meaning from scratch.",
};

const TONE_OPTIONS = ["professional", "casual", "persuasive", "technical"] as const;
const LENGTH_OPTIONS = ["shorter", "same", "longer"] as const;
const FOCUS_OPTIONS = ["clarity", "detail", "emotion", "argument"] as const;

export function PostDraftWorkspace({
  id,
  slug,
  title,
  summary,
  body,
  sourceChat,
  authorNotes,
  canManage,
}: {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  sourceChat: string | null;
  authorNotes: string | null;
  canManage: boolean;
}) {
  const [draftBody, setDraftBody] = useState(body);
  const [draftSummary, setDraftSummary] = useState(summary ?? "");
  const [committedBody, setCommittedBody] = useState(body);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isIterating, setIsIterating] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const [iterationIntent, setIterationIntent] = useState<IterationIntent | null>(null);
  const [selectedTone, setSelectedTone] = useState<(typeof TONE_OPTIONS)[number]>("professional");
  const [selectedLength, setSelectedLength] = useState<(typeof LENGTH_OPTIONS)[number]>("same");
  const [selectedFocus, setSelectedFocus] = useState<(typeof FOCUS_OPTIONS)[number]>("clarity");
  const [instruction, setInstruction] = useState("");
  const [advancedEnabled, setAdvancedEnabled] = useState(false);
  const [advancedPrompt, setAdvancedPrompt] = useState("");

  function handleSaveInlineEdit() {
    const formData = new FormData();
    formData.set("id", String(id));
    formData.set("slug", slug);
    formData.set("body", draftBody);

    setIsSaving(true);
    setSaveNote("");

    startTransition(async () => {
      try {
        const result = await saveInlinePostDraft(formData);
        setSaveNote(
          `Draft updated${result.updatedAt ? ` at ${new Date(result.updatedAt).toLocaleString()}` : ""}.`,
        );
        setCommittedBody(draftBody);
        setIsEditing(false);
      } catch (error) {
        setSaveNote(
          error instanceof Error ? error.message : "Unable to save the inline draft right now.",
        );
      } finally {
        setIsSaving(false);
      }
    });
  }

  async function handleIteration(
    intent: IterationIntent,
    options?: {
      tone?: (typeof TONE_OPTIONS)[number];
      length?: (typeof LENGTH_OPTIONS)[number];
      focus?: (typeof FOCUS_OPTIONS)[number];
      instruction?: string;
      advancedPrompt?: string;
    },
  ) {
    setIterationIntent(intent);
    setIsIterating(true);
    setSaveNote("");

    try {
      const response = await fetch("/api/ai/post-refine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          sourceChat,
          authorNotes,
          currentSummary: draftSummary,
          currentArticle: draftBody,
          intent,
          tone: options?.tone ?? selectedTone,
          length: options?.length ?? selectedLength,
          focus: options?.focus ?? selectedFocus,
          instruction: options?.instruction ?? instruction,
          advancedPrompt: options?.advancedPrompt ?? (advancedEnabled ? advancedPrompt : ""),
        }),
      });

      const payload = (await response.json()) as {
        summary?: string;
        article?: string;
        model?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to refine this draft right now.");
      }

      if (payload.summary) {
        setDraftSummary(payload.summary);
      }

      if (payload.article) {
        setDraftBody(payload.article);
        setCommittedBody(payload.article);
      }

      setSaveNote(
        payload.model
          ? `Draft updated with ${payload.model}.`
          : "Draft updated.",
      );
      setIsEditing(false);
    } catch (error) {
      setSaveNote(
        error instanceof Error ? error.message : "Unable to refine this draft right now.",
      );
    } finally {
      setIsIterating(false);
    }
  }

  return (
    <>
      <div className="article-draft-status">
        <span className="badge article-draft-badge">
          {sourceChat?.trim() ? "Generated from conversation" : "AI-assisted draft"}
        </span>
        <p className="article-draft-message">
          Your idea is now a structured draft. Keep refining it until it sounds unmistakably like you.
        </p>
      </div>

      {draftSummary ? (
        <section className="article-summary-card">
          <p className="article-summary-label">Summary</p>
          <p className="article-summary">{draftSummary}</p>
        </section>
      ) : null}

      <section className="article-iteration-panel">
        <div>
          <h2 className="trading-section-title" style={{ marginBottom: "0.35rem" }}>
            Refine this draft
          </h2>
          <p className="meta" style={{ marginBottom: 0 }}>
            Iterate before you treat this as final.
          </p>
        </div>
        <div className="article-iteration-actions">
          <button
            type="button"
            className={iterationIntent === "regenerate" ? "reaction-button article-iteration-button is-active" : "reaction-button article-iteration-button"}
            onClick={() => handleIteration("regenerate")}
            disabled={isIterating}
          >
            {isIterating && iterationIntent === "regenerate" ? "Regenerating..." : "Regenerate"}
          </button>
          <button
            type="button"
            className={iterationIntent === "improve" ? "reaction-button article-iteration-button is-active" : "reaction-button article-iteration-button"}
            onClick={() => handleIteration("improve")}
            disabled={isIterating}
          >
            {isIterating && iterationIntent === "improve" ? "Improving..." : "Improve writing"}
          </button>
          <button
            type="button"
            className={iterationIntent === "shorter" ? "reaction-button article-iteration-button is-active" : "reaction-button article-iteration-button"}
            onClick={() => handleIteration("shorter")}
            disabled={isIterating}
          >
            {isIterating && iterationIntent === "shorter" ? "Shortening..." : "Make shorter"}
          </button>
          <button
            type="button"
            className={iterationIntent === "detailed" ? "reaction-button article-iteration-button is-active" : "reaction-button article-iteration-button"}
            onClick={() => handleIteration("detailed")}
            disabled={isIterating}
          >
            {isIterating && iterationIntent === "detailed" ? "Expanding..." : "Make more detailed"}
          </button>
          <button
            type="button"
            className={iterationIntent === "simplify" ? "reaction-button article-iteration-button is-active" : "reaction-button article-iteration-button"}
            onClick={() => handleIteration("simplify")}
            disabled={isIterating}
          >
            {isIterating && iterationIntent === "simplify" ? "Simplifying..." : "Simplify"}
          </button>
          <button
            type="button"
            className={iterationIntent === "persuasive" ? "reaction-button article-iteration-button is-active" : "reaction-button article-iteration-button"}
            onClick={() => handleIteration("persuasive")}
            disabled={isIterating}
          >
            {isIterating && iterationIntent === "persuasive" ? "Strengthening..." : "Make more persuasive"}
          </button>
          <button
            type="button"
            className={iterationIntent === "tone" ? "reaction-button article-iteration-button is-active" : "reaction-button article-iteration-button"}
            onClick={() => handleIteration("tone", { tone: selectedTone })}
            disabled={isIterating}
          >
            {isIterating && iterationIntent === "tone" ? "Changing tone..." : "Change tone"}
          </button>
        </div>
        {iterationIntent ? (
          <p className="article-iteration-note">{ITERATION_MESSAGES[iterationIntent]}</p>
        ) : null}

        <details className="tool-disclosure article-refine-disclosure">
          <summary className="tool-disclosure-summary">
            <div className="tool-disclosure-copy">
              <h3 className="card-title" style={{ marginBottom: "0.35rem" }}>
                Refine with more control
              </h3>
              <p className="meta" style={{ marginBottom: 0 }}>
                Layer tone, length, focus, and optional instructions without writing a full prompt.
              </p>
            </div>
            <span className="tool-disclosure-hint">Adjust</span>
          </summary>
          <div className="tool-disclosure-content">
            <div className="article-refine-grid">
              <div className="form-group">
                <label htmlFor="post-refine-tone" className="form-label">
                  Tone
                </label>
                <select
                  id="post-refine-tone"
                  className="form-select"
                  value={selectedTone}
                  onChange={(event) => setSelectedTone(event.target.value as (typeof TONE_OPTIONS)[number])}
                >
                  {TONE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option[0]?.toUpperCase()}{option.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="post-refine-length" className="form-label">
                  Length
                </label>
                <select
                  id="post-refine-length"
                  className="form-select"
                  value={selectedLength}
                  onChange={(event) => setSelectedLength(event.target.value as (typeof LENGTH_OPTIONS)[number])}
                >
                  {LENGTH_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option[0]?.toUpperCase()}{option.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="post-refine-focus" className="form-label">
                  Focus
                </label>
                <select
                  id="post-refine-focus"
                  className="form-select"
                  value={selectedFocus}
                  onChange={(event) => setSelectedFocus(event.target.value as (typeof FOCUS_OPTIONS)[number])}
                >
                  {FOCUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option[0]?.toUpperCase()}{option.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="post-refine-instruction" className="form-label">
                Add any specific instruction
              </label>
              <textarea
                id="post-refine-instruction"
                className="form-textarea form-textarea-compact"
                rows={4}
                placeholder="Optional guidance for this refinement pass."
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
              />
            </div>

            <label className="checkbox-label article-refine-advanced-toggle">
              <input
                type="checkbox"
                checked={advancedEnabled}
                onChange={(event) => setAdvancedEnabled(event.target.checked)}
              />
              Advanced
            </label>

            {advancedEnabled ? (
              <div className="form-group">
                <label htmlFor="post-refine-advanced" className="form-label">
                  Advanced prompt
                </label>
                <textarea
                  id="post-refine-advanced"
                  className="form-textarea"
                  rows={6}
                  placeholder="Write a more detailed custom refinement prompt."
                  value={advancedPrompt}
                  onChange={(event) => setAdvancedPrompt(event.target.value)}
                />
              </div>
            ) : null}

            <div className="toolbar" style={{ marginBottom: 0 }}>
              <button
                type="button"
                className="button-link secondary"
                onClick={() =>
                  handleIteration("improve", {
                    tone: selectedTone,
                    length: selectedLength,
                    focus: selectedFocus,
                    instruction,
                    advancedPrompt: advancedEnabled ? advancedPrompt : "",
                  })
                }
                disabled={isIterating}
              >
                {isIterating ? "Applying..." : "Apply refinement"}
              </button>
            </div>
          </div>
        </details>
      </section>

      <section className="article-edit-shell">
        <div className="article-edit-header">
          <div>
            <h2 className="trading-section-title" style={{ marginBottom: "0.35rem" }}>
              Draft Body
            </h2>
            <p className="meta" style={{ marginBottom: 0 }}>
              {canManage
                ? isEditing
                  ? "Edit directly here and save when it feels right."
                  : "Click into the draft to edit directly."
                : "Readable draft output generated from your source material."}
            </p>
          </div>
          {canManage && !isEditing ? (
            <button
              type="button"
              className="button-link secondary article-admin-button"
              onClick={() => setIsEditing(true)}
            >
              Click to edit
            </button>
          ) : null}
        </div>

        {isEditing ? (
          <div className="article-inline-editor">
            <textarea
              className="form-textarea article-inline-textarea"
              value={draftBody}
              onChange={(event) => setDraftBody(event.target.value)}
            />
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <button
                type="button"
                className="button-link"
                onClick={handleSaveInlineEdit}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Draft"}
              </button>
              <button
                type="button"
                className="button-link secondary"
                onClick={() => {
                  setDraftBody(committedBody);
                  setIsEditing(false);
                  setSaveNote("");
                }}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="article-inline-preview"
            onClick={() => canManage && setIsEditing(true)}
            disabled={!canManage}
          >
            <div className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{draftBody}</ReactMarkdown>
            </div>
          </button>
        )}

        {saveNote ? <p className="form-help article-save-note">{saveNote}</p> : null}
      </section>

      <section className="article-next-steps">
        <p className="article-summary-label">Next step</p>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className="button-link secondary article-admin-button"
            onClick={() => setIsEditing(true)}
          >
            Continue refining
          </button>
          <Link href="/studio" className="button-link secondary article-admin-button">
            Publish externally
          </Link>
          <Link href="/studio" className="button-link secondary article-admin-button">
            Convert to another format
          </Link>
        </div>
      </section>
    </>
  );
}
