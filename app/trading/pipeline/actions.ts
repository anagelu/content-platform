"use server";

import { auth } from "@/auth";
import {
  createScreeningCandidate,
  createTrackedPosition,
} from "@/lib/trading-pipeline";
import { redirect } from "next/navigation";

export async function addScreeningCandidate(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = Number(session.user.id);
  const market = formData.get("market")?.toString().trim().toUpperCase() || "";
  const timeframe = formData.get("timeframe")?.toString().trim() || "";
  const setupType = formData.get("setupType")?.toString().trim() || "";
  const direction =
    formData.get("direction")?.toString().trim() === "SHORT" ? "SHORT" : "LONG";
  const thesis = formData.get("thesis")?.toString().trim() || "";
  const catalyst = formData.get("catalyst")?.toString().trim() || "";
  const notes = formData.get("notes")?.toString().trim() || "";
  const fundamentalScore = Number(formData.get("fundamentalScore"));
  const sentimentScore = Number(formData.get("sentimentScore"));
  const technicalScore = Number(formData.get("technicalScore"));

  if (
    !market ||
    !timeframe ||
    !setupType ||
    !thesis ||
    !Number.isFinite(fundamentalScore) ||
    !Number.isFinite(sentimentScore) ||
    !Number.isFinite(technicalScore)
  ) {
    throw new Error("Fill in the screening candidate fields.");
  }

  await createScreeningCandidate({
    userId,
    market,
    timeframe,
    setupType,
    direction,
    thesis,
    catalyst: catalyst || null,
    fundamentalScore,
    sentimentScore,
    technicalScore,
    notes: notes || null,
  });

  redirect("/trading/pipeline");
}

export async function addTrackedPosition(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = Number(session.user.id);
  const market = formData.get("market")?.toString().trim().toUpperCase() || "";
  const timeframe = formData.get("timeframe")?.toString().trim() || "";
  const setupType = formData.get("setupType")?.toString().trim() || "";
  const direction =
    formData.get("direction")?.toString().trim() === "SHORT" ? "SHORT" : "LONG";
  const entryPrice = Number(formData.get("entryPrice"));
  const stopLoss = Number(formData.get("stopLoss"));
  const targetOne = Number(formData.get("targetOne"));
  const targetTwoValue = formData.get("targetTwo")?.toString().trim() || "";
  const notes = formData.get("notes")?.toString().trim() || "";

  if (
    !market ||
    !timeframe ||
    !setupType ||
    !Number.isFinite(entryPrice) ||
    !Number.isFinite(stopLoss) ||
    !Number.isFinite(targetOne)
  ) {
    throw new Error("Fill in the tracked position fields.");
  }

  await createTrackedPosition({
    userId,
    market,
    timeframe,
    setupType,
    direction,
    entryPrice,
    stopLoss,
    targetOne,
    targetTwo: targetTwoValue ? Number(targetTwoValue) : null,
    status: "OPEN",
    notes: notes || null,
  });

  redirect("/trading/pipeline");
}
