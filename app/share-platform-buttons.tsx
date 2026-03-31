"use client";

import { useMemo, useState } from "react";

type SharePlatformButtonsProps = {
  title: string;
  summary?: string | null;
};

export function SharePlatformButtons({
  title,
  summary,
}: SharePlatformButtonsProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const currentUrl = typeof window === "undefined" ? "" : window.location.href;
  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  const shareText = useMemo(() => {
    const trimmedSummary = summary?.trim();

    if (trimmedSummary) {
      return `${title} - ${trimmedSummary}`;
    }

    return title;
  }, [summary, title]);

  const shareLinks = useMemo(() => {
    const encodedUrl = encodeURIComponent(currentUrl);
    const encodedTitle = encodeURIComponent(title);
    const encodedText = encodeURIComponent(shareText);

    return {
      x: `https://x.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      linkedIn: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${shareText}\n\n${currentUrl}`)}`,
    };
  }, [currentUrl, shareText, title]);

  async function handleNativeShare() {
    if (!currentUrl || !canNativeShare) {
      return;
    }

    try {
      await navigator.share({
        title,
        text: summary?.trim() || title,
        url: currentUrl,
      });
    } catch {
      // Ignore cancellation and platform share errors to keep the UI quiet.
    }
  }

  async function handleCopyLink() {
    if (!currentUrl) {
      setCopyStatus("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopyStatus("copied");
      window.setTimeout(() => {
        setCopyStatus("idle");
      }, 2000);
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <section className="share-panel" aria-label="Share this page">
      <div className="share-panel-header">
        <div>
          <p className="share-panel-kicker">Share</p>
          <h2 className="share-panel-title">Send this to the platform where it can travel.</h2>
        </div>
        <p className="share-panel-helper">
          Use the current page link to share this piece on different platforms.
        </p>
      </div>

      <div className="share-platform-grid">
        {canNativeShare ? (
          <button type="button" className="share-platform-button is-primary" onClick={handleNativeShare}>
            Share...
          </button>
        ) : null}

        <a
          href={currentUrl ? shareLinks.x : "#"}
          target="_blank"
          rel="noreferrer"
          className="share-platform-button"
          aria-disabled={!currentUrl}
        >
          X
        </a>
        <a
          href={currentUrl ? shareLinks.linkedIn : "#"}
          target="_blank"
          rel="noreferrer"
          className="share-platform-button"
          aria-disabled={!currentUrl}
        >
          LinkedIn
        </a>
        <a
          href={currentUrl ? shareLinks.facebook : "#"}
          target="_blank"
          rel="noreferrer"
          className="share-platform-button"
          aria-disabled={!currentUrl}
        >
          Facebook
        </a>
        <a
          href={currentUrl ? shareLinks.email : "#"}
          className="share-platform-button"
          aria-disabled={!currentUrl}
        >
          Email
        </a>
        <button type="button" className="share-platform-button" onClick={handleCopyLink}>
          {copyStatus === "copied" ? "Copied" : "Copy Link"}
        </button>
      </div>

      {copyStatus === "error" ? (
        <p className="share-panel-feedback">The link was not ready to copy. Try again in a moment.</p>
      ) : null}
    </section>
  );
}
