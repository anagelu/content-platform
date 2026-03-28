"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { storeHomeIdeaTransfer } from "@/lib/home-idea-transfer";

type PreviewKind = "post" | "book" | "patent" | "distribution";

export type OutputOption = {
  title: string;
  description: string;
  href: string;
  action: string;
  previewKind: PreviewKind;
};

type PreviewData =
  | {
      kind: "post";
      headline: string;
      dek: string;
      paragraphs: string[];
    }
  | {
      kind: "book";
      chapterLabel: string;
      sectionTitle: string;
      subsections: string[];
    }
  | {
      kind: "patent";
      inventionTitle: string;
      problemStatement: string;
      solutionOutline: string;
      claimsPlaceholder: string;
    }
  | {
      kind: "distribution";
      assetTitle: string;
      audienceLine: string;
      bullets: string[];
    };

function normalizeInput(raw: string) {
  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function toTitleCase(value: string) {
  return value.replace(/\w\S*/g, (chunk) => chunk[0].toUpperCase() + chunk.slice(1).toLowerCase());
}

function summarizeIdea(idea: string) {
  const trimmed = idea.trim();

  if (!trimmed) {
    return "";
  }

  const compact = trimmed.replace(/\s+/g, " ");
  return compact.length > 180 ? `${compact.slice(0, 177).trimEnd()}...` : compact;
}

function deriveSeedTitle(idea: string, fallback: string) {
  const firstLine = normalizeInput(idea)[0];

  if (!firstLine) {
    return fallback;
  }

  const cleaned = firstLine.replace(/[.:;,\-]+$/g, "");
  const shortened = cleaned.length > 64 ? `${cleaned.slice(0, 61).trimEnd()}...` : cleaned;
  return toTitleCase(shortened);
}

function buildPreview(kind: PreviewKind, idea: string): PreviewData {
  const lines = normalizeInput(idea);
  const summary = summarizeIdea(idea);

  switch (kind) {
    case "book":
      return {
        kind,
        chapterLabel: lines.length > 0 ? "Chapter direction" : "Chapter 1",
        sectionTitle: deriveSeedTitle(idea, "Section Working Title"),
        subsections:
          lines.length > 0
            ? [
                `Opening movement: ${lines[0]}`,
                `Development beat: ${lines[1] ?? "Expand the central idea into a second subsection."}`,
                `Next subsection: ${lines[2] ?? "Carry the thread into the next manuscript block."}`,
              ]
            : [
                "Opening movement: establish the core scene, question, or argument.",
                "Development beat: deepen the material through a second subsection.",
                "Next subsection: carry the thread into the next chapter block.",
              ],
      };
    case "patent":
      return {
        kind,
        inventionTitle: deriveSeedTitle(idea, "Provisional Invention Frame"),
        problemStatement:
          summary || "Define the practical problem, friction, or inefficiency the invention addresses.",
        solutionOutline:
          lines[1] || "Outline the system, method, or mechanism that resolves the problem.",
        claimsPlaceholder:
          "Claims placeholder: the workspace will structure key inventive elements and protected distinctions.",
      };
    case "distribution":
      return {
        kind,
        assetTitle: deriveSeedTitle(idea, "Channel-Ready Asset Draft"),
        audienceLine:
          lines[0]
            ? `Channel fit: shape this for audiences interested in ${lines[0].toLowerCase()}.`
            : "Channel fit: shape this into a social post, newsletter block, promo note, or campaign asset.",
        bullets:
          lines.length > 0
            ? [
                `Key message: ${lines[0]}`,
                `Audience hook: ${lines[1] ?? "Translate the idea into a concise audience-facing benefit."}`,
                `Promo angle: ${lines[2] ?? "Package the strongest line into a reusable distribution beat."}`,
              ]
            : [
                "Key message: distill the strongest takeaway.",
                "Audience hook: frame why the idea matters now.",
                "Promo angle: package a reusable distribution beat.",
              ],
      };
    case "post":
    default:
      return {
        kind: "post",
        headline: deriveSeedTitle(idea, "Working Headline for the Draft"),
        dek:
          summary || "A short subheading will frame the main takeaway before the full article draft begins.",
        paragraphs:
          lines.length > 0
            ? [
                summary || lines[0],
                lines[1] || "The workspace will expand this into a stronger opening paragraph with structure and pacing.",
              ]
            : [
                "The opening paragraph will turn the rough idea into a readable setup.",
                "Supporting paragraphs will be drafted and refined in the full post workspace.",
              ],
      };
  }
}

export function HomeIdeaStarter({
  outputOptions,
}: {
  outputOptions: OutputOption[];
}) {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [selectedHref, setSelectedHref] = useState(outputOptions[0]?.href ?? "/posts/new");
  const [isPreviewRefreshing, setIsPreviewRefreshing] = useState(false);
  const canGenerate = idea.trim().length > 0 && Boolean(selectedHref);
  const selectedOption =
    outputOptions.find((option) => option.href === selectedHref) ?? outputOptions[0];
  const preview = useMemo(
    () => buildPreview(selectedOption?.previewKind ?? "post", idea),
    [idea, selectedOption],
  );

  useEffect(() => {
    setIsPreviewRefreshing(true);
    const timeoutId = window.setTimeout(() => {
      setIsPreviewRefreshing(false);
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [idea, selectedHref]);

  function handleGoToSelectedOutput() {
    const target = outputOptions.find((option) => option.href === selectedHref);

    if (!target) {
      return;
    }

    storeHomeIdeaTransfer(idea);
    router.push(target.href);
  }

  return (
    <div className="home-idea-shell">
      <div className="home-idea-card">
        <label htmlFor="idea-seed" className="form-label">
          Rough idea, conversation, or invention note
        </label>
        <textarea
          id="idea-seed"
          className="form-textarea home-idea-textarea"
          placeholder="Paste a conversation, rough note, or invention idea..."
          value={idea}
          onChange={(event) => setIdea(event.target.value)}
        />
        <p className="home-idea-helper">
          Capture the rough material first. Choose the output next. Full editing and refinement happen in the workspace.
        </p>

        <div className="home-output-step-header">
          <p className="home-section-kicker">Step 2</p>
          <h3 className="card-title">Choose what to turn this into</h3>
          <p className="meta">
            Pick the destination that best matches the structure you want next.
          </p>
        </div>

        <div className="home-output-action-row">
          {outputOptions.map((option) => {
            const selected = option.href === selectedHref;

            return (
              <button
                key={option.title}
                type="button"
                onClick={() => setSelectedHref(option.href)}
                className={selected ? "home-output-pill is-selected" : "home-output-pill"}
                aria-pressed={selected}
              >
                <span className="home-output-pill-title">{option.title}</span>
                <span className="home-output-pill-copy">{option.action}</span>
                <span className="home-output-pill-description">{option.description}</span>
              </button>
            );
          })}
        </div>

        <div className="toolbar" style={{ marginTop: "1rem", marginBottom: 0 }}>
          <button
            type="button"
            className="button-link"
            onClick={handleGoToSelectedOutput}
            disabled={!canGenerate}
          >
            Continue in {selectedOption?.title ?? "Workspace"} Workspace
          </button>
        </div>
      </div>

      <aside
        className={
          isPreviewRefreshing ? "home-preview-card is-refreshing" : "home-preview-card"
        }
        aria-live="polite"
      >
        <div className="home-preview-header">
          <div>
            <p className="home-preview-label">Preview</p>
            <h3 className="card-title" style={{ marginBottom: "0.2rem" }}>
              {selectedOption?.title ?? "Draft"} structure
            </h3>
          </div>
          <span className="home-preview-status">
            {isPreviewRefreshing ? "Shaping..." : "Read-only"}
          </span>
        </div>
        <p className="home-preview-helper">
          This shows how your idea will be shaped next. Full editing happens in the workspace.
        </p>

        {preview.kind === "post" ? (
          <div className="home-preview-article">
            <p className="home-preview-kicker">Article preview</p>
            <h4 className="home-preview-title">{preview.headline}</h4>
            <p className="home-preview-dek">{preview.dek}</p>
            <div className="home-preview-paragraphs">
              {preview.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        ) : null}

        {preview.kind === "book" ? (
          <div className="home-preview-book">
            <p className="home-preview-kicker">{preview.chapterLabel}</p>
            <h4 className="home-preview-title">{preview.sectionTitle}</h4>
            <div className="home-preview-list">
              {preview.subsections.map((line) => (
                <div key={line} className="home-preview-list-item">
                  {line}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {preview.kind === "patent" ? (
          <div className="home-preview-patent">
            <p className="home-preview-kicker">Filing structure</p>
            <h4 className="home-preview-title">{preview.inventionTitle}</h4>
            <div className="home-preview-detail">
              <span>Problem</span>
              <p>{preview.problemStatement}</p>
            </div>
            <div className="home-preview-detail">
              <span>Solution</span>
              <p>{preview.solutionOutline}</p>
            </div>
            <div className="home-preview-detail">
              <span>Claims</span>
              <p>{preview.claimsPlaceholder}</p>
            </div>
          </div>
        ) : null}

        {preview.kind === "distribution" ? (
          <div className="home-preview-distribution">
            <p className="home-preview-kicker">Channel-ready asset</p>
            <h4 className="home-preview-title">{preview.assetTitle}</h4>
            <p className="home-preview-dek">{preview.audienceLine}</p>
            <div className="home-preview-list">
              {preview.bullets.map((line) => (
                <div key={line} className="home-preview-list-item">
                  {line}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
