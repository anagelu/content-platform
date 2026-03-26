"use client";

import { useRef, useState } from "react";
import { NotesFormattedTextarea } from "@/app/trading/notes-formatted-textarea";
import { createTradingJournalEntry } from "./actions";

type TradingJournalEntryFormValues = {
  id?: number;
  title: string;
  market: string;
  timeframe: string;
  direction: "LONG" | "SHORT";
  entryDate: string;
  entryPrice: string;
  stillHolding: boolean;
  exitDate: string;
  exitPrice: string;
  executionNotes: string;
  mistakeReview: string;
  lessonLearned: string;
};

const defaultValues: TradingJournalEntryFormValues = {
  title: "",
  market: "",
  timeframe: "",
  direction: "LONG",
  entryDate: "",
  entryPrice: "",
  stillHolding: true,
  exitDate: "",
  exitPrice: "",
  executionNotes: "",
  mistakeReview: "",
  lessonLearned: "",
};

const SPX_EXECUTION_REVIEW_TEMPLATE = `SPX execution review:
- Session window:
- Main setup:
- What price did at the key level:
- Was this a trend day, range day, or failed breakout?
- What I did well:
- What I did poorly:
- What I should repeat next time:`;

const SPX_MISTAKE_AUDIT_TEMPLATE = `SPX mistake audit:
- Did I trade my A+ setup?
- Did I respect opening volatility?
- Did I chase away from my level?
- Did I size too large?
- Did I ignore invalidation?
- Did I overtrade after one loss or win?`;

const SPX_LESSON_TEMPLATE = `SPX repeatable lesson:
- Best setup to keep:
- One condition that makes me stay flat:
- One execution mistake to eliminate:
- One time-of-day edge I should lean on:`;

export function TradingJournalEntryForm({
  action = createTradingJournalEntry,
  submitLabel = "Save Journal Entry",
  initialValues = defaultValues,
  aiAssistEnabled = false,
  aiProviderLabel = "AI",
  aiTierLabel = "Low",
}: {
  action?: (formData: FormData) => void | Promise<void>;
  submitLabel?: string;
  initialValues?: TradingJournalEntryFormValues;
  aiAssistEnabled?: boolean;
  aiProviderLabel?: string;
  aiTierLabel?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [stillHolding, setStillHolding] = useState(initialValues.stillHolding);
  const [isGeneratingWithAi, setIsGeneratingWithAi] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationNote, setGenerationNote] = useState("");

  function appendToField(name: string, text: string) {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const field = form.elements.namedItem(name);

    if (!(field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement)) {
      return;
    }

    const currentValue = field.value.trim();
    field.value = currentValue ? `${currentValue}\n\n${text}` : text;
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function handleGenerateWithAi() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const formData = new FormData(form);

    setIsGeneratingWithAi(true);
    setGenerationError("");
    setGenerationNote("");

    try {
      const response = await fetch("/api/ai/trading-journal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.get("title")?.toString() || "",
          market: formData.get("market")?.toString() || "",
          timeframe: formData.get("timeframe")?.toString() || "",
          direction: formData.get("direction")?.toString() || "",
          executionNotes: formData.get("executionNotes")?.toString() || "",
          mistakeReview: formData.get("mistakeReview")?.toString() || "",
          lessonLearned: formData.get("lessonLearned")?.toString() || "",
        }),
      });

      const payload = (await response.json()) as {
        title?: string;
        summary?: string;
        lessonLearned?: string;
        model?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Trading journal AI assist failed.");
      }

      const titleInput = form.elements.namedItem("title") as HTMLInputElement | null;
      const lessonInput = form.elements.namedItem("lessonLearned") as
        | HTMLTextAreaElement
        | null;

      if (titleInput && payload.title) {
        titleInput.value = payload.title;
      }

      if (lessonInput && payload.lessonLearned) {
        lessonInput.value = payload.lessonLearned;
        lessonInput.dispatchEvent(new Event("input", { bubbles: true }));
      }

      setGenerationNote(
        payload.model
          ? `Journal assist loaded with ${payload.model}. The preview summary will be generated from your notes when you save.`
          : "Journal assist loaded.",
      );
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Something went wrong while generating the journal assist.",
      );
    } finally {
      setIsGeneratingWithAi(false);
    }
  }

  return (
    <form ref={formRef} action={action}>
      {initialValues.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}

      <div className="trading-grid">
        <div className="form-group">
          <label htmlFor="title" className="form-label">
            Entry title
          </label>
          <input
            id="title"
            name="title"
            required
            className="form-input"
            defaultValue={initialValues.title}
          />
        </div>

        <div className="form-group">
          <label htmlFor="market" className="form-label">
            Market / ticker
          </label>
          <input
            id="market"
            name="market"
            required
            className="form-input"
            defaultValue={initialValues.market}
          />
        </div>

        <div className="form-group">
          <label htmlFor="timeframe" className="form-label">
            Decision timeframe
          </label>
          <input
            id="timeframe"
            name="timeframe"
            required
            placeholder="1H, 4H, Daily, Weekly"
            className="form-input"
            defaultValue={initialValues.timeframe}
          />
          <p className="form-help">
            This is the chart timeframe you used to make the trade decision,
            not necessarily how long you intend to hold it.
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="direction" className="form-label">
            Direction
          </label>
          <select
            id="direction"
            name="direction"
            className="form-select"
            defaultValue={initialValues.direction}
          >
            <option value="LONG">Long</option>
            <option value="SHORT">Short</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="entryDate" className="form-label">
            Entry date
          </label>
          <input
            id="entryDate"
            name="entryDate"
            type="date"
            required
            className="form-input"
            defaultValue={initialValues.entryDate}
          />
        </div>

        <div className="form-group">
          <label htmlFor="entryPrice" className="form-label">
            Entry price
          </label>
          <input
            id="entryPrice"
            name="entryPrice"
            type="number"
            step="0.01"
            required
            className="form-input"
            defaultValue={initialValues.entryPrice}
          />
        </div>
      </div>

      <div className="checkbox-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="stillHolding"
            checked={stillHolding}
            onChange={(event) => setStillHolding(event.target.checked)}
          />
          I am still holding this position
        </label>
      </div>

      <div className="trading-grid">
        <div className="form-group">
          <label htmlFor="exitDate" className="form-label">
            Exit date
          </label>
          <input
            id="exitDate"
            name="exitDate"
            type="date"
            disabled={stillHolding}
            className="form-input"
            defaultValue={initialValues.exitDate}
          />
        </div>

        <div className="form-group">
          <label htmlFor="exitPrice" className="form-label">
            Exit price
          </label>
          <input
            id="exitPrice"
            name="exitPrice"
            type="number"
            step="0.01"
            disabled={stillHolding}
            className="form-input"
            defaultValue={initialValues.exitPrice}
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="executionNotes" className="form-label">
          Execution notes
        </label>
        <div className="toolbar" style={{ marginTop: "0.75rem", marginBottom: "0.75rem" }}>
          <button
            type="button"
            className="button-link secondary"
            onClick={() => appendToField("executionNotes", SPX_EXECUTION_REVIEW_TEMPLATE)}
          >
            Insert SPX Review
          </button>
        </div>
        <NotesFormattedTextarea
          id="executionNotes"
          name="executionNotes"
          rows={8}
          defaultValue={initialValues.executionNotes}
          placeholder="Why you took the trade, how you executed it, what you saw in real time."
        />
      </div>

      <div className="generate-row">
        <button
          type="button"
          className="button-link secondary"
          onClick={handleGenerateWithAi}
          disabled={!aiAssistEnabled || isGeneratingWithAi}
        >
          {isGeneratingWithAi ? "Generating Journal Assist..." : "Generate Journal Assist"}
        </button>

        <p className="form-help generate-help">
          This optional AI pass rewrites the title and lesson from your journal
          notes while keeping the main record editable by hand.
        </p>
      </div>

      {aiAssistEnabled ? (
        <p className="form-help">
          AI is enabled. Provider: {aiProviderLabel}. Tier: {aiTierLabel}.
        </p>
      ) : (
        <p className="form-help">
          AI is disabled. Configure the selected provider key in admin to enable journal assist.
        </p>
      )}

      {generationError ? <p className="form-error">{generationError}</p> : null}
      {generationNote ? <p className="form-help">{generationNote}</p> : null}

      <div className="form-group">
        <label htmlFor="mistakeReview" className="form-label">
          Mistake review
        </label>
        <div className="toolbar" style={{ marginTop: "0.75rem", marginBottom: "0.75rem" }}>
          <button
            type="button"
            className="button-link secondary"
            onClick={() => appendToField("mistakeReview", SPX_MISTAKE_AUDIT_TEMPLATE)}
          >
            Insert SPX Audit
          </button>
        </div>
        <NotesFormattedTextarea
          id="mistakeReview"
          name="mistakeReview"
          rows={7}
          defaultValue={initialValues.mistakeReview}
          placeholder="List errors in process, timing, sizing, patience, or discipline."
        />
      </div>

      <div className="form-group">
        <label htmlFor="lessonLearned" className="form-label">
          Lesson learned
        </label>
        <div className="toolbar" style={{ marginTop: "0.75rem", marginBottom: "0.75rem" }}>
          <button
            type="button"
            className="button-link secondary"
            onClick={() => appendToField("lessonLearned", SPX_LESSON_TEMPLATE)}
          >
            Insert SPX Lesson
          </button>
        </div>
        <NotesFormattedTextarea
          id="lessonLearned"
          name="lessonLearned"
          rows={7}
          defaultValue={initialValues.lessonLearned}
          placeholder="Turn the trade into a repeatable lesson for the next session."
        />
      </div>

      <button type="submit" className="submit-button">
        {submitLabel}
      </button>
    </form>
  );
}
