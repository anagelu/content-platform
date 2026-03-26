"use server";

import { auth } from "@/auth";
import {
  setAiCapacityTier,
  setAiProvider,
  type AiCapacityTier,
  type AiProvider,
} from "@/lib/ai-admin";
import { redirect } from "next/navigation";

export async function updateAiCapacityTier(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/");
  }

  const tier = formData.get("tier");

  if (tier !== "low" && tier !== "medium" && tier !== "high") {
    throw new Error("Choose a valid AI capacity tier.");
  }

  await setAiCapacityTier(tier as AiCapacityTier);

  redirect("/admin/ai?range=30d");
}

export async function updateAiProvider(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/");
  }

  const provider = formData.get("provider");

  if (provider !== "openai" && provider !== "gemini") {
    throw new Error("Choose a valid AI provider.");
  }

  await setAiProvider(provider as AiProvider);

  redirect("/admin/ai?range=30d");
}
