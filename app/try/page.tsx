import type { Metadata } from "next";
import { TryDemo } from "./try-demo";

export const metadata: Metadata = {
  title: "Try Pattern Foundry | Paste An Idea, Get A Draft",
  description:
    "Paste a rough idea, note, or conversation and watch Pattern Foundry turn it into a publish-ready draft in about ten seconds. No account needed to try it.",
};

export default function TryPage() {
  return (
    <main>
      <div className="site-shell">
        <TryDemo />
      </div>
    </main>
  );
}
