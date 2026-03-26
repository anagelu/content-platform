"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CHART_TIMEFRAME_OPTIONS,
  normalizeChartTimeframe,
  toTradingViewInterval,
} from "@/lib/chart-timeframes";

const SPX_STRATEGY_CHECKLIST = [
  {
    id: "opening-range-break",
    label: "Opening range break is clean and directional",
  },
  {
    id: "trend-continuation",
    label: "Trend continuation is intact after a controlled pullback",
  },
  {
    id: "vwap-reclaim",
    label: "VWAP reclaim or hold is supporting the trade direction",
  },
  {
    id: "mean-reversion",
    label: "Mean reversion setup is valid at an overextended move",
  },
  {
    id: "range-reaction",
    label: "Range edge reaction is obvious and well-defined",
  },
  {
    id: "reversal-reclaim",
    label: "Failed move or reclaim setup is clearly taking shape",
  },
  {
    id: "stay-flat",
    label: "Stay flat if the session is noisy, unclear, or between levels",
  },
] as const;

const SPX_LONG_CRITERIA_CHECKLIST = [
  {
    id: "long-above-key-level",
    label: "Price is holding above the key level or reclaim area",
  },
  {
    id: "long-higher-lows",
    label: "Short-term structure is making higher lows",
  },
  {
    id: "long-vwap-support",
    label: "VWAP is acting as support instead of resistance",
  },
  {
    id: "long-breadth",
    label: "Momentum or participation supports continuation higher",
  },
  {
    id: "long-clean-invalidation",
    label: "Invalidation is clear and close enough to define risk",
  },
  {
    id: "long-room-upside",
    label: "There is room to the next target without immediate overhead resistance",
  },
] as const;

const SPX_SHORT_CRITERIA_CHECKLIST = [
  {
    id: "short-below-key-level",
    label: "Price is staying below the key level or losing reclaim attempts",
  },
  {
    id: "short-lower-highs",
    label: "Short-term structure is making lower highs",
  },
  {
    id: "short-vwap-resistance",
    label: "VWAP is capping price and acting as resistance",
  },
  {
    id: "short-failed-bounce",
    label: "Bounces are weak and failing back into sellers",
  },
  {
    id: "short-clean-invalidation",
    label: "Invalidation is clear and close enough to define risk",
  },
  {
    id: "short-room-downside",
    label: "There is room lower before major support becomes a problem",
  },
] as const;

export type TradingChartIndicatorConfig = {
  strategyType?: "NONE" | "SMA" | "EMA" | "BOLLINGER";
  fastPeriod?: number;
  slowPeriod?: number;
  bollingerLength?: number;
  bollingerStdDev?: number;
};

function buildTradingViewStudies(indicator?: TradingChartIndicatorConfig) {
  if (!indicator || indicator.strategyType === "NONE" || !indicator.strategyType) {
    return [];
  }

  if (indicator.strategyType === "BOLLINGER") {
    return ["BB@tv-basicstudies"];
  }

  return ["MASimple@tv-basicstudies", "MASimple@tv-basicstudies"];
}

function getIndicatorSummary(indicator?: TradingChartIndicatorConfig) {
  if (!indicator || indicator.strategyType === "NONE" || !indicator.strategyType) {
    return null;
  }

  if (indicator.strategyType === "BOLLINGER") {
    return {
      title: "Indicator overlay: Bollinger Bands",
      detail: `Previewing Bollinger Bands on the live chart. Strategy inputs: length ${
        indicator.bollingerLength ?? 20
      }, standard deviation ${indicator.bollingerStdDev ?? 2}.`,
    };
  }

  if (indicator.strategyType === "EMA") {
    return {
      title: "Indicator overlay: EMA",
      detail: `Previewing a fast/slow EMA-style trend setup on the live chart. Strategy inputs: fast ${
        indicator.fastPeriod ?? 5
      }, slow ${indicator.slowPeriod ?? 20}.`,
    };
  }

  return {
    title: "Indicator overlay: SMA",
    detail: `Previewing simple moving averages on the live chart. Strategy inputs: fast ${
      indicator.fastPeriod ?? 5
    }, slow ${indicator.slowPeriod ?? 20}.`,
  };
}

export function TradingChartView({
  market,
  timeframe,
  compact = false,
  indicator,
}: {
  market: string;
  timeframe: string;
  compact?: boolean;
  indicator?: TradingChartIndicatorConfig;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const normalizedTimeframe = useMemo(
    () => normalizeChartTimeframe(timeframe || "1d"),
    [timeframe],
  );
  const tradingViewInterval = useMemo(
    () => toTradingViewInterval(normalizedTimeframe),
    [normalizedTimeframe],
  );
  const studies = useMemo(() => buildTradingViewStudies(indicator), [indicator]);
  const indicatorSummary = useMemo(() => getIndicatorSummary(indicator), [indicator]);
  const isSpx = market.trim().toUpperCase() === "SPX";
  const checklistStoragePrefix = useMemo(
    () => `trading-chart-checklist:${market.trim().toUpperCase()}:${normalizedTimeframe}`,
    [market, normalizedTimeframe],
  );
  const [selectedChecklistItems, setSelectedChecklistItems] = useState<string[]>([]);
  const [selectedLongCriteriaItems, setSelectedLongCriteriaItems] = useState<string[]>([]);
  const [selectedShortCriteriaItems, setSelectedShortCriteriaItems] = useState<string[]>([]);

  useEffect(() => {
    if (!isSpx) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      try {
        const loadChecklistItems = (
          storageKey: string,
          validIds: readonly { id: string }[],
        ) => {
          const rawValue = window.localStorage.getItem(storageKey);

          if (!rawValue) {
            return [];
          }

          const parsedValue = JSON.parse(rawValue) as string[];
          return parsedValue.filter((value) =>
            validIds.some((item) => item.id === value),
          );
        };

        const validStrategyItems = loadChecklistItems(
          `${checklistStoragePrefix}:strategy`,
          SPX_STRATEGY_CHECKLIST,
        );
        const validLongItems = loadChecklistItems(
          `${checklistStoragePrefix}:long`,
          SPX_LONG_CRITERIA_CHECKLIST,
        );
        const validShortItems = loadChecklistItems(
          `${checklistStoragePrefix}:short`,
          SPX_SHORT_CRITERIA_CHECKLIST,
        );
        setSelectedChecklistItems(validStrategyItems);
        setSelectedLongCriteriaItems(validLongItems);
        setSelectedShortCriteriaItems(validShortItems);
      } catch {
        setSelectedChecklistItems([]);
        setSelectedLongCriteriaItems([]);
        setSelectedShortCriteriaItems([]);
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [checklistStoragePrefix, isSpx]);

  useEffect(() => {
    if (!isSpx) {
      return;
    }

    window.localStorage.setItem(
      `${checklistStoragePrefix}:strategy`,
      JSON.stringify(selectedChecklistItems),
    );
  }, [checklistStoragePrefix, isSpx, selectedChecklistItems]);

  useEffect(() => {
    if (!isSpx) {
      return;
    }

    window.localStorage.setItem(
      `${checklistStoragePrefix}:long`,
      JSON.stringify(selectedLongCriteriaItems),
    );
  }, [checklistStoragePrefix, isSpx, selectedLongCriteriaItems]);

  useEffect(() => {
    if (!isSpx) {
      return;
    }

    window.localStorage.setItem(
      `${checklistStoragePrefix}:short`,
      JSON.stringify(selectedShortCriteriaItems),
    );
  }, [checklistStoragePrefix, isSpx, selectedShortCriteriaItems]);

  function handleToggleChecklistItem(itemId: string) {
    setSelectedChecklistItems((currentItems) =>
      currentItems.includes(itemId)
        ? currentItems.filter((value) => value !== itemId)
        : [...currentItems, itemId],
    );
  }

  function handleToggleLongCriteriaItem(itemId: string) {
    setSelectedLongCriteriaItems((currentItems) =>
      currentItems.includes(itemId)
        ? currentItems.filter((value) => value !== itemId)
        : [...currentItems, itemId],
    );
  }

  function handleToggleShortCriteriaItem(itemId: string) {
    setSelectedShortCriteriaItems((currentItems) =>
      currentItems.includes(itemId)
        ? currentItems.filter((value) => value !== itemId)
        : [...currentItems, itemId],
    );
  }

  function handleResetChecklist() {
    setSelectedChecklistItems([]);
    setSelectedLongCriteriaItems([]);
    setSelectedShortCriteriaItems([]);
  }

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let cancelled = false;
    let frameId = 0;

    frameId = window.requestAnimationFrame(() => {
      if (cancelled) {
        return;
      }

      container.innerHTML = "";

      const widgetWrap = document.createElement("div");
      widgetWrap.className = "tradingview-widget-container";
      widgetWrap.style.height = "100%";
      widgetWrap.style.width = "100%";

      const widgetTarget = document.createElement("div");
      widgetTarget.className = "tradingview-widget-container__widget";
      widgetTarget.style.height = "100%";
      widgetTarget.style.width = "100%";
      widgetWrap.appendChild(widgetTarget);

      const script = document.createElement("script");
      script.src =
        "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
      script.async = true;
      script.type = "text/javascript";
      script.innerHTML = JSON.stringify({
        autosize: true,
        symbol: market.toUpperCase(),
        interval: tradingViewInterval,
        studies,
        timezone: "America/Los_Angeles",
        theme: "light",
        style: "1",
        locale: "en",
        allow_symbol_change: true,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: true,
        support_host: "https://www.tradingview.com",
      });
      widgetWrap.appendChild(script);
      container.appendChild(widgetWrap);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      container.innerHTML = "";
    };
  }, [market, studies, tradingViewInterval]);

  return (
    <div className={compact ? "chart-embed-shell" : "chart-popout-shell"}>
      {compact ? (
        <div className="chart-embed-header">
          <h2 className="trading-section-title" style={{ marginBottom: "0.35rem" }}>
            Live Chart Preview
          </h2>
          <p className="form-help" style={{ marginBottom: 0 }}>
            Viewing {market.toUpperCase()} on the {normalizedTimeframe} chart.
          </p>
          {indicatorSummary ? (
            <p className="form-help" style={{ marginBottom: 0 }}>
              {indicatorSummary.title}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="chart-popout-toolbar">
          <div>
            <h1 className="page-title" style={{ marginBottom: "0.35rem" }}>
              {market.toUpperCase()} Chart View
            </h1>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>
              Viewing {market.toUpperCase()} on the {normalizedTimeframe} chart.
            </p>
            {indicatorSummary ? (
              <p className="form-help" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
                {indicatorSummary.detail}
              </p>
            ) : null}
          </div>

          <div className="toolbar" style={{ marginBottom: 0 }}>
            {CHART_TIMEFRAME_OPTIONS.map((option) => (
              <Link
                key={option.value}
                href={`/trading/chart?market=${encodeURIComponent(
                  market,
                )}&timeframe=${encodeURIComponent(option.value)}`}
                className="button-link secondary"
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className={compact ? "chart-embed-panel" : "chart-popout-panel"} ref={containerRef} />

      {indicatorSummary ? (
        <div className="form-callout" style={{ marginTop: "1rem", marginBottom: 0 }}>
          <h3 className="form-callout-title">{indicatorSummary.title}</h3>
          <p className="form-callout-text" style={{ marginBottom: 0 }}>
            {indicatorSummary.detail} This overlay is there to help users see the
            strategy on the chart while they learn what the indicator is doing.
          </p>
        </div>
      ) : null}

      {isSpx ? (
        <div className="form-callout" style={{ marginTop: "1rem", marginBottom: 0 }}>
          <div className="spx-checklist-header">
            <div>
              <h3 className="form-callout-title">SPX Workflow Checklists</h3>
              <p className="form-callout-text" style={{ marginBottom: 0 }}>
                Check the strategy in play, then score the long and downside criteria before you commit.
              </p>
            </div>
            <button
              type="button"
              className="button-link secondary"
              onClick={handleResetChecklist}
            >
              Reset
            </button>
          </div>

          <div className="spx-checklist-stack">
            <div>
              <h4 className="spx-checklist-section-title">Strategy Fit</h4>
              <div className="spx-checklist-grid">
                {SPX_STRATEGY_CHECKLIST.map((item) => {
                  const checked = selectedChecklistItems.includes(item.id);

                  return (
                    <label
                      key={item.id}
                      className={`spx-checklist-item${checked ? " is-checked" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleChecklistItem(item.id)}
                      />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="spx-checklist-section-title">Long Criteria</h4>
              <div className="spx-checklist-grid">
                {SPX_LONG_CRITERIA_CHECKLIST.map((item) => {
                  const checked = selectedLongCriteriaItems.includes(item.id);

                  return (
                    <label
                      key={item.id}
                      className={`spx-checklist-item spx-checklist-item-long${checked ? " is-checked" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleLongCriteriaItem(item.id)}
                      />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="spx-checklist-section-title">Downside Criteria</h4>
              <div className="spx-checklist-grid">
                {SPX_SHORT_CRITERIA_CHECKLIST.map((item) => {
                  const checked = selectedShortCriteriaItems.includes(item.id);

                  return (
                    <label
                      key={item.id}
                      className={`spx-checklist-item spx-checklist-item-short${checked ? " is-checked" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleShortCriteriaItem(item.id)}
                      />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <p className="form-help" style={{ marginTop: "1rem" }}>
        If the embedded chart does not load, use the timeframe controls or open
        TradingView directly for {market.toUpperCase()}.
      </p>
      <Link
        href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(
          market.toUpperCase(),
        )}`}
        target="_blank"
        className="button-link secondary"
      >
        Open In TradingView
      </Link>
    </div>
  );
}
