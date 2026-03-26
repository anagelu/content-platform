import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type SiteSettings = {
  homeHeroKicker: string;
  homeHeroTitle: string;
  homeHeroSubtitle: string;
  homeFlowLabel: string;
  homeFlowStepOne: string;
  homeFlowStepTwo: string;
  homeFlowStepThree: string;
  homeFlowStepFour: string;
  homeIdeaStepKicker: string;
  homeIdeaStepTitle: string;
  homeIdeaStepSubtitle: string;
  homeGenerateStepKicker: string;
  homeGenerateStepTitle: string;
  homeRecentKicker: string;
  homeRecentTitle: string;
  sidebarMainPathsDescription: string;
  sidebarPublishingDescription: string;
  sidebarBooksDescription: string;
  sidebarPatentsDescription: string;
  sidebarStudioDescription: string;
  sidebarCategoriesDescription: string;
  sidebarTradingDescription: string;
  sidebarInboxDescription: string;
  sidebarOsDescription: string;
  sidebarAdminDescription: string;
  sidebarAccountDescription: string;
  sidebarMoreDescription: string;
};

export const defaultSiteSettings: SiteSettings = {
  homeHeroKicker: "Pattern Foundry",
  homeHeroTitle: "Turn rough ideas into durable assets.",
  homeHeroSubtitle:
    "Start messy. Refine later. Paste a conversation, note, or draft and turn it into a post, book section, patent draft, or distribution-ready asset without losing the thread of the idea.",
  homeFlowLabel: "Core Flow",
  homeFlowStepOne: "Paste a conversation, note, or rough draft.",
  homeFlowStepTwo: "Choose the output shape you want to create.",
  homeFlowStepThree: "Refine the draft section by section.",
  homeFlowStepFour: "Publish or distribute when the asset is ready.",
  homeIdeaStepKicker: "Step 1",
  homeIdeaStepTitle: "Capture the rough version first.",
  homeIdeaStepSubtitle:
    "One entry point. Multiple durable outputs. This is the cleanest place to begin the product experience.",
  homeGenerateStepKicker: "Step 3",
  homeGenerateStepTitle: "Generate, refine, and turn the idea into something durable.",
  homeRecentKicker: "Recently Active",
  homeRecentTitle: "Secondary systems stay available, but out of the way.",
  sidebarMainPathsDescription:
    "Start from capture, then move toward finished assets.",
  sidebarPublishingDescription:
    "Shape and organize public-facing writing.",
  sidebarBooksDescription: "Move from idea to structured manuscript draft.",
  sidebarPatentsDescription: "Capture invention logic and filing readiness.",
  sidebarStudioDescription:
    "Repurpose strong ideas into distribution-ready formats.",
  sidebarCategoriesDescription:
    "Navigate the publishing taxonomy and topic clusters.",
  sidebarTradingDescription:
    "Session planning, chart review, journaling, and automation.",
  sidebarInboxDescription: "Capture and process incoming source material.",
  sidebarOsDescription: "Meta workspace for broader operating routines.",
  sidebarAdminDescription: "Inspect provider usage and internal controls.",
  sidebarAccountDescription: "Authentication and account entry points.",
  sidebarMoreDescription:
    "Secondary systems, archives, and deeper workspace areas.",
};
type SiteSettingsKey = keyof SiteSettings;

let ensureSiteSettingsTablePromise: Promise<void> | null = null;

async function ensureSiteSettingsTable() {
  if (!ensureSiteSettingsTablePromise) {
    ensureSiteSettingsTablePromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).then(() => undefined).finally(() => {
      ensureSiteSettingsTablePromise = null;
    });
  }

  return ensureSiteSettingsTablePromise;
}

function isMissingSiteSettingsTableError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("no such table: site_settings") ||
      error.message.includes("does not exist"))
  );
}

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  let rows: Array<{ key: string; value: string }> = [];

  try {
    rows = (await prisma.$queryRawUnsafe(
      `SELECT key, value FROM site_settings`,
    )) as Array<{ key: string; value: string }>;
  } catch (error) {
    if (!isMissingSiteSettingsTableError(error)) {
      throw error;
    }
  }

  const settings: SiteSettings = { ...defaultSiteSettings };

  for (const row of rows) {
    if (row.key in settings) {
      settings[row.key as SiteSettingsKey] = row.value as SiteSettings[SiteSettingsKey];
    }
  }

  return settings;
});

export async function updateSiteSettings(
  values: Partial<Record<SiteSettingsKey, string>>,
) {
  await ensureSiteSettingsTable();

  for (const key of Object.keys(defaultSiteSettings) as SiteSettingsKey[]) {
    if (!(key in values)) {
      continue;
    }

    const rawValue = values[key];
    const trimmedValue = rawValue?.trim();
    const finalValue =
      trimmedValue && trimmedValue.length > 0
        ? trimmedValue
        : defaultSiteSettings[key];

    await prisma.$executeRawUnsafe(
      `INSERT INTO site_settings (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      key,
      finalValue,
    );
  }
}
