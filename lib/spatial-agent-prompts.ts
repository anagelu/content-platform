export type SpatialAgentMode = "passive_hud" | "active_workspace";

export type SpatialBehaviorProfile = {
  copiedText?: string;
  copiedSymbol?: string;
  recentHoverPattern?: string[];
  inferredInterests?: string[];
};

export type SpatialCockpitContext = {
  symbol: string;
  timeframe: string;
  mode: "standard" | "turbo";
  overallConfluence?: number | null;
  sessionState?: string;
  price?: number | null;
  priceChangePercent?: number | null;
  topCandleSignal?: string;
  executionLockReason?: string;
};

export type SpatialGaugeTarget = {
  kind: "execution" | "trend" | "timeframe_confluence";
  label: string;
  score: number;
  band: string;
  summary: string;
  subscores?: Array<{
    label: string;
    score: number;
  }>;
  nearbyTimeframes?: Array<{
    label: string;
    timeframe: string;
    score: number;
    summary: string;
  }>;
};

export type SpatialContractTarget = {
  kind: "contract_card";
  label: string;
  symbol: string;
  fitScore: number;
  markPrice?: number | null;
  breakevenPrice?: number | null;
  impliedVolatility?: number | null;
  spreadLabel?: string;
  delta?: number | null;
  summary: string;
};

export type SpatialPromptTarget = SpatialGaugeTarget | SpatialContractTarget;

export type SpatialPromptContract = {
  systemInstruction: string;
  userText: string;
};

function joinList(values: string[] | undefined, fallback = "(none)") {
  if (!values || values.length === 0) {
    return fallback;
  }

  return values.join(", ");
}

function formatBehaviorProfile(profile?: SpatialBehaviorProfile) {
  if (!profile) {
    return "(no prior behavior profile)";
  }

  return [
    `Copied text: ${profile.copiedText || "(none)"}`,
    `Copied symbol: ${profile.copiedSymbol || "(none)"}`,
    `Recent hover pattern: ${joinList(profile.recentHoverPattern)}`,
    `Inferred interests: ${joinList(profile.inferredInterests)}`,
  ].join("\n");
}

function formatCockpitContext(context: SpatialCockpitContext) {
  return [
    `Symbol: ${context.symbol}`,
    `Timeframe: ${context.timeframe}`,
    `Cockpit mode: ${context.mode}`,
    `Overall confluence: ${context.overallConfluence ?? "(unavailable)"}`,
    `Session state: ${context.sessionState || "(unknown)"}`,
    `Price: ${context.price ?? "(unavailable)"}`,
    `Price change percent: ${context.priceChangePercent ?? "(unavailable)"}`,
    `Top candle signal: ${context.topCandleSignal || "(none)"}`,
    `Execution lock reason: ${context.executionLockReason || "(none)"}`,
  ].join("\n");
}

function formatGaugeTarget(target: SpatialGaugeTarget) {
  const lines = [
    `Target kind: ${target.kind}`,
    `Label: ${target.label}`,
    `Score: ${target.score}`,
    `Band: ${target.band}`,
    `Summary: ${target.summary}`,
  ];

  if (target.subscores && target.subscores.length > 0) {
    lines.push(
      `Subscores:\n${target.subscores
        .map((subscore) => `- ${subscore.label}: ${subscore.score}`)
        .join("\n")}`,
    );
  }

  if (target.nearbyTimeframes && target.nearbyTimeframes.length > 0) {
    lines.push(
      `Nearby timeframe reads:\n${target.nearbyTimeframes
        .map(
          (entry) =>
            `- ${entry.label} (${entry.timeframe}): ${entry.score} | ${entry.summary}`,
        )
        .join("\n")}`,
    );
  }

  return lines.join("\n");
}

function formatContractTarget(target: SpatialContractTarget) {
  return [
    `Target kind: ${target.kind}`,
    `Label: ${target.label}`,
    `Contract symbol: ${target.symbol}`,
    `Fit score: ${target.fitScore}`,
    `Mark price: ${target.markPrice ?? "(unavailable)"}`,
    `Breakeven price: ${target.breakevenPrice ?? "(unavailable)"}`,
    `Implied volatility: ${target.impliedVolatility ?? "(unavailable)"}`,
    `Spread label: ${target.spreadLabel || "(unavailable)"}`,
    `Delta: ${target.delta ?? "(unavailable)"}`,
    `Summary: ${target.summary}`,
  ].join("\n");
}

function buildSharedSystemInstruction(mode: SpatialAgentMode) {
  return `You are the Pattern Foundry Spatial Agent. You explain one hovered UI target inside the trading cockpit with precise, instrument-like language. Stay grounded in the provided structured context and behavior profile. Do not invent hidden values. Prefer the hovered target first, then the cockpit state, then the behavior profile. ${mode === "passive_hud" ? "Keep the explanation short enough for a floating cursor HUD." : "You may provide a deeper explanation because the user opened the active workspace."} When helpful, suggest the next best action, but do not claim you executed anything.`;
}

export function buildExecutionSpatialPrompt({
  cockpit,
  target,
  behavior,
  mode = "passive_hud",
}: {
  cockpit: SpatialCockpitContext;
  target: SpatialGaugeTarget;
  behavior?: SpatialBehaviorProfile;
  mode?: SpatialAgentMode;
}): SpatialPromptContract {
  return {
    systemInstruction: `${buildSharedSystemInstruction(mode)} Focus on liquidity, slippage, quote quality, and whether the execution state is safe enough to act.`,
    userText: `Explain the hovered Execution target.

Cockpit context:
${formatCockpitContext(cockpit)}

Hovered target:
${formatGaugeTarget(target)}

Behavior profile:
${formatBehaviorProfile(behavior)}

Answer in three parts:
1. What Execution means right now.
2. Why it matters for this symbol and timeframe.
3. What the safest next action is.`,
  };
}

export function buildTrendSpatialPrompt({
  cockpit,
  target,
  behavior,
  mode = "passive_hud",
}: {
  cockpit: SpatialCockpitContext;
  target: SpatialGaugeTarget;
  behavior?: SpatialBehaviorProfile;
  mode?: SpatialAgentMode;
}): SpatialPromptContract {
  return {
    systemInstruction: `${buildSharedSystemInstruction(mode)} Focus on directional structure, EMA relationships, and whether the trend context is clean, mixed, or fragile.`,
    userText: `Explain the hovered Trend target.

Cockpit context:
${formatCockpitContext(cockpit)}

Hovered target:
${formatGaugeTarget(target)}

Behavior profile:
${formatBehaviorProfile(behavior)}

Answer in three parts:
1. What the trend score is saying.
2. Whether the current trend context supports continuation, caution, or patience.
3. What the user should check next.`,
  };
}

export function buildTimeframeConfluenceSpatialPrompt({
  cockpit,
  target,
  behavior,
  mode = "passive_hud",
}: {
  cockpit: SpatialCockpitContext;
  target: SpatialGaugeTarget;
  behavior?: SpatialBehaviorProfile;
  mode?: SpatialAgentMode;
}): SpatialPromptContract {
  return {
    systemInstruction: `${buildSharedSystemInstruction(mode)} Focus on agreement or conflict across nearby timeframes. Make clear whether higher timeframe structure and lower timeframe timing are aligned.`,
    userText: `Explain the hovered Timeframe Confluence target.

Cockpit context:
${formatCockpitContext(cockpit)}

Hovered target:
${formatGaugeTarget(target)}

Behavior profile:
${formatBehaviorProfile(behavior)}

Answer in three parts:
1. What nearby timeframe agreement looks like.
2. Whether the current base timeframe is confirmed or conflicted.
3. Which timeframe the user should inspect next and why.`,
  };
}

export function buildContractCardSpatialPrompt({
  cockpit,
  target,
  behavior,
  mode = "active_workspace",
}: {
  cockpit: SpatialCockpitContext;
  target: SpatialContractTarget;
  behavior?: SpatialBehaviorProfile;
  mode?: SpatialAgentMode;
}): SpatialPromptContract {
  return {
    systemInstruction: `${buildSharedSystemInstruction(mode)} Focus on why this contract is being suggested, how its fit compares to the current setup, and what risk the user should understand before selecting it.`,
    userText: `Explain the hovered Contract Card target.

Cockpit context:
${formatCockpitContext(cockpit)}

Hovered target:
${formatContractTarget(target)}

Behavior profile:
${formatBehaviorProfile(behavior)}

Answer in three parts:
1. Why this contract is a fit for the current setup.
2. What the user should notice about mark, breakeven, IV, spread, and delta.
3. Whether this looks like a primary candidate, alternate, or pass.`,
  };
}

export function buildSpatialPromptForTarget({
  cockpit,
  target,
  behavior,
  mode,
}: {
  cockpit: SpatialCockpitContext;
  target: SpatialPromptTarget;
  behavior?: SpatialBehaviorProfile;
  mode?: SpatialAgentMode;
}): SpatialPromptContract {
  if (target.kind === "execution") {
    return buildExecutionSpatialPrompt({ cockpit, target, behavior, mode });
  }

  if (target.kind === "trend") {
    return buildTrendSpatialPrompt({ cockpit, target, behavior, mode });
  }

  if (target.kind === "timeframe_confluence") {
    return buildTimeframeConfluenceSpatialPrompt({
      cockpit,
      target,
      behavior,
      mode,
    });
  }

  const contractTarget = target as SpatialContractTarget;
  return buildContractCardSpatialPrompt({
    cockpit,
    target: contractTarget,
    behavior,
    mode,
  });
}
