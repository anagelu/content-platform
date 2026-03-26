export type TradingSetupField = {
  key: string;
  label: string;
  placeholder: string;
  help: string;
  required?: boolean;
};

export type TradingSetupDefinition = {
  id: string;
  label: string;
  description: string;
  thesisPrompt: string;
  workflowPrompt: string;
  fields: TradingSetupField[];
};

export type TradingSetupEntry = {
  key: string;
  label: string;
  value: string;
};

export type TradingSetupContext = {
  setupId: string;
  setupLabel: string;
  entries: TradingSetupEntry[];
};

export const TRADING_SETUP_DEFINITIONS: TradingSetupDefinition[] = [
  {
    id: "TREND_CONTINUATION",
    label: "Trend Continuation",
    description:
      "Use this when a market is already trending and you want to join the move instead of fighting it. The goal is to identify the broader direction, wait for a healthy pause or pullback, and enter when the trend shows signs of resuming.",
    thesisPrompt:
      "Describe the higher-timeframe trend, the continuation signal, and what would prove the trend thesis is losing strength.",
    workflowPrompt:
      "List the trend conditions you need, where continuation confirms, and how you manage risk if the move stalls.",
    fields: [
      {
        key: "trend_direction",
        label: "Trend direction",
        placeholder: "Higher highs and higher lows on the daily chart",
        help: "State the broader direction you are leaning on.",
        required: true,
      },
      {
        key: "continuation_trigger",
        label: "Continuation trigger",
        placeholder: "Break above prior 1H high with expanding volume",
        help: "What confirms the trend is resuming?",
        required: true,
      },
      {
        key: "pullback_zone",
        label: "Pullback zone",
        placeholder: "Retest of 20 EMA / prior breakout shelf",
        help: "Where do you want price to reset before entry?",
      },
    ],
  },
  {
    id: "BREAKOUT",
    label: "Breakout",
    description:
      "Use this when price is pressing against an important level and you expect expansion once that barrier gives way. Focus on the exact level, the buildup beneath or above it, and the follow-through that separates a real breakout from a fake move.",
    thesisPrompt:
      "Explain the level that matters, why pressure is building there, and what evidence would separate a real breakout from a fakeout.",
    workflowPrompt:
      "Capture the breakout level, volume/participation clues, and your retest plan if price expands too quickly.",
    fields: [
      {
        key: "breakout_level",
        label: "Breakout level",
        placeholder: "Above 182.40 daily resistance",
        help: "Which level needs to break?",
        required: true,
      },
      {
        key: "compression_context",
        label: "Compression context",
        placeholder: "Tight 3-day base under resistance",
        help: "What kind of coiling or pressure build do you see?",
      },
      {
        key: "confirmation_signal",
        label: "Confirmation signal",
        placeholder: "Volume expands and closes above resistance",
        help: "What proves the breakout has real participation?",
        required: true,
      },
    ],
  },
  {
    id: "MEAN_REVERSION",
    label: "Mean Reversion",
    description:
      "Use this when price has stretched too far from a fair-value reference and looks likely to rotate back. This setup works best when you can define both the overextension and the level price tends to revisit, such as VWAP, a midpoint, or a moving average.",
    thesisPrompt:
      "Describe the stretch away from fair value, the reference mean you expect price to revisit, and what would keep the move trending instead.",
    workflowPrompt:
      "List the stretch signal, the mean/reference level, and how you avoid fading a strong trend too early.",
    fields: [
      {
        key: "stretch_signal",
        label: "Stretch signal",
        placeholder: "3 ATR extension from VWAP after gap-up",
        help: "What tells you price is overextended?",
        required: true,
      },
      {
        key: "mean_reference",
        label: "Mean reference",
        placeholder: "Session VWAP / prior day midpoint",
        help: "What level represents fair value?",
        required: true,
      },
      {
        key: "fade_trigger",
        label: "Fade trigger",
        placeholder: "Lower high after exhaustion wick",
        help: "What pattern lets you step in with better timing?",
      },
    ],
  },
  {
    id: "RANGE_REACTION",
    label: "Range Reaction",
    description:
      "Use this when the market is moving sideways between clear highs and lows rather than trending. The edge comes from reacting at the boundaries of the range and managing the risk that the range may finally break.",
    thesisPrompt:
      "Explain the range structure, which boundary is in play, and what reaction would confirm the range remains intact.",
    workflowPrompt:
      "Note the range high/low, your reaction trigger at the edge, and the condition that would invalidate the range environment.",
    fields: [
      {
        key: "range_high",
        label: "Range high",
        placeholder: "179.80",
        help: "What is the upper boundary?",
        required: true,
      },
      {
        key: "range_low",
        label: "Range low",
        placeholder: "171.20",
        help: "What is the lower boundary?",
        required: true,
      },
      {
        key: "reaction_signal",
        label: "Reaction signal",
        placeholder: "Rejects range low with reclaim candle",
        help: "What signal tells you the boundary is holding?",
      },
    ],
  },
  {
    id: "REVERSAL_RECLAIM",
    label: "Reversal Reclaim",
    description:
      "Use this when a prior move has failed and price is reclaiming an important level that could shift control back the other way. Traders use this to catch a change in character, especially after a breakdown fails or a selloff loses momentum.",
    thesisPrompt:
      "Describe the failed move, the reclaim level, and why that reclaim suggests a real reversal instead of a brief bounce.",
    workflowPrompt:
      "Record the reclaim trigger, what trapped participants may add fuel, and how you manage risk if the reversal fails quickly.",
    fields: [
      {
        key: "reclaim_level",
        label: "Reclaim level",
        placeholder: "Back above prior breakdown level at 96.40",
        help: "Which level needs to be reclaimed?",
        required: true,
      },
      {
        key: "failure_context",
        label: "Failure context",
        placeholder: "Breakdown failed after seller exhaustion",
        help: "What prior move is being unwound?",
      },
      {
        key: "acceptance_signal",
        label: "Acceptance signal",
        placeholder: "Hold above reclaimed level for 2 closes",
        help: "What tells you the reclaim is sticking?",
      },
    ],
  },
  {
    id: "PULLBACK_SUPPORT",
    label: "Pullback To Support",
    description:
      "Use this when a strong market pulls back into an important support area rather than breaking trend entirely. The setup is about finding a favorable location to continue the move after a controlled reset into structure, moving averages, or prior breakout zones.",
    thesisPrompt:
      "Describe the support area, why the pullback still fits the larger bullish or bearish structure, and what price action would confirm the support is holding.",
    workflowPrompt:
      "List the support confluence, the trigger that confirms the bounce or rejection, and how you respond if support fails and the move deepens.",
    fields: [
      {
        key: "support_zone",
        label: "Support zone",
        placeholder: "Prior breakout shelf around 438.20 to 439.10",
        help: "Where should price pull back to if the setup is valid?",
        required: true,
      },
      {
        key: "confluence",
        label: "Confluence",
        placeholder: "Daily 20 EMA, prior high, and VWAP overlap",
        help: "What factors make this support zone more meaningful?",
      },
      {
        key: "hold_signal",
        label: "Hold signal",
        placeholder: "Reclaim candle with higher low on the 15m chart",
        help: "What tells you the pullback is ending and support is respected?",
        required: true,
      },
    ],
  },
  {
    id: "EMA_ALIGNMENT",
    label: "EMA Alignment",
    description:
      "Use this when multiple exponential moving averages are stacked in a clear order and price is respecting them as dynamic support or resistance. The edge comes from trading in the direction of the EMA slope and alignment instead of taking random entries in chop.",
    thesisPrompt:
      "Describe the EMA order, slope, and why price respecting that EMA structure supports a directional trade instead of a mean-reversion idea.",
    workflowPrompt:
      "List the EMA stack you are tracking, where price should react, what confirms continuation, and the condition that would break the EMA thesis.",
    fields: [
      {
        key: "ema_stack",
        label: "EMA stack",
        placeholder: "9 EMA above 20 EMA above 50 EMA",
        help: "Which EMAs are you using and how are they aligned?",
        required: true,
      },
      {
        key: "ema_slope",
        label: "EMA slope",
        placeholder: "All three EMAs are sloping upward with widening separation",
        help: "How are the EMAs sloping or compressing?",
        required: true,
      },
      {
        key: "reaction_zone",
        label: "EMA reaction zone",
        placeholder: "Pullback into the 20 EMA with buyers defending",
        help: "Where should price react if the setup is valid?",
        required: true,
      },
      {
        key: "continuation_confirmation",
        label: "Continuation confirmation",
        placeholder: "Reclaim candle off the 20 EMA followed by higher high",
        help: "What confirms the EMA structure is leading to continuation?",
      },
    ],
  },
  {
    id: "BREAKDOWN",
    label: "Breakdown",
    description:
      "Use this when price is losing a major support area and you expect downside expansion rather than a simple dip. The idea is similar to a breakout, but in the bearish direction, where failed support becomes a place sellers take control.",
    thesisPrompt:
      "Explain the support level that matters, why it is vulnerable, and what would confirm that the breakdown has real acceptance instead of turning into a bear trap.",
    workflowPrompt:
      "Capture the key support, participation clues, any retest plan, and the condition that would invalidate the short thesis.",
    fields: [
      {
        key: "support_level",
        label: "Support level",
        placeholder: "Break below 412.80 major support",
        help: "Which support level is at risk of failing?",
        required: true,
      },
      {
        key: "weakness_context",
        label: "Weakness context",
        placeholder: "Lower highs building into support with weak bounces",
        help: "What makes this support more likely to fail?",
      },
      {
        key: "acceptance_below",
        label: "Acceptance below support",
        placeholder: "Close below support and reject the retest",
        help: "What confirms sellers are in control beneath the level?",
        required: true,
      },
    ],
  },
  {
    id: "OPENING_RANGE_BREAK",
    label: "Opening Range Break",
    description:
      "Use this for intraday trading when the first part of the session sets a range and you want to trade the break of that range. Traders like it because the setup gives a clear structure early in the day and a simple invalidation point.",
    thesisPrompt:
      "Describe the opening range, why a break from that range matters today, and what would show the market has enough energy to continue.",
    workflowPrompt:
      "List the opening range levels, the trigger for entry, and the condition that tells you the move is failing or turning into chop.",
    fields: [
      {
        key: "opening_range_window",
        label: "Opening range window",
        placeholder: "First 15 minutes after market open",
        help: "What period defines the opening range?",
        required: true,
      },
      {
        key: "range_levels",
        label: "Opening range levels",
        placeholder: "High 185.60 / low 183.90",
        help: "What are the exact high and low of the opening range?",
        required: true,
      },
      {
        key: "break_confirmation",
        label: "Break confirmation",
        placeholder: "Hold above opening range high on strong volume",
        help: "What tells you the break has real intent?",
        required: true,
      },
    ],
  },
  {
    id: "VWAP_RECLAIM",
    label: "VWAP Reclaim",
    description:
      "Use this when price regains VWAP after trading below it, suggesting buyers may be regaining short-term control. It is popular with intraday traders because VWAP is a widely watched reference for fair value and session control.",
    thesisPrompt:
      "Explain why reclaiming VWAP matters in this context, what it says about short-term control, and what would show the reclaim is failing.",
    workflowPrompt:
      "Note the reclaim trigger, what other intraday levels matter around VWAP, and how you manage the trade if price slips back under the level.",
    fields: [
      {
        key: "vwap_context",
        label: "VWAP context",
        placeholder: "Spent morning below VWAP before reclaiming in afternoon",
        help: "How did price behave relative to VWAP before the setup?",
        required: true,
      },
      {
        key: "reclaim_trigger",
        label: "Reclaim trigger",
        placeholder: "Strong candle closes back above VWAP and holds retest",
        help: "What marks the actual reclaim event?",
        required: true,
      },
      {
        key: "session_level",
        label: "Nearby session level",
        placeholder: "Morning high overhead at 228.40",
        help: "What nearby intraday level could help or block continuation?",
      },
    ],
  },
  {
    id: "LIQUIDITY_SWEEP",
    label: "Liquidity Sweep",
    description:
      "Use this when price briefly runs above highs or below lows to trigger stops and then quickly reverses. Traders use this setup to identify moments when trapped participants and stop runs can fuel a move back the other way.",
    thesisPrompt:
      "Describe the liquidity area that got swept, why that sweep matters, and what tells you the reversal after the sweep is real rather than random noise.",
    workflowPrompt:
      "Record the swept high or low, the reversal signal after the sweep, and the line in the sand if price continues in the sweep direction.",
    fields: [
      {
        key: "liquidity_area",
        label: "Liquidity area",
        placeholder: "Prior day high and clustered equal highs",
        help: "Where were stops or obvious liquidity likely sitting?",
        required: true,
      },
      {
        key: "sweep_signal",
        label: "Sweep signal",
        placeholder: "Wick through highs followed by immediate reclaim",
        help: "What did the actual sweep look like?",
        required: true,
      },
      {
        key: "reversal_confirmation",
        label: "Reversal confirmation",
        placeholder: "Lower timeframe shift and acceptance back inside range",
        help: "What confirms the sweep led to a reversal rather than continuation?",
      },
    ],
  },
  {
    id: "FAILED_BREAKOUT",
    label: "Failed Breakout",
    description:
      "Use this when price appears to break a key level but cannot hold above it and quickly falls back into the prior range. Traders use it to catch the unwind of trapped breakout traders and the momentum that often follows the failure.",
    thesisPrompt:
      "Explain the level that was supposed to break, why the move failed, and what makes the failure meaningful enough to trade in the opposite direction.",
    workflowPrompt:
      "List the failed breakout level, the sign of rejection or loss of acceptance, and how you manage risk if the market tries to break again.",
    fields: [
      {
        key: "failed_level",
        label: "Failed breakout level",
        placeholder: "Could not hold above 71.20 weekly resistance",
        help: "Which breakout level failed to hold?",
        required: true,
      },
      {
        key: "failure_signal",
        label: "Failure signal",
        placeholder: "Fast rejection and close back below breakout level",
        help: "What tells you the breakout attempt failed?",
        required: true,
      },
      {
        key: "trapped_flow",
        label: "Trapped flow",
        placeholder: "Late breakout buyers likely trapped above resistance",
        help: "Who is trapped and how could that fuel the move?",
      },
    ],
  },
  {
    id: "EARNINGS_GAP_CONTINUATION",
    label: "Earnings Gap Continuation",
    description:
      "Use this when a stock gaps strongly after earnings or major news and looks likely to keep moving in the same direction. The edge comes from deciding whether the gap is being accepted and whether momentum participants are likely to keep pressing it.",
    thesisPrompt:
      "Describe the catalyst, the gap behavior after the open, and what confirms that the gap is being accepted instead of immediately filled.",
    workflowPrompt:
      "Capture the key post-gap levels, whether the open is holding, and how you respond if the stock begins to fade back into the gap.",
    fields: [
      {
        key: "catalyst",
        label: "Catalyst",
        placeholder: "Strong earnings beat and raised guidance",
        help: "What event is driving the gap?",
        required: true,
      },
      {
        key: "gap_structure",
        label: "Gap structure",
        placeholder: "Opened above prior resistance and held first pullback",
        help: "How is price behaving after the gap?",
        required: true,
      },
      {
        key: "acceptance_level",
        label: "Acceptance level",
        placeholder: "Holding above the opening print and premarket high",
        help: "What level tells you the gap is being accepted?",
      },
    ],
  },
];

export function getTradingSetupDefinition(setupType: string) {
  return TRADING_SETUP_DEFINITIONS.find(
    (definition) =>
      definition.id === setupType || definition.label === setupType,
  );
}

export function buildSetupFieldName(key: string) {
  return `setup_${key}`;
}

export function parseTradingSetupContext(
  setupContext: string | null | undefined,
): TradingSetupContext | null {
  if (!setupContext) {
    return null;
  }

  try {
    return JSON.parse(setupContext) as TradingSetupContext;
  } catch {
    return null;
  }
}

export function extractTradingSetupContext(
  formData: FormData,
  setupType: string,
): TradingSetupContext | null {
  const definition = getTradingSetupDefinition(setupType);

  if (!definition) {
    return null;
  }

  const entries = definition.fields
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: formData.get(buildSetupFieldName(field.key))?.toString().trim() || "",
    }))
    .filter((entry) => entry.value);

  if (entries.length === 0) {
    return null;
  }

  return {
    setupId: definition.id,
    setupLabel: definition.label,
    entries,
  };
}

export function buildTradingSetupNarrative(
  setupContext: TradingSetupContext | null,
) {
  if (!setupContext || setupContext.entries.length === 0) {
    return "";
  }

  return [
    `${setupContext.setupLabel} setup data:`,
    ...setupContext.entries.map((entry) => `- ${entry.label}: ${entry.value}`),
  ].join("\n");
}

export function buildTradingSetupAiContext(
  setupType: string,
  setupContext: TradingSetupContext | null,
) {
  const definition = getTradingSetupDefinition(setupType);

  if (!definition) {
    return buildTradingSetupNarrative(setupContext);
  }

  const parts = [
    `Selected setup: ${definition.label}`,
    `Setup description: ${definition.description}`,
    `Thesis guidance: ${definition.thesisPrompt}`,
    `Workflow guidance: ${definition.workflowPrompt}`,
  ];

  const setupNarrative = buildTradingSetupNarrative(setupContext);

  if (setupNarrative) {
    parts.push(setupNarrative);
  }

  return parts.join("\n");
}
