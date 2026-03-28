"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readHomeIdeaTransfer } from "@/lib/home-idea-transfer";

export function StudioSeedIdeaCard({
  initialIdea = "",
}: {
  initialIdea?: string;
}) {
  const [idea, setIdea] = useState(initialIdea);

  useEffect(() => {
    if (initialIdea.trim()) {
      return;
    }

    const transferredIdea = readHomeIdeaTransfer();

    if (transferredIdea) {
      setIdea(transferredIdea);
    }
  }, [initialIdea]);

  if (!idea.trim()) {
    return null;
  }

  return (
    <section style={{ marginTop: "1.5rem" }}>
      <div className="card">
        <h2 className="card-title">Seed Idea From Home</h2>
        <p className="meta">
          You brought this idea in from the homepage. Studio works best once the
          idea has been shaped into a post or draft, but the seed is preserved
          here so you do not lose it.
        </p>
        <p className="preview">{idea}</p>
        <div className="toolbar" style={{ marginTop: "1rem", marginBottom: 0 }}>
          <Link href="/posts/new" className="button-link secondary">
            Turn Into Post First
          </Link>
          <Link href="/books/new" className="button-link secondary">
            Turn Into Book Section
          </Link>
        </div>
      </div>
    </section>
  );
}
