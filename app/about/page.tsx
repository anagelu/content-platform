import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | Pattern Foundry",
  description:
    "Learn why Pattern Foundry exists and how it helps turn raw conversations, notes, and rough thinking into posts you can refine, save, and share.",
};

const aboutSections = [
  {
    kicker: "Why This Exists",
    title: "Too many good ideas disappear before they ever take form.",
    body:
      "A lot of useful thinking now happens in chat windows, notes apps, copied logs, and unfinished drafts. The problem is not that people lack ideas. The problem is that those ideas often stay trapped in places that were never built to help them grow. Pattern Foundry exists to give that thinking a place to land before it gets buried.",
  },
  {
    kicker: "What The Platform Does",
    title: "It turns rough input into something clearer, more usable, and easier to share.",
    body:
      "Paste a conversation, a note, or a block of raw text, and Pattern Foundry helps transform it into a structured post. That matters because structure changes how an idea can be used. Once something is shaped into a post, it becomes easier to revisit, edit, organize, publish, and build on over time.",
  },
  {
    kicker: "Why This Matters",
    title: "A strong idea is far more valuable when it can be reused, refined, and shared.",
    body:
      "Some ideas do not fail because they are weak. They fail because they are never captured clearly enough to survive. When a thought stays buried inside a long chat or scattered note, it is hard to return to and even harder to show to someone else. Giving it structure makes it more visible, more durable, and more likely to become something real.",
  },
  {
    kicker: "Bigger Vision",
    title: "Pattern Foundry is built for people who think in fragments but want to create in public.",
    body:
      "The long-term vision is to make raw thinking more useful. A note can become a post. A post can become a collection. A collection can become a project, a body of work, or a public point of view. Pattern Foundry is meant to help that progression happen more naturally, so ideas do not have to be fully polished before they begin to matter.",
  },
];

const beforeAfterItems = [
  {
    label: "Before",
    title: "Raw input",
    examples: [
      "Messy AI conversation",
      "Phone note with half-finished thoughts",
      "Copied terminal output or research notes",
    ],
  },
  {
    label: "After",
    title: "Usable output",
    examples: [
      "A structured post with a clearer point",
      "Something you can edit and return to later",
      "A draft you can share to platforms like LinkedIn or Facebook",
    ],
  },
];

export default function AboutPage() {
  return (
    <main className="site-shell about-page">
      <section className="about-hero">
        <div className="about-hero-copy">
          <p className="home-hero-kicker">About Pattern Foundry</p>
          <h1 className="page-title">Turn conversations into something you can use</h1>
          <p className="page-subtitle">
            Good ideas often begin as rough notes, raw chats, copied logs, or unfinished thoughts.
            Pattern Foundry helps turn that scattered input into posts you can refine, revisit, and
            share.
          </p>

          <div className="toolbar">
            <Link href="/#start-with-an-idea" className="button-link">
              Start with an idea
            </Link>
            <Link href="/posts" className="button-link secondary">
              Browse posts
            </Link>
          </div>
        </div>

        <aside className="about-hero-panel">
          <p className="about-panel-kicker">Core Belief</p>
          <h2 className="about-panel-title">Good thinking should not disappear just because it started messy.</h2>
          <p className="about-panel-copy">
            The goal is not to force every thought into a polished final product. The goal is to
            help useful ideas survive long enough to become something you can actually work with.
          </p>

          <div className="about-signal-list" aria-label="Platform values">
            <div className="about-signal-item">
              <span className="about-signal-label">Capture</span>
              <strong>Pull ideas out of chats, notes, and other scattered places.</strong>
            </div>
            <div className="about-signal-item">
              <span className="about-signal-label">Shape</span>
              <strong>Turn fragments into a clearer draft with structure.</strong>
            </div>
            <div className="about-signal-item">
              <span className="about-signal-label">Share</span>
              <strong>Make your thinking easier to revisit, publish, and build on.</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="about-intro-card">
        <p className="about-intro-lead">
          Valuable thinking now happens in places that were never designed to preserve it.
        </p>
        <p className="preview">
          Chats move fast. Notes get buried. Drafts stay unfinished. Pattern Foundry is designed to
          bridge the gap between raw thinking and usable output, so strong ideas do not disappear
          before they have a chance to develop.
        </p>
      </section>

      <section className="about-section-stack" aria-label="About sections">
        {aboutSections.map((section, index) => (
          <article key={section.kicker} className="about-story-card">
            <div className="about-story-index">0{index + 1}</div>
            <div>
              <p className="home-section-kicker">{section.kicker}</p>
              <h2 className="trading-section-title about-story-title">{section.title}</h2>
              <p className="about-story-body">{section.body}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="about-section-stack" aria-label="Before and after">
        {beforeAfterItems.map((item, index) => (
          <article key={item.label} className="about-story-card">
            <div className="about-story-index">0{index + 5}</div>
            <div>
              <p className="home-section-kicker">{item.label}</p>
              <h2 className="trading-section-title about-story-title">{item.title}</h2>
              <ul className="about-story-body" style={{ paddingLeft: "1.25rem", margin: 0 }}>
                {item.examples.map((example) => (
                  <li key={example} style={{ marginBottom: "0.5rem" }}>
                    {example}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </section>

      <section className="about-closing-card">
        <p className="about-closing-kicker">Closing Thought</p>
        <h2 className="about-closing-title">
          Stop losing your best thoughts. Capture them, shape them, and turn them into something
          you can keep, improve, and share.
        </h2>
        <div className="toolbar">
          <Link href="/#start-with-an-idea" className="button-link">
            Capture an idea
          </Link>
          <Link href="/search" className="button-link secondary">
            Explore the archive
          </Link>
        </div>
      </section>
    </main>
  );
}