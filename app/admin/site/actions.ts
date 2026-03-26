"use server";

import { auth } from "@/auth";
import {
  defaultSiteSettings,
  updateSiteSettings,
  type SiteSettings,
} from "@/lib/site-settings";
import { redirect } from "next/navigation";

export async function saveSiteSettings(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/");
  }

  const nextValues = Object.fromEntries(
    (Object.keys(defaultSiteSettings) as Array<keyof SiteSettings>).map((key) => [
      key,
      formData.get(key)?.toString() ?? "",
    ]),
  ) as Partial<Record<keyof SiteSettings, string>>;

  await updateSiteSettings(nextValues);

  redirect("/admin/site?saved=1");
}
