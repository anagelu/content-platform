import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use | Pattern Foundry",
  description:
    "Review the Terms of Use for Pattern Foundry, including acceptable use, account responsibilities, platform limitations, and trading-related disclaimers.",
};

const sections = [
  {
    title: "Acceptance of Terms",
    body:
      "By accessing or using Pattern Foundry, you agree to these Terms of Use. If you do not agree, do not use the platform.",
  },
  {
    title: "Use of the Platform",
    body:
      "Pattern Foundry provides tools for drafting content, organizing ideas, reviewing market structure, and managing connected workflows. You agree to use the platform only for lawful purposes and in a way that does not interfere with the service or other users.",
  },
  {
    title: "Accounts and Access",
    body:
      "You are responsible for maintaining the confidentiality of your account credentials and for activity that occurs under your account. You agree to provide accurate information and notify us if you believe your account has been compromised.",
  },
  {
    title: "Connected Services",
    body:
      "If you connect a third-party account such as Alpaca, you authorize Pattern Foundry to access the scopes you approve. You are responsible for reviewing the permissions you grant and for disconnecting services you no longer want linked.",
  },
  {
    title: "Trading and Market Data Disclaimer",
    body:
      "Pattern Foundry may display market data, technical indicators, workflow suggestions, and controller states, but nothing on the platform constitutes investment advice, financial advice, or a recommendation to trade. You remain solely responsible for your decisions, orders, and risk management.",
  },
  {
    title: "Intellectual Property",
    body:
      "You retain ownership of the content you create and upload, subject to any rights needed for the platform to provide its services. Pattern Foundry and its original software, design, and branding remain protected by applicable intellectual property laws.",
  },
  {
    title: "Service Availability",
    body:
      "We may update, modify, suspend, or discontinue parts of the platform at any time. We do not guarantee uninterrupted availability, error-free operation, or continued support for every feature.",
  },
  {
    title: "Limitation of Liability",
    body:
      "To the fullest extent permitted by law, Pattern Foundry is provided on an as-is basis without warranties of any kind. We are not liable for indirect, incidental, special, consequential, or punitive damages arising from your use of the platform.",
  },
  {
    title: "Changes to These Terms",
    body:
      "We may update these Terms of Use from time to time. Continued use of the platform after updates means you accept the revised terms.",
  },
  {
    title: "Contact",
    body:
      "If you have questions about these terms, contact the site operator through the contact information provided on the website.",
  },
];

export default function TermsPage() {
  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">Terms of Use</h1>
        <p className="page-subtitle">
          These terms describe how Pattern Foundry may be used and the responsibilities
          that apply when you create an account, connect services, or use trading-related
          workflows.
        </p>

        <div className="toolbar">
          <Link href="/privacy" className="button-link secondary">
            View Privacy Policy
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
