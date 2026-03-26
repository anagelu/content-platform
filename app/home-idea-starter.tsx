"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OutputOption = {
  title: string;
  description: string;
  href: string;
  action: string;
};

export function HomeIdeaStarter({
  outputOptions,
}: {
  outputOptions: OutputOption[];
}) {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [selectedHref, setSelectedHref] = useState(outputOptions[0]?.href ?? "/posts/new");
  const canGenerate = idea.trim().length > 0 && Boolean(selectedHref);

  function handleGoToSelectedOutput() {
    const target = outputOptions.find((option) => option.href === selectedHref);

    if (!target) {
      return;
    }

    const params = new URLSearchParams();

    if (idea.trim()) {
      params.set("idea", idea);
    }

    router.push(params.size > 0 ? `${target.href}?${params.toString()}` : target.href);
  }

  return (
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
        Don&apos;t worry about structure yet. Messy thoughts welcome. Start anywhere.
      </p>

      <div className="home-output-step-header">
        <p className="home-section-kicker">Step 2</p>
        <h3 className="card-title">Choose what to turn this into</h3>
        <p className="meta">
          Pick the destination that best matches the shape you want next.
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
          Generate Draft
        </button>
      </div>
    </div>
  );
}
