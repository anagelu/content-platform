"use client";

import { useEffect, useRef, useState } from "react";
import { NotesFormattedTextarea } from "@/app/trading/notes-formatted-textarea";
import { TradingChartView } from "@/app/trading/chart/trading-chart-view";
import {
  CHART_TIMEFRAME_OPTIONS,
  normalizeChartTimeframe,
} from "@/lib/chart-timeframes";
import {
  POST_TO_TRADING_DRAFT_KEY,
  type PostToTradingDraft,
} from "@/lib/trading-draft-transfer";
import {
  buildSetupFieldName,
  type TradingSetupContext,
  getTradingSetupDefinition,
  TRADING_SETUP_DEFINITIONS,
} from "@/lib/trading-setups";
import { createTradingSession } from "./actions";

type TradingUserDefaults = {
  publicTradingProfile: boolean;
  tradingFocus: string;
  tradingBio: string;
};

type TradingSessionFormValues = {
  id?: number;
  title: string;
  market: string;
  timeframe: string;
  setupType: string;
  direction: "LONG" | "SHORT";
  entryMin: string;
  entryMax: string;
  stopLoss: string;
  targetOne: string;
  targetTwo: string;
  confidence: string;
  outcome: "PENDING" | "HIT_TARGET" | "PARTIAL" | "STOPPED_OUT" | "INVALIDATED";
  thesis: string;
  workflowNotes: string;
  sourceChat: string;
  chartTimeframe: string;
  chartScreenshotUrl: string;
  chartNotes: string;
  featuredPublic: boolean;
  setupContext: TradingSetupContext | null;
};

type TradingFormAction = (formData: FormData) => void | Promise<void>;

const DEFAULT_FORM_VALUES: TradingSessionFormValues = {
  title: "",
  market: "",
  timeframe: "",
  setupType: TRADING_SETUP_DEFINITIONS[0]?.id ?? "",
  direction: "LONG",
  entryMin: "",
  entryMax: "",
  stopLoss: "",
  targetOne: "",
  targetTwo: "",
  confidence: "5",
  outcome: "PENDING",
  thesis: "",
  workflowNotes: "",
  sourceChat: "",
  chartTimeframe: "1d",
  chartScreenshotUrl: "",
  chartNotes: "",
  featuredPublic: false,
  setupContext: null,
};

const CHART_NOTES_TEMPLATE = `Structure:
- Trend or condition:
- Range / breakout / reversal context:

Key levels:
- Support:
- Resistance:
- Entry area:
- Invalidation:

What the chart is doing now:
- 

What would confirm the idea:
- 

What would weaken or cancel the idea:
- `;

const SPX_PRETRADE_CHECKLIST = `SPX pre-trade checklist:
- Session window:
- Higher-timeframe bias:
- Key levels from prior day / overnight:
- Volatility regime:
- Setup in play:
- Exact trigger:
- Invalidation:
- Maximum risk for this trade:
- Condition that makes me skip the trade:`;

const SPX_JOURNAL_WORKFLOW_TEMPLATE = `SPX execution plan:
- Opening scenario:
- Midday scenario:
- Trend-day vs range-day clue:
- First scale / reduce point:
- Full invalidation:
- Emotional mistake to avoid:
- Time-based stop or walk-away condition:`;

const SPX_CHART_NOTES_TEMPLATE = `SPX chart map:
- Prior day high / low:
- Overnight high / low:
- Opening range:
- Trend-day clue:
- Range-day clue:
- Long trigger:
- Short trigger:
- What would keep me flat:`;

export function TradingSessionForm({
  user,
  action = createTradingSession,
  submitLabel = "Save Trading Session",
  initialValues,
  importedFromPosts = false,
  aiAssistEnabled = false,
  aiProviderLabel = "AI",
  aiTierLabel = "Low",
}: {
  user: TradingUserDefaults;
  action?: TradingFormAction;
  submitLabel?: string;
  initialValues?: Partial<TradingSessionFormValues>;
  importedFromPosts?: boolean;
  aiAssistEnabled?: boolean;
  aiProviderLabel?: string;
  aiTierLabel?: string;
}) {
  const values = {
    ...DEFAULT_FORM_VALUES,
    ...initialValues,
  };
  const formRef = useRef<HTMLFormElement>(null);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [isGeneratingWithAi, setIsGeneratingWithAi] = useState(false);
  const [autofillError, setAutofillError] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [generationNote, setGenerationNote] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [importNote, setImportNote] = useState("");
  const [marketInput, setMarketInput] = useState(values.market);
  const [timeframeInput, setTimeframeInput] = useState(values.timeframe);
  const [directionInput, setDirectionInput] = useState(values.direction);
  const [entryMinInput, setEntryMinInput] = useState(values.entryMin);
  const [entryMaxInput, setEntryMaxInput] = useState(values.entryMax);
  const [stopLossInput, setStopLossInput] = useState(values.stopLoss);
  const [targetOneInput, setTargetOneInput] = useState(values.targetOne);
  const [targetTwoInput, setTargetTwoInput] = useState(values.targetTwo);
  const [confidenceInput, setConfidenceInput] = useState(values.confidence);
  const [liveChartMarket, setLiveChartMarket] = useState(values.market);
  const [chartTimeframeInput, setChartTimeframeInput] = useState(
    normalizeChartTimeframe(values.chartTimeframe || values.timeframe || "1d"),
  );
  const [liveChartTimeframe, setLiveChartTimeframe] = useState(
    normalizeChartTimeframe(values.chartTimeframe || values.timeframe || "1d"),
  );
  const [selectedSetup, setSelectedSetup] = useState(
    getTradingSetupDefinition(values.setupType)?.id ??
      TRADING_SETUP_DEFINITIONS[0]?.id ??
      "",
  );
  const activeSetup = getTradingSetupDefinition(selectedSetup);

  function setFieldValue(name: string, value: string) {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const field = form.elements.namedItem(name);

    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement ||
      field instanceof HTMLSelectElement
    ) {
      field.value = value;
    }
  }

  useEffect(() => {
    if (!importedFromPosts) {
      return;
    }

    const rawDraft = window.sessionStorage.getItem(POST_TO_TRADING_DRAFT_KEY);

    if (!rawDraft) {
      return;
    }

    try {
      const draft = JSON.parse(rawDraft) as Partial<PostToTradingDraft>;

      if (typeof draft.title === "string" && draft.title.trim()) {
        setFieldValue("title", draft.title.trim());
      }

      if (typeof draft.sourceChat === "string" && draft.sourceChat.trim()) {
        setFieldValue("sourceChat", draft.sourceChat.trim());
      }

      if (typeof draft.authorNotes === "string" && draft.authorNotes.trim()) {
        setFieldValue("workflowNotes", draft.authorNotes.trim());
      }

      setImportNote(
        "Imported your conversation from Posts. Add market, timeframe, and setup details, then use AI assist if you want a draft thesis and workflow notes.",
      );
      window.sessionStorage.removeItem(POST_TO_TRADING_DRAFT_KEY);
    } catch {
      setImportNote("The post draft import could not be read cleanly, so nothing was transferred.");
    }
  }, [importedFromPosts]);

  useEffect(() => {
    setMarketInput(values.market);
    setTimeframeInput(values.timeframe);
    setDirectionInput(values.direction);
    setEntryMinInput(values.entryMin);
    setEntryMaxInput(values.entryMax);
    setStopLossInput(values.stopLoss);
    setTargetOneInput(values.targetOne);
    setTargetTwoInput(values.targetTwo);
    setConfidenceInput(values.confidence);
    setLiveChartMarket(values.market);
    const normalizedChartTimeframe = normalizeChartTimeframe(
      values.chartTimeframe || values.timeframe || "1d",
    );
    setChartTimeframeInput(normalizedChartTimeframe);
    setLiveChartTimeframe(
      normalizedChartTimeframe,
    );
  }, [
    values.chartTimeframe,
    values.confidence,
    values.direction,
    values.entryMax,
    values.entryMin,
    values.market,
    values.stopLoss,
    values.targetOne,
    values.targetTwo,
    values.timeframe,
  ]);

  async function handleAutoFill() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const market = marketInput.trim();
    const timeframe = timeframeInput.trim();
    const setupType = selectedSetup.trim();
    const direction = directionInput;

    setIsAutofilling(true);
    setAutofillError("");
    setQuoteNote("");

    try {
      const response = await fetch("/api/trading/autofill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          market,
          timeframe,
          setupType,
          direction,
        }),
      });

      const payload = (await response.json()) as {
        quote?: {
          symbol: string;
          price: number;
          fetchedAt: string;
        };
        autofill?: {
          entryMin: number;
          entryMax: number;
          stopLoss: number;
          targetOne: number;
          targetTwo: number;
          confidence: number;
        };
        error?: string;
      };

      if (!response.ok || !payload.autofill || !payload.quote) {
        throw new Error(payload.error || "Autofill failed.");
      }

      setEntryMinInput(String(payload.autofill.entryMin));
      setEntryMaxInput(String(payload.autofill.entryMax));
      setStopLossInput(String(payload.autofill.stopLoss));
      setTargetOneInput(String(payload.autofill.targetOne));
      setTargetTwoInput(String(payload.autofill.targetTwo));
      setConfidenceInput(String(payload.autofill.confidence));

      setQuoteNote(
        `Loaded live quote for ${payload.quote.symbol} at ${payload.quote.price.toFixed(
          2,
        )} from ${payload.quote.fetchedAt}. Autofill now also adjusts levels for the selected setup type.`,
      );
    } catch (error) {
      setAutofillError(
        error instanceof Error
          ? error.message
          : "Autofill failed.",
      );
    } finally {
      setIsAutofilling(false);
    }
  }

  async function handleGenerateFromSourceSession() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const sourceChat = formData.get("sourceChat")?.toString().trim() || "";

    if (!sourceChat) {
      setGenerationError("Add a source session before generating with AI.");
      return;
    }

    setIsGeneratingWithAi(true);
    setGenerationError("");
    setGenerationNote("");

    try {
      const setupContextText = activeSetup
        ? activeSetup.fields
            .map((field) => {
              const value =
                formData.get(buildSetupFieldName(field.key))?.toString().trim() || "";

              return value ? `${field.label}: ${value}` : "";
            })
            .filter(Boolean)
            .join("\n")
        : "";

      const response = await fetch("/api/ai/trading-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.get("title")?.toString() || "",
          market: formData.get("market")?.toString() || "",
          timeframe: formData.get("timeframe")?.toString() || "",
          setupType: formData.get("setupType")?.toString() || "",
          setupContextText,
          direction: formData.get("direction")?.toString() || "",
          sourceChat,
          chartTimeframe: formData.get("chartTimeframe")?.toString() || "",
          chartScreenshotUrl: formData.get("chartScreenshotUrl")?.toString() || "",
          chartNotes: formData.get("chartNotes")?.toString() || "",
        }),
      });

      const payload = (await response.json()) as {
        title?: string;
        thesis?: string;
        workflowNotes?: string;
        model?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Trading session AI assist failed.");
      }

      setFieldValue("title", payload.title ?? "");
      setFieldValue("thesis", payload.thesis ?? "");
      setFieldValue("workflowNotes", payload.workflowNotes ?? "");

      setGenerationNote(
        payload.model
          ? `AI assist loaded with ${payload.model}. It used the source session, selected setup, chart context, and live market data to draft the title, thesis, and workflow notes.`
          : "Trading session AI assist loaded.",
      );
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Something went wrong while generating the trading session assist.",
      );
    } finally {
      setIsGeneratingWithAi(false);
    }
  }

  function handleOpenChartView() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const market = marketInput;
    const selectedTimeframe = normalizeChartTimeframe(
      chartTimeframeInput || timeframeInput || values.timeframe,
    );

    if (!market.trim()) {
      setAutofillError("Add a market or ticker before opening the chart view.");
      return;
    }

    const url = `/trading/chart?market=${encodeURIComponent(
      market.trim().toUpperCase(),
    )}&timeframe=${encodeURIComponent(selectedTimeframe)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleUseChartNotesTemplate() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const chartNotesField = form.elements.namedItem("chartNotes");

    if (!(chartNotesField instanceof HTMLTextAreaElement)) {
      return;
    }

    if (chartNotesField.value.trim()) {
      chartNotesField.value = `${chartNotesField.value.trim()}\n\n${CHART_NOTES_TEMPLATE}`;
      return;
    }

    chartNotesField.value = CHART_NOTES_TEMPLATE;
  }

  function appendTextToField(name: string, text: string) {
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

  function handleLoadSpxStarter(setupType: string) {
    setMarketInput("SPX");
    setLiveChartMarket("SPX");
    setTimeframeInput("5m");
    setChartTimeframeInput("5m");
    setLiveChartTimeframe("5m");
    setSelectedSetup(setupType);
    setFieldValue("market", "SPX");
    setFieldValue("timeframe", "5m");
    setFieldValue("chartTimeframe", "5m");
    setFieldValue("workflowNotes", SPX_JOURNAL_WORKFLOW_TEMPLATE);
    setFieldValue("chartNotes", SPX_CHART_NOTES_TEMPLATE);
    appendTextToField("sourceChat", SPX_PRETRADE_CHECKLIST);
    setGenerationNote(
      "Loaded SPX starter defaults with a pre-trade checklist, workflow template, and chart map.",
    );
    setGenerationError("");
  }

  function handleInsertSpxChecklist() {
    appendTextToField("sourceChat", SPX_PRETRADE_CHECKLIST);
    appendTextToField("workflowNotes", SPX_JOURNAL_WORKFLOW_TEMPLATE);
    appendTextToField("chartNotes", SPX_CHART_NOTES_TEMPLATE);
  }

  return (
    <div className="form-card">
      <form ref={formRef} action={action}>
        {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
        {importNote ? (
          <div className="form-callout">
            <h2 className="form-callout-title">Imported From Posts</h2>
            <p className="form-callout-text">{importNote}</p>
          </div>
        ) : null}
        <div className="trading-grid">
          <div className="form-group">
            <label htmlFor="title" className="form-label">
              Session title
            </label>
            <input
              id="title"
              name="title"
              required
              defaultValue={values.title}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="market" className="form-label">
              Market / ticker
            </label>
            <input
              id="market"
              name="market"
              placeholder="BTC, ES, NVDA, EURUSD"
              required
              value={marketInput}
              className="form-input"
              onChange={(event) => {
                setMarketInput(event.target.value);
                setLiveChartMarket(event.target.value);
              }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="timeframe" className="form-label">
              Decision timeframe
            </label>
            <input
              id="timeframe"
              name="timeframe"
              placeholder="1H, 4H, Daily, Weekly"
              required
              value={timeframeInput}
              className="form-input"
              onChange={(event) => setTimeframeInput(event.target.value)}
            />
            <p className="form-help">
              Use the chart timeframe driving the decision. Holding period can
              be shorter or longer than this.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="setupType" className="form-label">
              Setup type
            </label>
            <select
              id="setupType"
              name="setupType"
              required
              className="form-select"
              value={selectedSetup}
              onChange={(event) => setSelectedSetup(event.target.value)}
            >
              {TRADING_SETUP_DEFINITIONS.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.label}
                </option>
              ))}
            </select>
            <p className="form-help">
              Pick the trading pattern you believe is forming. This helps frame
              the thesis, the chart notes, and the kind of confirmation you are
              looking for.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="direction" className="form-label">
              Direction
            </label>
            <select
              id="direction"
              name="direction"
              value={directionInput}
              className="form-select"
              onChange={(event) =>
                setDirectionInput(event.target.value as "LONG" | "SHORT")
              }
            >
              <option value="LONG">Long</option>
              <option value="SHORT">Short</option>
            </select>
          </div>
        </div>

        {activeSetup ? (
          <div className="form-callout">
            <h2 className="form-callout-title">{activeSetup.label}</h2>
            <p className="form-callout-text">{activeSetup.description}</p>
            <p className="form-callout-text">
              Use the extra fields below to describe why this specific setup is
              valid right now, not just why the market looks interesting in
              general.
            </p>
          </div>
        ) : null}

        <div className="form-callout">
          <h2 className="form-callout-title">SPX Playbook</h2>
          <p className="form-callout-text">
            If SPX is your main market, use a consistent checklist and repeat a small set of setups until the review data is strong.
          </p>
          <div className="toolbar" style={{ marginTop: "1rem", marginBottom: 0 }}>
            <button
              type="button"
              className="button-link secondary"
              onClick={() => handleLoadSpxStarter("OPENING_RANGE_BREAK")}
            >
              Load SPX ORB
            </button>
            <button
              type="button"
              className="button-link secondary"
              onClick={() => handleLoadSpxStarter("TREND_CONTINUATION")}
            >
              Load SPX Trend Day
            </button>
            <button
              type="button"
              className="button-link secondary"
              onClick={() => handleLoadSpxStarter("MEAN_REVERSION")}
            >
              Load SPX Fade
            </button>
            <button
              type="button"
              className="button-link secondary"
              onClick={handleInsertSpxChecklist}
            >
              Insert SPX Checklist
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="sourceChat" className="form-label">
            Source session
          </label>
          <p className="form-help">
            Paste the raw AI or research conversation first, then use AI assist
            to draft the thesis and workflow notes from it.
          </p>
          <NotesFormattedTextarea
            id="sourceChat"
            name="sourceChat"
            rows={10}
            defaultValue={values.sourceChat}
            placeholder="Paste the raw AI or research session that led to this trading idea."
          />
        </div>

        <div className="form-callout">
          <h2 className="form-callout-title">Chart Context</h2>
          <p className="form-callout-text">
            Add a chart screenshot reference, track the chart timeframe, and
            open a dedicated chart window before generating the thesis.
          </p>
        </div>

        <div className="trading-grid">
          <div className="form-group">
            <label htmlFor="chartTimeframe" className="form-label">
              Chart timeframe
            </label>
            <select
              id="chartTimeframe"
              name="chartTimeframe"
              value={chartTimeframeInput}
              className="form-select"
              onChange={(event) => {
                setChartTimeframeInput(event.target.value);
                setLiveChartTimeframe(event.target.value);
              }}
            >
              {CHART_TIMEFRAME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="chartScreenshotUrl" className="form-label">
              Chart screenshot URL
            </label>
            <input
              id="chartScreenshotUrl"
              name="chartScreenshotUrl"
              type="url"
              defaultValue={values.chartScreenshotUrl}
              placeholder="https://..."
              className="form-input"
            />
            <p className="form-help">
              Use an image URL for now. We can add full uploads later if you want.
            </p>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="chartNotes" className="form-label">
            Chart notes
          </label>
          <p className="form-help">
            Describe what the chart is showing so the AI summary can use that
            context even before we add vision support. Use the guided format
            below if you are not sure what to write, then expand in your own
            words if needed.
          </p>
          <div className="toolbar" style={{ marginTop: "0.75rem", marginBottom: "0.75rem" }}>
            <button
              type="button"
              className="button-link secondary"
              onClick={handleUseChartNotesTemplate}
            >
              Insert Guided Format
            </button>
          </div>
          <NotesFormattedTextarea
            id="chartNotes"
            name="chartNotes"
            rows={5}
            defaultValue={values.chartNotes}
            placeholder={CHART_NOTES_TEMPLATE}
          />
        </div>

        <div className="generate-row">
          <button
            type="button"
            className="button-link secondary"
            onClick={handleOpenChartView}
          >
            Open Chart View
          </button>
          <p className="form-help generate-help">
            Pops out a live chart window for the selected market and chart timeframe.
          </p>
        </div>

        {liveChartMarket.trim() ? (
          <div className="signal-chart-card" style={{ marginBottom: "1.5rem" }}>
            <TradingChartView
              market={liveChartMarket.trim().toUpperCase()}
              timeframe={liveChartTimeframe}
              compact
            />
          </div>
        ) : (
          <p className="form-help" style={{ marginBottom: "1.5rem" }}>
            Add a market or ticker to load the live chart preview here.
          </p>
        )}

        {values.chartScreenshotUrl ? (
          <div className="trading-chart-image-wrap" style={{ marginBottom: "1.5rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={values.chartScreenshotUrl}
              alt="Chart screenshot preview"
              className="trading-chart-image"
            />
          </div>
        ) : null}

        <div className="generate-row">
          <button
            type="button"
            className="button-link secondary"
            onClick={handleGenerateFromSourceSession}
            disabled={!aiAssistEnabled || isGeneratingWithAi}
          >
            {isGeneratingWithAi ? "Generating From Source Session..." : "Generate From Source Session"}
          </button>
          <p className="form-help generate-help">
            Uses the source session, selected setup, chart context, and live
            market data to draft the session title, trading thesis, and
            workflow notes.
          </p>
        </div>

        {aiAssistEnabled ? (
          <p className="form-help">
            AI is enabled. Provider: {aiProviderLabel}. Tier: {aiTierLabel}.
            Save the form to let the existing summary logic turn the thesis and
            workflow notes into the final trading summary.
          </p>
        ) : (
          <p className="form-help">
            AI is disabled. Configure the selected provider key in admin to enable source-session drafting.
          </p>
        )}

        {generationError ? <p className="form-error">{generationError}</p> : null}
        {generationNote ? <p className="form-help">{generationNote}</p> : null}

        {activeSetup ? (
          <div className="trading-grid">
            {activeSetup.fields.map((field) => (
              <div key={field.key} className="form-group">
                <label
                  htmlFor={buildSetupFieldName(field.key)}
                  className="form-label"
                >
                  {field.label}
                </label>
                <input
                  id={buildSetupFieldName(field.key)}
                  name={buildSetupFieldName(field.key)}
                  placeholder={field.placeholder}
                  required={field.required}
                  defaultValue={
                    values.setupContext?.entries.find(
                      (entry) => entry.key === field.key,
                    )?.value ?? ""
                  }
                  className="form-input"
                />
                <p className="form-help">{field.help}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="generate-row">
          <button
            type="button"
            className="button-link"
            onClick={handleAutoFill}
            disabled={isAutofilling}
          >
            {isAutofilling ? "Loading Market Data..." : "Auto-Fill From Live Quote"}
          </button>
          <p className="form-help generate-help">
            Pulls the current quote and fills entry, stop, targets, and baseline confidence from the selected timeframe and direction.
          </p>
          {quoteNote ? <p className="form-help">{quoteNote}</p> : null}
        </div>

        {autofillError ? <p className="form-error">{autofillError}</p> : null}

        <div className="trading-grid">
          <div className="form-group">
            <label htmlFor="entryMin" className="form-label">
              Entry zone min
            </label>
            <input
              id="entryMin"
              name="entryMin"
              type="number"
              step="0.01"
              required
              value={entryMinInput}
              className="form-input"
              onChange={(event) => setEntryMinInput(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="entryMax" className="form-label">
              Entry zone max
            </label>
            <input
              id="entryMax"
              name="entryMax"
              type="number"
              step="0.01"
              required
              value={entryMaxInput}
              className="form-input"
              onChange={(event) => setEntryMaxInput(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="stopLoss" className="form-label">
              Stop loss
            </label>
            <input
              id="stopLoss"
              name="stopLoss"
              type="number"
              step="0.01"
              required
              value={stopLossInput}
              className="form-input"
              onChange={(event) => setStopLossInput(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="targetOne" className="form-label">
              Target one
            </label>
            <input
              id="targetOne"
              name="targetOne"
              type="number"
              step="0.01"
              required
              value={targetOneInput}
              className="form-input"
              onChange={(event) => setTargetOneInput(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="targetTwo" className="form-label">
              Target two
            </label>
            <input
              id="targetTwo"
              name="targetTwo"
              type="number"
              step="0.01"
              value={targetTwoInput}
              className="form-input"
              onChange={(event) => setTargetTwoInput(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confidence" className="form-label">
              Confidence (1-10)
            </label>
            <input
              id="confidence"
              name="confidence"
              type="number"
              min="1"
              max="10"
              value={confidenceInput}
              required
              className="form-input"
              onChange={(event) => setConfidenceInput(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="outcome" className="form-label">
              Outcome
            </label>
            <select
              id="outcome"
              name="outcome"
              defaultValue={values.outcome}
              className="form-select"
            >
              <option value="PENDING">Pending</option>
              <option value="HIT_TARGET">Hit target</option>
              <option value="PARTIAL">Partial</option>
              <option value="STOPPED_OUT">Stopped out</option>
              <option value="INVALIDATED">Invalidated</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="thesis" className="form-label">
            Trading thesis
          </label>
          <NotesFormattedTextarea
            id="thesis"
            name="thesis"
            rows={8}
            required
            defaultValue={values.thesis}
            placeholder={
              activeSetup?.thesisPrompt ||
              "What is the idea, what confirms it, and what would invalidate it?"
            }
          />
        </div>

        <div className="form-group">
          <label htmlFor="workflowNotes" className="form-label">
            Workflow notes
          </label>
          <NotesFormattedTextarea
            id="workflowNotes"
            name="workflowNotes"
            rows={8}
            defaultValue={values.workflowNotes}
            placeholder={
              activeSetup?.workflowPrompt ||
              "Execution plan, checklist, risk rules, post-trade review notes, recurring habits."
            }
          />
        </div>

        <div className="form-callout">
          <h2 className="form-callout-title">Public profile controls</h2>
          <p className="form-callout-text">
            If you opt in, standout sessions can appear on the public
            landing page with your credit attached.
          </p>
        </div>

        <div className="trading-grid">
          <div className="form-group">
            <label htmlFor="tradingFocus" className="form-label">
              Trading focus
            </label>
            <input
              id="tradingFocus"
              name="tradingFocus"
              defaultValue={user.tradingFocus}
              className="form-input"
              placeholder="Momentum equities, BTC market structure, macro swing trades"
            />
          </div>

          <div className="form-group">
            <label htmlFor="tradingBio" className="form-label">
              Short bio
            </label>
            <input
              id="tradingBio"
              name="tradingBio"
              defaultValue={user.tradingBio}
              className="form-input"
              placeholder="What kind of trader are you becoming?"
            />
          </div>
        </div>

        <div className="checkbox-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="publicTradingProfile"
              defaultChecked={user.publicTradingProfile}
            />
            Make my trading profile eligible for public credit
          </label>
        </div>

        <div className="checkbox-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="featuredPublic"
              defaultChecked={values.featuredPublic}
            />
            Allow this session to be featured publicly if it is strong
          </label>
        </div>

        <button type="submit" className="submit-button">
          {submitLabel}
        </button>
      </form>
    </div>
  );
}
