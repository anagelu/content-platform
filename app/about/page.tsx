import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | Pattern Foundry",
  description:
    "Learn why Pattern Foundry exists and how it helps turn raw conversations and rough notes into durable posts.",
};

const aboutSections = [
  {
    kicker: "Why This Exists",
    title: "Ideas deserve more than a disappearing text box.",
    body:
      "A lot of valuable thinking now happens inside AI chats, notes apps, text boxes, and rough drafts. But most of it disappears as quickly as it appears. The goal of this platform is to help surface those ideas before they get buried.",
  },
  {
    kicker: "What The Platform Does",
    title: "It gives scattered input a shape you can keep building on.",
    body:
      "Paste a conversation, note, or rough block of text, and turn it into a post. The point is not just text generation. The point is to help users shape scattered input into something clearer, more usable, and easier to build on.",
  },
  {
    kicker: "Why This Matters",
    title: "Lost thinking is usually a capture problem, not an idea problem.",
    body:
      "Some of the best ideas never fail because they were wrong. They fail because they were never captured properly. When thoughts stay trapped in chats or fragments, they are hard to revisit, improve, or share. Giving them structure increases their value.",
  },
  {
    kicker: "Bigger Vision",
    title: "Raw thinking can compound when it has a place to live.",
    body:
      "This platform is built around a simple belief: raw thinking has value. With the right structure, drafts can become posts, posts can become projects, and projects can grow into something much bigger.",
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
            Good ideas often start as messy notes, raw chats, copied logs, or unfinished thoughts.
            This platform helps turn them into structured posts you can refine, revisit, and share.
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
          <h2 className="about-panel-title">Structure helps good thinking survive.</h2>
          <p className="about-panel-copy">
            The work is not to make ideas look polished too early. The work is to keep them from
            getting lost before they can become useful.
          </p>

          <div className="about-signal-list" aria-label="Platform values">
            <div className="about-signal-item">
              <span className="about-signal-label">Capture</span>
              <strong>Pull raw material out of scattered places.</strong>
            </div>
            <div className="about-signal-item">
              <span className="about-signal-label">Shape</span>
              <strong>Turn fragments into a clearer draft structure.</strong>
            </div>
            <div className="about-signal-item">
              <span className="about-signal-label">Build</span>
              <strong>Keep developing the idea instead of restarting it.</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="about-intro-card">
        <p className="about-intro-lead">
          Valuable thinking now happens in places that were never designed to preserve it.
        </p>
        <p className="preview">
          Chats are temporary. Notes get buried. Drafts stay unfinished. Pattern Foundry is meant
          to bridge the gap between raw thinking and usable output, so strong ideas can keep moving
          instead of disappearing.
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

      <section className="about-closing-card">
        <p className="about-closing-kicker">Closing Thought</p>
        <h2 className="about-closing-title">
          Stop losing your best thoughts. Capture them, shape them, and turn them into something
          that lasts.
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
