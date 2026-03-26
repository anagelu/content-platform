export const CHART_TIMEFRAME_OPTIONS = [
  { value: "1m", label: "1 Minute" },
  { value: "5m", label: "5 Minutes" },
  { value: "15m", label: "15 Minutes" },
  { value: "30m", label: "30 Minutes" },
  { value: "1h", label: "Hourly" },
  { value: "4h", label: "4 Hour" },
  { value: "1d", label: "Daily" },
  { value: "1w", label: "Weekly" },
  { value: "1M", label: "Monthly" },
  { value: "12M", label: "Yearly" },
] as const;

export function normalizeChartTimeframe(input: string) {
  const value = input.trim();

  if (!value) {
    return "";
  }

  const direct = CHART_TIMEFRAME_OPTIONS.find(
    (option) => option.value.toLowerCase() === value.toLowerCase(),
  );

  if (direct) {
    return direct.value;
  }

  const normalized = value.toLowerCase();

  if (normalized.includes("15")) {
    return "15m";
  }

  if (normalized.includes("30")) {
    return "30m";
  }

  if (normalized.includes("5")) {
    return "5m";
  }

  if (normalized.includes("1m") || normalized === "1") {
    return "1m";
  }

  if (normalized.includes("4h")) {
    return "4h";
  }

  if (normalized.includes("1h") || normalized.includes("hour")) {
    return "1h";
  }

  if (normalized.includes("week")) {
    return "1w";
  }

  if (normalized.includes("month")) {
    return "1M";
  }

  if (normalized.includes("year")) {
    return "12M";
  }

  return "1d";
}

export function toTradingViewInterval(input: string) {
  const normalized = normalizeChartTimeframe(input);

  switch (normalized) {
    case "1m":
      return "1";
    case "5m":
      return "5";
    case "15m":
      return "15";
    case "30m":
      return "30";
    case "1h":
      return "60";
    case "4h":
      return "240";
    case "1w":
      return "1W";
    case "1M":
      return "1M";
    case "12M":
      return "12M";
    case "1d":
    default:
      return "1D";
  }
}
