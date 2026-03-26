import { auth } from "@/auth";
import {
  defaultSiteSettings,
  getSiteSettings,
  type SiteSettings,
} from "@/lib/site-settings";
import Link from "next/link";
import { redirect } from "next/navigation";
import { saveSiteSettings } from "./actions";

const groups: Array<{
  title: string;
  description: string;
  fields: Array<{
    key: keyof SiteSettings;
    label: string;
    multiline?: boolean;
  }>;
}> = [
  {
    title: "Homepage Hero",
    description: "Control the first message visitors see on the home page.",
    fields: [
      { key: "homeHeroKicker", label: "Hero kicker" },
      { key: "homeHeroTitle", label: "Hero title", multiline: true },
      { key: "homeHeroSubtitle", label: "Hero subtitle", multiline: true },
    ],
  },
  {
    title: "Homepage Flow",
    description: "Adjust the process language used in the right-side flow card.",
    fields: [
      { key: "homeFlowLabel", label: "Flow label" },
      { key: "homeFlowStepOne", label: "Flow step one", multiline: true },
      { key: "homeFlowStepTwo", label: "Flow step two", multiline: true },
      { key: "homeFlowStepThree", label: "Flow step three", multiline: true },
      { key: "homeFlowStepFour", label: "Flow step four", multiline: true },
    ],
  },
  {
    title: "Homepage Sections",
    description: "Tune the framing copy for the main landing sections.",
    fields: [
      { key: "homeIdeaStepKicker", label: "Idea section kicker" },
      { key: "homeIdeaStepTitle", label: "Idea section title", multiline: true },
      { key: "homeIdeaStepSubtitle", label: "Idea section subtitle", multiline: true },
      { key: "homeGenerateStepKicker", label: "Generate section kicker" },
      { key: "homeGenerateStepTitle", label: "Generate section title", multiline: true },
      { key: "homeRecentKicker", label: "Recent section kicker" },
      { key: "homeRecentTitle", label: "Recent section title", multiline: true },
    ],
  },
  {
    title: "Sidebar Copy",
    description: "Edit the descriptions used in the sidebar navigation cards.",
    fields: [
      { key: "sidebarMainPathsDescription", label: "Main Paths description", multiline: true },
      { key: "sidebarPublishingDescription", label: "Publishing description", multiline: true },
      { key: "sidebarBooksDescription", label: "Books description", multiline: true },
      { key: "sidebarPatentsDescription", label: "Patents description", multiline: true },
      { key: "sidebarStudioDescription", label: "Studio description", multiline: true },
      { key: "sidebarCategoriesDescription", label: "Categories description", multiline: true },
      { key: "sidebarTradingDescription", label: "Trading description", multiline: true },
      { key: "sidebarInboxDescription", label: "Inbox description", multiline: true },
      { key: "sidebarOsDescription", label: "OS description", multiline: true },
      { key: "sidebarAdminDescription", label: "Admin description", multiline: true },
      { key: "sidebarAccountDescription", label: "Account description", multiline: true },
      { key: "sidebarMoreDescription", label: "More disclosure description", multiline: true },
    ],
  },
];

export default async function AdminSiteSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/");
  }

  const [settings, resolvedSearchParams] = await Promise.all([
    getSiteSettings(),
    searchParams ? searchParams : Promise.resolve({} as { saved?: string }),
  ]);

  const saved = resolvedSearchParams.saved === "1";

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">Site Settings</h1>
        <p className="page-subtitle">
          Update headline and navigation copy without redeploying the app.
        </p>

        <div className="toolbar">
          <Link href="/" className="button-link secondary">
            View Home
          </Link>
          <Link href="/admin/ai?range=30d" className="button-link secondary">
            AI Admin
          </Link>
        </div>

        {saved ? (
          <div className="card" style={{ marginTop: "1.5rem" }}>
            <p className="preview">Site settings updated successfully.</p>
          </div>
        ) : null}

        <form action={saveSiteSettings} style={{ marginTop: "2rem" }}>
          <div className="card-list">
            {groups.map((group) => (
              <section key={group.title} className="card">
                <h2 className="trading-section-title">{group.title}</h2>
                <p className="meta" style={{ marginBottom: "1.25rem" }}>
                  {group.description}
                </p>

                {group.fields.map((field) => (
                  <div key={field.key} className="form-group">
                    <label htmlFor={field.key} className="form-label">
                      {field.label}
                    </label>
                    {field.multiline ? (
                      <textarea
                        id={field.key}
                        name={field.key}
                        className="form-textarea"
                        defaultValue={settings[field.key]}
                        rows={4}
                      />
                    ) : (
                      <input
                        id={field.key}
                        name={field.key}
                        type="text"
                        className="form-input"
                        defaultValue={settings[field.key]}
                      />
                    )}
                    <p className="form-help">
                      Default: {defaultSiteSettings[field.key]}
                    </p>
                  </div>
                ))}
              </section>
            ))}
          </div>

          <div className="toolbar" style={{ marginTop: "1.5rem" }}>
            <button type="submit" className="submit-button">
              Save Site Settings
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
