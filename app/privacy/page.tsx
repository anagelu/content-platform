import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Pattern Foundry",
  description:
    "Review the Privacy Policy for Pattern Foundry, including how account data, connected-service tokens, usage data, and user content are handled.",
};

const sections = [
  {
    title: "Information We Collect",
    body:
      "Pattern Foundry may collect account information, profile details, submitted content, connected-service metadata, and technical usage information necessary to operate the platform.",
  },
  {
    title: "How We Use Information",
    body:
      "We use information to authenticate users, save drafts and records, provide requested platform features, support connected account functionality, improve reliability, and protect the platform from misuse.",
  },
  {
    title: "Connected Accounts and Tokens",
    body:
      "If you connect a third-party service such as Alpaca, Pattern Foundry stores the access information required to maintain that connection. Sensitive access tokens are stored using encryption and are used only to provide the permissions you approved.",
  },
  {
    title: "Market and Workflow Data",
    body:
      "When trading or market-related features are used, Pattern Foundry may process symbols, account state, order information, positions, market data, and strategy settings in order to display gauges, summaries, and controller actions.",
  },
  {
    title: "Content and User Inputs",
    body:
      "Content you submit, including notes, drafts, messages, and prompts, may be stored so you can continue your work later. We do not claim ownership of your original content.",
  },
  {
    title: "Data Sharing",
    body:
      "We do not sell your personal information. Information may be shared only with service providers or connected platforms as needed to operate the service you requested, comply with legal obligations, or protect the platform and its users.",
  },
  {
    title: "Data Security",
    body:
      "We take reasonable steps to protect stored data, but no system can guarantee absolute security. You are responsible for protecting your own credentials and devices.",
  },
  {
    title: "Data Retention",
    body:
      "We retain information for as long as needed to provide the platform, maintain records, comply with legal obligations, resolve disputes, and enforce platform policies.",
  },
  {
    title: "Your Choices",
    body:
      "You may choose whether to create an account, submit content, or connect third-party services. If supported by the platform workflow, you may request removal of connected access or account data.",
  },
  {
    title: "Changes to This Policy",
    body:
      "We may update this Privacy Policy from time to time. Continued use of Pattern Foundry after updates means you accept the revised policy.",
  },
];

export default function PrivacyPage() {
  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">Privacy Policy</h1>
        <p className="page-subtitle">
          This policy explains how Pattern Foundry handles account information, stored
          content, connected-service access, and usage data.
        </p>

        <div className="toolbar">
          <Link href="/terms" className="button-link secondary">
            View Terms of Use
          </Link>
          <Link href="/about" className="button-link secondary">
            About Pattern Foundry
          </Link>
        </div>

        <div className="card-list" style={{ marginTop: "1.5rem" }}>
          {sections.map((section) => (
            <article key={section.title} className="card">
              <h2 className="card-title">{section.title}</h2>
              <p className="preview" style={{ marginBottom: 0 }}>
                {section.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
