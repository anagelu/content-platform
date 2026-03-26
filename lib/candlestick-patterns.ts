export type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
};

export type PatternBias = "bullish" | "bearish" | "neutral";

export type PatternSignal = {
  id: string;
  name: string;
  bias: PatternBias;
  confidence: number;
  summary: string;
};

function roundConfidence(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getRange(candle: Candle) {
  return candle.high - candle.low;
}

function getBody(candle: Candle) {
  return Math.abs(candle.close - candle.open);
}

function getBodyRatio(candle: Candle) {
  const range = getRange(candle);
  return range === 0 ? 0 : getBody(candle) / range;
}

function getUpperWick(candle: Candle) {
  return candle.high - Math.max(candle.open, candle.close);
}

function getLowerWick(candle: Candle) {
  return Math.min(candle.open, candle.close) - candle.low;
}

function getMidpoint(candle: Candle) {
  return (candle.open + candle.close) / 2;
}

function isBullish(candle: Candle) {
  return candle.close > candle.open;
}

function isBearish(candle: Candle) {
  return candle.close < candle.open;
}

function hasLongBody(candle: Candle) {
  return getBodyRatio(candle) >= 0.55;
}

function hasSmallBody(candle: Candle) {
  return getBodyRatio(candle) <= 0.3;
}

function isDojiLike(candle: Candle) {
  return getBodyRatio(candle) <= 0.1;
}

function hasValidStructure(candle: Candle) {
  return (
    [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite) &&
    candle.high >= Math.max(candle.open, candle.close) &&
    candle.low <= Math.min(candle.open, candle.close) &&
    candle.high >= candle.low
  );
}

function detectDoji(candle: Candle): PatternSignal | null {
  const range = getRange(candle);

  if (range === 0) {
    return null;
  }

  const bodyRatio = getBody(candle) / range;

  if (bodyRatio > 0.1) {
    return null;
  }

  return {
    id: "doji",
    name: "Doji",
    bias: "neutral",
    confidence: roundConfidence((1 - bodyRatio / 0.1) * 74 + 18),
    summary:
      "Indecision candle. The open and close are very close, so momentum may be stalling.",
  };
}

function detectHammer(candle: Candle): PatternSignal | null {
  const range = getRange(candle);

  if (range === 0) {
    return null;
  }

  const body = getBody(candle);
  const lowerWick = getLowerWick(candle);
  const upperWick = getUpperWick(candle);

  if (body === 0) {
    return null;
  }

  const longLowerWick = lowerWick >= body * 2.2;
  const tightUpperWick = upperWick <= body * 0.6;
  const bodyNearTop = (candle.high - Math.max(candle.open, candle.close)) / range <= 0.2;

  if (!longLowerWick || !tightUpperWick || !bodyNearTop) {
    return null;
  }

  return {
    id: "hammer",
    name: "Hammer",
    bias: "bullish",
    confidence: roundConfidence(58 + Math.min(32, (lowerWick / body) * 7)),
    summary:
      "Bullish rejection shape. Sellers pushed price down, but buyers reclaimed most of the candle.",
  };
}

function detectInvertedHammer(candle: Candle): PatternSignal | null {
  const range = getRange(candle);
  const body = getBody(candle);
  const upperWick = getUpperWick(candle);
  const lowerWick = getLowerWick(candle);

  if (range === 0 || body === 0) {
    return null;
  }

  const longUpperWick = upperWick >= body * 2.2;
  const smallLowerWick = lowerWick <= body * 0.8;
  const bodyNearBottom = (Math.min(candle.open, candle.close) - candle.low) / range <= 0.25;

  if (!longUpperWick || !smallLowerWick || !bodyNearBottom) {
    return null;
  }

  return {
    id: "inverted-hammer",
    name: "Inverted Hammer",
    bias: "bullish",
    confidence: roundConfidence(57 + Math.min(30, (upperWick / body) * 7)),
    summary:
      "Potential bullish reversal. Buyers showed some strength after early weakness, even if they did not fully hold the high.",
  };
}

function detectShootingStar(candle: Candle): PatternSignal | null {
  const range = getRange(candle);

  if (range === 0) {
    return null;
  }

  const body = getBody(candle);
  const lowerWick = getLowerWick(candle);
  const upperWick = getUpperWick(candle);

  if (body === 0) {
    return null;
  }

  const longUpperWick = upperWick >= body * 2.2;
  const tightLowerWick = lowerWick <= body * 0.6;
  const bodyNearBottom = (Math.min(candle.open, candle.close) - candle.low) / range <= 0.2;

  if (!longUpperWick || !tightLowerWick || !bodyNearBottom) {
    return null;
  }

  return {
    id: "shooting-star",
    name: "Shooting Star",
    bias: "bearish",
    confidence: roundConfidence(58 + Math.min(32, (upperWick / body) * 7)),
    summary:
      "Bearish rejection shape. Buyers extended price upward, but that move was largely sold back.",
  };
}

function detectHangingMan(candle: Candle): PatternSignal | null {
  const range = getRange(candle);
  const body = getBody(candle);
  const lowerWick = getLowerWick(candle);
  const upperWick = getUpperWick(candle);

  if (range === 0 || body === 0) {
    return null;
  }

  const longLowerWick = lowerWick >= body * 2.2;
  const tightUpperWick = upperWick <= body * 0.7;
  const bodyNearTop = (candle.high - Math.max(candle.open, candle.close)) / range <= 0.25;

  if (!longLowerWick || !tightUpperWick || !bodyNearTop) {
    return null;
  }

  return {
    id: "hanging-man",
    name: "Hanging Man",
    bias: "bearish",
    confidence: roundConfidence(56 + Math.min(30, (lowerWick / body) * 7)),
    summary:
      "Potential bearish reversal. Price recovered off the low, but the deep downside probe can signal weakening control by buyers.",
  };
}

function detectBullishEngulfing(previous: Candle, current: Candle): PatternSignal | null {
  if (!isBearish(previous) || !isBullish(current)) {
    return null;
  }

  const currentBody = getBody(current);
  const previousBody = getBody(previous);

  if (currentBody === 0 || previousBody === 0) {
    return null;
  }

  const engulfed =
    current.open <= previous.close && current.close >= previous.open;

  if (!engulfed || currentBody < previousBody * 1.05) {
    return null;
  }

  return {
    id: "bullish-engulfing",
    name: "Bullish Engulfing",
    bias: "bullish",
    confidence: roundConfidence(62 + Math.min(28, (currentBody / previousBody) * 10)),
    summary:
      "Bullish reversal signal. The current candle fully overtook the prior bearish body.",
  };
}

function detectBearishEngulfing(previous: Candle, current: Candle): PatternSignal | null {
  if (!isBullish(previous) || !isBearish(current)) {
    return null;
  }

  const currentBody = getBody(current);
  const previousBody = getBody(previous);

  if (currentBody === 0 || previousBody === 0) {
    return null;
  }

  const engulfed =
    current.open >= previous.close && current.close <= previous.open;

  if (!engulfed || currentBody < previousBody * 1.05) {
    return null;
  }

  return {
    id: "bearish-engulfing",
    name: "Bearish Engulfing",
    bias: "bearish",
    confidence: roundConfidence(62 + Math.min(28, (currentBody / previousBody) * 10)),
    summary:
      "Bearish reversal signal. The current candle fully overtook the prior bullish body.",
  };
}

function detectBullishHarami(previous: Candle, current: Candle): PatternSignal | null {
  if (!isBearish(previous) || !isBullish(current)) {
    return null;
  }

  if (!hasLongBody(previous) || !hasSmallBody(current)) {
    return null;
  }

  const insideBody =
    current.open >= previous.close &&
    current.open <= previous.open &&
    current.close >= previous.close &&
    current.close <= previous.open;

  if (!insideBody) {
    return null;
  }

  return {
    id: "bullish-harami",
    name: "Bullish Harami",
    bias: "bullish",
    confidence: roundConfidence(58 + Math.min(24, getBody(previous) / Math.max(getBody(current), 0.01))),
    summary:
      "Bullish slowdown signal. A small bullish body formed inside the prior bearish candle, hinting that selling pressure may be fading.",
  };
}

function detectBearishHarami(previous: Candle, current: Candle): PatternSignal | null {
  if (!isBullish(previous) || !isBearish(current)) {
    return null;
  }

  if (!hasLongBody(previous) || !hasSmallBody(current)) {
    return null;
  }

  const insideBody =
    current.open >= previous.open &&
    current.open <= previous.close &&
    current.close >= previous.open &&
    current.close <= previous.close;

  if (!insideBody) {
    return null;
  }

  return {
    id: "bearish-harami",
    name: "Bearish Harami",
    bias: "bearish",
    confidence: roundConfidence(58 + Math.min(24, getBody(previous) / Math.max(getBody(current), 0.01))),
    summary:
      "Bearish slowdown signal. A small bearish body formed inside the prior bullish candle, hinting that buying pressure may be fading.",
  };
}

function detectPiercingPattern(previous: Candle, current: Candle): PatternSignal | null {
  if (!isBearish(previous) || !isBullish(current)) {
    return null;
  }

  if (!hasLongBody(previous)) {
    return null;
  }

  const opensLower = current.open < previous.close;
  const closesAboveMidpoint = current.close > getMidpoint(previous);
  const closesBelowOpen = current.close < previous.open;

  if (!opensLower || !closesAboveMidpoint || !closesBelowOpen) {
    return null;
  }

  return {
    id: "piercing-pattern",
    name: "Piercing Pattern",
    bias: "bullish",
    confidence: 72,
    summary:
      "Bullish reversal setup. The current candle rebounded sharply and closed back through the midpoint of the prior bearish candle.",
  };
}

function detectDarkCloudCover(previous: Candle, current: Candle): PatternSignal | null {
  if (!isBullish(previous) || !isBearish(current)) {
    return null;
  }

  if (!hasLongBody(previous)) {
    return null;
  }

  const opensHigher = current.open > previous.close;
  const closesBelowMidpoint = current.close < getMidpoint(previous);
  const closesAboveOpen = current.close > previous.open;

  if (!opensHigher || !closesBelowMidpoint || !closesAboveOpen) {
    return null;
  }

  return {
    id: "dark-cloud-cover",
    name: "Dark Cloud Cover",
    bias: "bearish",
    confidence: 72,
    summary:
      "Bearish reversal setup. The current candle failed after opening strong and closed back through the midpoint of the prior bullish candle.",
  };
}

function detectMorningStar(first: Candle, second: Candle, third: Candle): PatternSignal | null {
  if (!isBearish(first) || !isBullish(third)) {
    return null;
  }

  if (!hasLongBody(first) || !hasLongBody(third)) {
    return null;
  }

  const middleIsSmall = hasSmallBody(second) || isDojiLike(second);
  const thirdClosesStrong = third.close > getMidpoint(first);

  if (!middleIsSmall || !thirdClosesStrong) {
    return null;
  }

  return {
    id: "morning-star",
    name: "Morning Star",
    bias: "bullish",
    confidence: 81,
    summary:
      "Bullish three-candle reversal. A strong selloff stalled with a small middle candle, then buyers stepped in with a strong recovery candle.",
  };
}

function detectEveningStar(first: Candle, second: Candle, third: Candle): PatternSignal | null {
  if (!isBullish(first) || !isBearish(third)) {
    return null;
  }

  if (!hasLongBody(first) || !hasLongBody(third)) {
    return null;
  }

  const middleIsSmall = hasSmallBody(second) || isDojiLike(second);
  const thirdClosesWeak = third.close < getMidpoint(first);

  if (!middleIsSmall || !thirdClosesWeak) {
    return null;
  }

  return {
    id: "evening-star",
    name: "Evening Star",
    bias: "bearish",
    confidence: 81,
    summary:
      "Bearish three-candle reversal. A strong rally stalled with a small middle candle, then sellers took back control with a strong downside candle.",
  };
}

function detectThreeWhiteSoldiers(first: Candle, second: Candle, third: Candle): PatternSignal | null {
  if (!isBullish(first) || !isBullish(second) || !isBullish(third)) {
    return null;
  }

  const allLong = [first, second, third].every(hasLongBody);
  const risingCloses =
    second.close > first.close && third.close > second.close;
  const opensWithinPriorBodies =
    second.open >= first.open &&
    second.open <= first.close &&
    third.open >= second.open &&
    third.open <= second.close;

  if (!allLong || !risingCloses || !opensWithinPriorBodies) {
    return null;
  }

  return {
    id: "three-white-soldiers",
    name: "Three White Soldiers",
    bias: "bullish",
    confidence: 86,
    summary:
      "Bullish continuation or reversal sequence. Three strong bullish candles printed back to back with steadily improving closes.",
  };
}

function detectThreeBlackCrows(first: Candle, second: Candle, third: Candle): PatternSignal | null {
  if (!isBearish(first) || !isBearish(second) || !isBearish(third)) {
    return null;
  }

  const allLong = [first, second, third].every(hasLongBody);
  const fallingCloses =
    second.close < first.close && third.close < second.close;
  const opensWithinPriorBodies =
    second.open <= first.open &&
    second.open >= first.close &&
    third.open <= second.open &&
    third.open >= second.close;

  if (!allLong || !fallingCloses || !opensWithinPriorBodies) {
    return null;
  }

  return {
    id: "three-black-crows",
    name: "Three Black Crows",
    bias: "bearish",
    confidence: 86,
    summary:
      "Bearish continuation or reversal sequence. Three strong bearish candles printed back to back with steadily weaker closes.",
  };
}

export function analyzeCandlestickPatterns(candles: Candle[]): {
  valid: boolean;
  signals: PatternSignal[];
  overallBias: PatternBias;
  score: number;
} {
  const normalizedCandles = candles.filter(Boolean);

  if (
    normalizedCandles.length === 0 ||
    normalizedCandles.some((candle) => !hasValidStructure(candle))
  ) {
    return {
      valid: false,
      signals: [],
      overallBias: "neutral",
      score: 0,
    };
  }

  const current = normalizedCandles[normalizedCandles.length - 1];
  const previous = normalizedCandles[normalizedCandles.length - 2];
  const thirdPrevious = normalizedCandles[normalizedCandles.length - 3];
  const signals = [
    detectDoji(current),
    detectHammer(current),
    detectInvertedHammer(current),
    detectShootingStar(current),
    detectHangingMan(current),
    previous ? detectBullishEngulfing(previous, current) : null,
    previous ? detectBearishEngulfing(previous, current) : null,
    previous ? detectBullishHarami(previous, current) : null,
    previous ? detectBearishHarami(previous, current) : null,
    previous ? detectPiercingPattern(previous, current) : null,
    previous ? detectDarkCloudCover(previous, current) : null,
    thirdPrevious ? detectMorningStar(thirdPrevious, previous, current) : null,
    thirdPrevious ? detectEveningStar(thirdPrevious, previous, current) : null,
    thirdPrevious ? detectThreeWhiteSoldiers(thirdPrevious, previous, current) : null,
    thirdPrevious ? detectThreeBlackCrows(thirdPrevious, previous, current) : null,
  ].filter((signal): signal is PatternSignal => signal !== null);

  const uniqueSignals = Array.from(
    new Map(signals.map((signal) => [signal.id, signal])).values(),
  );

  const bullishScore = uniqueSignals
    .filter((signal) => signal.bias === "bullish")
    .reduce((sum, signal) => sum + signal.confidence, 0);
  const bearishScore = uniqueSignals
    .filter((signal) => signal.bias === "bearish")
    .reduce((sum, signal) => sum + signal.confidence, 0);
  const score = bullishScore - bearishScore;

  const overallBias =
    score > 15 ? "bullish" : score < -15 ? "bearish" : "neutral";

  return {
    valid: true,
    signals: uniqueSignals.sort((a, b) => b.confidence - a.confidence),
    overallBias,
    score,
  };
}
