"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { storeHomeIdeaTransfer } from "@/lib/home-idea-transfer";

const MAX_DEMO_IDEA_CHARS = 1200;

const EXAMPLE_PLACEHOLDER = `Paste a rough idea, a voice-note transcript, or a chat you had with an AI. For example:

"I keep thinking small restaurants are scared of AI because they think it'll feel cold and impersonal, but really the busywork is what's killing the personal touch, not automation itself..."`;

type DemoResult = {
  title: string;
  summary: string;
  article: string;
  model: string;
};

export function TryDemo() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<DemoResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const trimmedLength = idea.trim().length;
  const overLimit = trimmedLength > MAX_DEMO_IDEA_CHARS;
  const canGenerate = trimmedLength > 0 && !overLimit && status !== "loading";

  async function handleGenerate() {
    if (!canGenerate) {
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/ai/try-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim() }),
      });

      const payload = (await response.json()) as Partial<DemoResult> & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "The demo generator hit a snag. Please try again.");
      }

      if (!payload.article?.trim() || !payload.title?.trim()) {
        throw new Error("The demo generator returned an incomplete draft. Please try again.");
      }

      setResult({
        title: payload.title,
        summary: payload.summary?.trim() || "",
        article: payload.article,
        model: payload.model || "",
      });
      setStatus("done");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The demo generator hit a snag. Please try again.",
      );
      setStatus("idle");
    }
  }

  function handleTryAnother() {
    setResult(null);
    setStatus("idle");
    setErrorMessage("");
  }

  function handleContinue() {
    storeHomeIdeaTransfer(idea);
    router.push("/signup");
  }

  return (
    <div className="try-demo-shell">
      <div className="try-demo-hero">
        <p className="home-section-kicker">No account needed</p>
        <h1 className="page-title">See what Pattern Foundry does with your idea.</h1>
        <p className="page-subtitle">
          Paste a rough idea, a voice note you transcribed, or a chat you had with an AI. We&rsquo;ll turn
          it into a publish-ready draft in about ten seconds, right here, before you decide whether to
          create an account.
        </p>
      </div>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      {status !== "done" ? (
        <div className="home-idea-card try-demo-input-card">
          <label htmlFor="try-demo-idea" className="form-label">
            Your rough idea
          </label>
          <textarea
            id="try-demo-idea"
            className="form-textarea home-idea-textarea"
            placeholder={EXAMPLE_PLACEHOLDER}
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            disabled={status === "loading"}
          />
          <div className="try-demo-input-footer">
            <p className={overLimit ? "try-demo-char-count is-over" : "try-demo-char-count"}>
              {trimmedLength}/{MAX_DEMO_IDEA_CHARS} characters
            </p>
            <button
              type="button"
              className="button-link"
              onClick={handleGenerate}
              disabled={!canGenerate}
            >
              {status === "loading" ? "Drafting..." : "Generate my draft"}
            </button>
          </div>
          <p className="home-idea-helper" style={{ marginBottom: 0 }}>
            Free, no sign-up to try. A few generations per visitor per day while this is new.
          </p>
        </div>
      ) : null}

      {status === "done" && result ? (
        <div className="try-demo-result">
          <div className="article-draft-status">
            <span className="badge article-draft-badge">
              {result.model ? `Generated with ${result.model}` : "Generated draft"}
            </span>
            <p className="article-draft-message">
              This is unedited AI output from your exact input — nothing was cleaned up for this demo.
            </p>
          </div>

          <div className="card try-demo-result-card">
            <h2 className="card-title">{result.title}</h2>
            {result.summary ? <p className="article-summary">{result.summary}</p> : null}
            <div className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.article}</ReactMarkdown>
            </div>
          </div>

          <div className="try-demo-cta card">
            <h3 className="card-title" style={{ marginBottom: "0.35rem" }}>
              Like what you see?
            </h3>
            <p className="meta" style={{ marginBottom: "1rem" }}>
              Create a free account to save this draft, refine it with tools that preserve your own
              voice instead of flattening it, and publish it. Your idea will be waiting for you in New
              Post once you&rsquo;re signed in.
            </p>
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <button type="button" className="button-link" onClick={handleContinue}>
                Continue on Pattern Foundry
              </button>
              <button type="button" className="button-link secondary" onClick={handleTryAnother}>
                Try another idea
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
