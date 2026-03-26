"use client";

import { startTransition, useMemo, useState } from "react";
import { TradingChartView } from "@/app/trading/chart/trading-chart-view";
import {
  analyzeCandlestickPatterns,
  type Candle,
} from "@/lib/candlestick-patterns";
import type { MarketInterval, MarketRange } from "@/lib/market-data";
import { getCandlestickReaderSnapshot } from "./actions";

type LiveSnapshot = Awaited<ReturnType<typeof getCandlestickReaderSnapshot>>;
type SupportedInterval = MarketInterval;
type SupportedRange = MarketRange;

type CandleFieldKey = keyof Candle;
type CandleFormState = Record<CandleFieldKey, string>;

const initialPreviousCandle: CandleFormState = {
  open: "103",
  high: "104",
  low: "98",
  close: "99",
};

const initialMiddleCandle: CandleFormState = {
  open: "100",
  high: "100.5",
  low: "98.5",
  close: "99.5",
};

const initialCurrentCandle: CandleFormState = {
  open: "99",
  high: "105",
  low: "98.5",
  close: "103",
};

const candleFields: CandleFieldKey[] = ["open", "high", "low", "close"];
const intervalOptions: SupportedInterval[] = [
  "1min",
  "5min",
  "15min",
  "30min",
  "60min",
  "1day",
  "1week",
  "1month",
  "1year",
];
const rangeOptions: SupportedRange[] = ["1mo", "3mo", "6mo", "1y"];

function parseCandle(formState: CandleFormState): Candle | null {
  const open = Number(formState.open);
  const high = Number(formState.high);
  const low = Number(formState.low);
  const close = Number(formState.close);

  if (![open, high, low, close].every(Number.isFinite)) {
    return null;
  }

  return { open, high, low, close };
}

function formatBiasLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatIntervalLabel(value: SupportedInterval) {
  switch (value) {
    case "1min":
      return "1 min";
    case "5min":
      return "5 min";
    case "15min":
      return "15 min";
    case "30min":
      return "30 min";
    case "60min":
      return "Hourly";
    case "1day":
      return "Daily";
    case "1week":
      return "Weekly";
    case "1month":
      return "Monthly";
    case "1year":
      return "Yearly";
    default:
      return value;
  }
}

function formatRangeLabel(value: SupportedRange) {
  switch (value) {
    case "1mo":
      return "1 month";
    case "3mo":
      return "3 months";
    case "6mo":
      return "6 months";
    case "1y":
      return "1 year";
    default:
      return value;
  }
}

function formatTimestamp(value: string, interval: SupportedInterval) {
  if (interval === "1year") {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
    }).format(new Date(value));
  }

  if (interval === "1month" || interval === "1week") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  }

  if (interval === "1day") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function toChartTimeframe(interval: SupportedInterval) {
  switch (interval) {
    case "1min":
      return "1m";
    case "5min":
      return "5m";
    case "15min":
      return "15m";
    case "30min":
      return "30m";
    case "60min":
      return "1h";
    case "1week":
      return "1w";
    case "1month":
      return "1M";
    case "1year":
      return "12M";
    case "1day":
    default:
      return "1d";
  }
}

export function CandlestickSignalReader() {
  const [marketQuery, setMarketQuery] = useState("NVIDIA");
  const [interval, setInterval] = useState<SupportedInterval>("5min");
  const [range, setRange] = useState<SupportedRange>("1mo");
  const [previousCandle, setPreviousCandle] = useState(initialPreviousCandle);
  const [middleCandle, setMiddleCandle] = useState(initialMiddleCandle);
  const [currentCandle, setCurrentCandle] = useState(initialCurrentCandle);
  const [isLoadingMarketData, setIsLoadingMarketData] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [marketNote, setMarketNote] = useState("");
  const [liveSnapshot, setLiveSnapshot] = useState<LiveSnapshot | null>(null);
  const candleSections: Array<{
    label: string;
    candle: CandleFormState;
    candleType: "previous" | "middle" | "current";
  }> = [
    {
      label: "Oldest candle",
      candle: previousCandle,
      candleType: "previous",
    },
    {
      label: "Middle candle",
      candle: middleCandle,
      candleType: "middle",
    },
    {
      label: "Current candle",
      candle: currentCandle,
      candleType: "current",
    },
  ];

  const analysis = useMemo(() => {
    const parsedPrevious = parseCandle(previousCandle);
    const parsedCurrent = parseCandle(currentCandle);

    if (!parsedPrevious || !parsedCurrent) {
      return null;
    }

    const parsedMiddle = parseCandle(middleCandle);

    if (!parsedMiddle) {
      return null;
    }

    return analyzeCandlestickPatterns([
      parsedPrevious,
      parsedMiddle,
      parsedCurrent,
    ]);
  }, [currentCandle, middleCandle, previousCandle]);

  function updateCandle(
    candleType: "previous" | "middle" | "current",
    field: CandleFieldKey,
    value: string,
  ) {
    if (candleType === "previous") {
      setPreviousCandle((currentState) => ({
        ...currentState,
        [field]: value,
      }));
      return;
    }

    if (candleType === "middle") {
      setMiddleCandle((currentState) => ({
        ...currentState,
        [field]: value,
      }));
      return;
    }

    setCurrentCandle((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  function loadLiveMarketData() {
    setIsLoadingMarketData(true);
    setMarketError("");
    setMarketNote("");

    startTransition(async () => {
      try {
        const snapshot = await getCandlestickReaderSnapshot({
          query: marketQuery,
          interval,
          range,
        });

        setLiveSnapshot(snapshot);
        const analysisCandles = snapshot.candles.slice(-3);
        const [previous, middle, current] = analysisCandles;

        setPreviousCandle({
          open: String(previous.open),
          high: String(previous.high),
          low: String(previous.low),
          close: String(previous.close),
        });
        setMiddleCandle({
          open: String(middle.open),
          high: String(middle.high),
          low: String(middle.low),
          close: String(middle.close),
        });
        setCurrentCandle({
          open: String(current.open),
          high: String(current.high),
          low: String(current.low),
          close: String(current.close),
        });
        setMarketNote(
          `Loaded ${snapshot.match.name} (${snapshot.match.symbol}) using the three most recent ${formatIntervalLabel(interval)} candles over the last ${formatRangeLabel(range)}.`,
        );
      } catch (error) {
        setLiveSnapshot(null);
        setMarketError(
          error instanceof Error ? error.message : "Live market load failed.",
        );
      } finally {
        setIsLoadingMarketData(false);
      }
    });
  }

  return (
    <div className="form-card">
      <div className="signal-reader-toolbar">
        <div className="form-group signal-reader-search">
          <label className="form-label" htmlFor="market-query">
            Company or ticker
          </label>
          <input
            id="market-query"
            className="form-input"
            value={marketQuery}
            onChange={(event) => setMarketQuery(event.target.value)}
            placeholder="NVIDIA, AAPL, Microsoft, TSLA"
          />
          <p className="form-help">
            Search by company name or enter a ticker to pull live market data.
          </p>
        </div>

        <div className="form-group signal-reader-interval">
          <label className="form-label" htmlFor="market-interval">
            Timeframe
          </label>
          <select
            id="market-interval"
            className="form-select"
            value={interval}
            onChange={(event) => setInterval(event.target.value as SupportedInterval)}
          >
            {intervalOptions.map((option) => (
              <option key={option} value={option}>
                {formatIntervalLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group signal-reader-interval">
          <label className="form-label" htmlFor="market-range">
            Range
          </label>
          <select
            id="market-range"
            className="form-select"
            value={range}
            onChange={(event) => setRange(event.target.value as SupportedRange)}
          >
            {rangeOptions.map((option) => (
              <option key={option} value={option}>
                {formatRangeLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <div className="signal-reader-toolbar-actions">
          <button
            type="button"
            className="button-link"
            onClick={loadLiveMarketData}
            disabled={isLoadingMarketData}
          >
            {isLoadingMarketData ? "Loading Live Data..." : "Load Live Market Data"}
          </button>
        </div>
      </div>

      {marketNote ? <p className="form-help">{marketNote}</p> : null}
      {marketError ? <p className="form-error">{marketError}</p> : null}

      {liveSnapshot ? (
        <section className="signal-reader-snapshot">
          <div className="trading-metric-row">
            <div className="trading-metric-card">
              <span className="trading-metric-label">Company</span>
              <strong>{liveSnapshot.match.name}</strong>
              <p className="meta">
                {liveSnapshot.match.symbol}
                {liveSnapshot.match.region ? ` · ${liveSnapshot.match.region}` : ""}
              </p>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Live price</span>
              <strong>{liveSnapshot.quote.price.toFixed(2)}</strong>
              <p className="meta">
                {liveSnapshot.quote.change.toFixed(2)} (
                {liveSnapshot.quote.changePercent.toFixed(2)}%)
              </p>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Latest market day</span>
              <strong>{formatTimestamp(liveSnapshot.quote.fetchedAt, interval)}</strong>
              <p className="meta">
                Prev close {liveSnapshot.quote.previousClose.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="signal-chart-card">
            <div className="signal-chart-header">
              <h3 className="signal-reader-panel-title">TradingView Chart</h3>
              <p className="meta">
                Viewing {liveSnapshot.match.symbol} on TradingView using the{" "}
                {formatIntervalLabel(interval)} timeframe. The loaded candle data
                below still powers the pattern analysis.
              </p>
            </div>
            <TradingChartView
              market={liveSnapshot.match.symbol}
              timeframe={toChartTimeframe(interval)}
              compact
            />
            <div className="signal-chart-readout">
              <div className="trading-metric-card">
                <span className="trading-metric-label">Analysis candles</span>
                {(() => {
                  const analysisCandles = liveSnapshot.candles.slice(-3);

                  return (
                    <strong>
                      {formatTimestamp(analysisCandles[0].timestamp, interval)},{" "}
                      {formatTimestamp(analysisCandles[1].timestamp, interval)}, and{" "}
                      {formatTimestamp(analysisCandles[2].timestamp, interval)}
                    </strong>
                  );
                })()}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="trading-grid">
        {candleSections.map(({ label, candle, candleType }) => (
          <section className="signal-reader-panel" key={candleType}>
            <h3 className="signal-reader-panel-title">{label}</h3>

            <div className="signal-reader-grid">
              {candleFields.map((field) => (
                <div className="form-group" key={`${candleType}-${field}`}>
                  <label
                    className="form-label"
                    htmlFor={`${candleType}-${field}`}
                  >
                    {formatBiasLabel(field)}
                  </label>
                  <input
                    id={`${candleType}-${field}`}
                    className="form-input"
                    inputMode="decimal"
                    value={candle[field]}
                    onChange={(event) =>
                      updateCandle(candleType, field, event.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="trading-metric-row" style={{ marginTop: "1rem" }}>
        <div className="trading-metric-card">
          <span className="trading-metric-label">Overall bias</span>
          <strong>{analysis ? formatBiasLabel(analysis.overallBias) : "--"}</strong>
        </div>
        <div className="trading-metric-card">
          <span className="trading-metric-label">Signal score</span>
          <strong>{analysis ? analysis.score : "--"}</strong>
        </div>
        <div className="trading-metric-card">
          <span className="trading-metric-label">Patterns found</span>
          <strong>{analysis ? analysis.signals.length : "--"}</strong>
        </div>
      </div>

      {!analysis || !analysis.valid ? (
        <p className="form-help" style={{ marginTop: "1rem" }}>
          Enter valid OHLC values where high is above the candle body and low is
          below it.
        </p>
      ) : analysis.signals.length === 0 ? (
        <p className="form-help" style={{ marginTop: "1rem" }}>
          No tracked pattern matched this candle pair yet. That is normal; most
          candles are just noise without a clean signal.
        </p>
      ) : (
        <div className="signal-reader-results">
          {analysis.signals.map((signal) => (
            <article className="signal-result-card" key={signal.id}>
              <div className="signal-result-header">
                <div>
                  <h3 className="signal-result-title">{signal.name}</h3>
                  <p className="signal-result-summary">{signal.summary}</p>
                </div>
                <div className={`signal-badge signal-badge-${signal.bias}`}>
                  {formatBiasLabel(signal.bias)}
                </div>
              </div>
              <p className="meta">Confidence: {signal.confidence} / 100</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
