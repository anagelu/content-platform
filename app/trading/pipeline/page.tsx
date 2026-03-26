import { auth } from "@/auth";
import { getMarketQuote } from "@/lib/market-data";
import {
  getExitAlert,
  getPipelineScore,
  getPipelineStage,
  listScreeningCandidates,
  listTrackedPositions,
} from "@/lib/trading-pipeline";
import Link from "next/link";
import { redirect } from "next/navigation";
import { addScreeningCandidate, addTrackedPosition } from "./actions";

export default async function TradingPipelinePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = Number(session.user.id);
  const [candidates, positions] = await Promise.all([
    listScreeningCandidates(userId),
    listTrackedPositions(userId),
  ]);

  const quotes = await Promise.all(
    positions.map(async (position) => ({
      positionId: position.id,
      quote: await getMarketQuote(position.market),
    })),
  );
  const quoteMap = new Map(quotes.map((item) => [item.positionId, item.quote]));

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">Trade Execution Pipeline</h1>
        <p className="page-subtitle">
          Move from screening to filtering to active position management with a
          simple matrix that combines fundamental, sentiment, and technical
          inputs, then monitor open trades for exit pressure near target zones.
        </p>

        <div className="toolbar">
          <Link href="/trading" className="button-link secondary">
            Back to Trading
          </Link>
          <Link href="/trading/new" className="button-link secondary">
            New Trading Session
          </Link>
        </div>

        <section className="pipeline-grid">
          <div className="form-card">
            <h2 className="trading-section-title">1. Screening Candidate</h2>
            <form action={addScreeningCandidate}>
              <div className="trading-grid">
                <div className="form-group">
                  <label htmlFor="candidate-market" className="form-label">Market / ticker</label>
                  <input id="candidate-market" name="market" className="form-input" required />
                </div>
                <div className="form-group">
                  <label htmlFor="candidate-timeframe" className="form-label">Decision timeframe</label>
                  <input id="candidate-timeframe" name="timeframe" className="form-input" required placeholder="1H, 4H, Daily" />
                </div>
                <div className="form-group">
                  <label htmlFor="candidate-setup" className="form-label">Setup type</label>
                  <input id="candidate-setup" name="setupType" className="form-input" required placeholder="Breakout, Pullback To Support" />
                </div>
                <div className="form-group">
                  <label htmlFor="candidate-direction" className="form-label">Direction</label>
                  <select id="candidate-direction" name="direction" className="form-select" defaultValue="LONG">
                    <option value="LONG">Long</option>
                    <option value="SHORT">Short</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="candidate-fundamental" className="form-label">Fundamental score</label>
                  <input id="candidate-fundamental" name="fundamentalScore" type="number" min="1" max="10" className="form-input" required defaultValue="5" />
                </div>
                <div className="form-group">
                  <label htmlFor="candidate-sentiment" className="form-label">Sentiment score</label>
                  <input id="candidate-sentiment" name="sentimentScore" type="number" min="1" max="10" className="form-input" required defaultValue="5" />
                </div>
                <div className="form-group">
                  <label htmlFor="candidate-technical" className="form-label">Technical score</label>
                  <input id="candidate-technical" name="technicalScore" type="number" min="1" max="10" className="form-input" required defaultValue="5" />
                </div>
                <div className="form-group">
                  <label htmlFor="candidate-catalyst" className="form-label">Catalyst</label>
                  <input id="candidate-catalyst" name="catalyst" className="form-input" placeholder="Earnings, macro, product launch" />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="candidate-thesis" className="form-label">Screening thesis</label>
                <textarea id="candidate-thesis" name="thesis" rows={4} className="form-textarea form-textarea-compact" required />
              </div>

              <div className="form-group">
                <label htmlFor="candidate-notes" className="form-label">Notes</label>
                <textarea id="candidate-notes" name="notes" rows={4} className="form-textarea form-textarea-compact" />
              </div>

              <button type="submit" className="submit-button">Add To Matrix</button>
            </form>
          </div>

          <div className="form-card">
            <h2 className="trading-section-title">2. Tracked Position</h2>
            <form action={addTrackedPosition}>
              <div className="trading-grid">
                <div className="form-group">
                  <label htmlFor="position-market" className="form-label">Market / ticker</label>
                  <input id="position-market" name="market" className="form-input" required />
                </div>
                <div className="form-group">
                  <label htmlFor="position-timeframe" className="form-label">Decision timeframe</label>
                  <input id="position-timeframe" name="timeframe" className="form-input" required />
                </div>
                <div className="form-group">
                  <label htmlFor="position-setup" className="form-label">Setup type</label>
                  <input id="position-setup" name="setupType" className="form-input" required />
                </div>
                <div className="form-group">
                  <label htmlFor="position-direction" className="form-label">Direction</label>
                  <select id="position-direction" name="direction" className="form-select" defaultValue="LONG">
                    <option value="LONG">Long</option>
                    <option value="SHORT">Short</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="position-entry" className="form-label">Entry price</label>
                  <input id="position-entry" name="entryPrice" type="number" step="0.01" className="form-input" required />
                </div>
                <div className="form-group">
                  <label htmlFor="position-stop" className="form-label">Stop loss</label>
                  <input id="position-stop" name="stopLoss" type="number" step="0.01" className="form-input" required />
                </div>
                <div className="form-group">
                  <label htmlFor="position-target1" className="form-label">Target one</label>
                  <input id="position-target1" name="targetOne" type="number" step="0.01" className="form-input" required />
                </div>
                <div className="form-group">
                  <label htmlFor="position-target2" className="form-label">Target two</label>
                  <input id="position-target2" name="targetTwo" type="number" step="0.01" className="form-input" />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="position-notes" className="form-label">Position notes</label>
                <textarea id="position-notes" name="notes" rows={4} className="form-textarea form-textarea-compact" />
              </div>

              <button type="submit" className="submit-button">Track Position</button>
            </form>
          </div>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Screening Matrix</h2>
          {candidates.length === 0 ? (
            <div className="card"><p>No screening candidates yet.</p></div>
          ) : (
            <div className="card-list">
              {candidates.map((candidate) => {
                const score = getPipelineScore(candidate);
                const stage = getPipelineStage(score);

                return (
                  <article key={candidate.id} className="card pipeline-card">
                    <div className="badge-row">
                      <span className="badge">{candidate.market}</span>
                      <span className="badge">{candidate.timeframe}</span>
                      <span className="badge">{candidate.setupType}</span>
                      <span className={`pipeline-stage pipeline-stage-${stage.toLowerCase().replace(" ", "-")}`}>{stage}</span>
                    </div>
                    <p className="meta">{candidate.direction} · Score {score}/10</p>
                    <p className="preview">{candidate.thesis}</p>
                    <div className="pipeline-score-row">
                      <span>Fundamental {candidate.fundamentalScore}/10</span>
                      <span>Sentiment {candidate.sentimentScore}/10</span>
                      <span>Technical {candidate.technicalScore}/10</span>
                    </div>
                    {candidate.catalyst ? <p className="form-help">Catalyst: {candidate.catalyst}</p> : null}
                    {candidate.notes ? <p className="form-help">Notes: {candidate.notes}</p> : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Active Position Monitor</h2>
          {positions.length === 0 ? (
            <div className="card"><p>No tracked positions yet.</p></div>
          ) : (
            <div className="card-list">
              {positions.map((position) => {
                const quote = quoteMap.get(position.id) ?? null;
                const alert = getExitAlert(position, quote?.price ?? null);

                return (
                  <article key={position.id} className="card pipeline-card">
                    <div className="badge-row">
                      <span className="badge">{position.market}</span>
                      <span className="badge">{position.timeframe}</span>
                      <span className="badge">{position.setupType}</span>
                      <span className={`pipeline-alert pipeline-alert-${alert.severity}`}>{alert.message}</span>
                    </div>
                    <p className="meta">
                      {position.direction} · Entry {position.entryPrice.toFixed(2)} · Stop {position.stopLoss.toFixed(2)}
                    </p>
                    <p className="meta">
                      Target 1 {position.targetOne.toFixed(2)}
                      {position.targetTwo ? ` · Target 2 ${position.targetTwo.toFixed(2)}` : ""}
                    </p>
                    <p className="meta">
                      Live price: {quote ? quote.price.toFixed(2) : "Unavailable"}
                    </p>
                    {position.notes ? <p className="form-help">Notes: {position.notes}</p> : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
