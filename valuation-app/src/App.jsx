import { useState, useRef, useCallback } from "react";
import "./App.css";

const fmt = (n, decimals = 1) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}B`;
  return `$${Number(n).toFixed(decimals)}M`;
};
const fmtPct = (n) => (n == null ? "—" : `${Number(n).toFixed(1)}%`);
const fmtX = (n) => (n == null ? "—" : `${Number(n).toFixed(1)}x`);

export default function App() {
  const [step, setStep] = useState("upload");
  const [txType, setTxType] = useState("M&A");
  const [companyType, setCompanyType] = useState("private");
  const [fileText, setFileText] = useState("");
  const [fileName, setFileName] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [inputMode, setInputMode] = useState("manual");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const fileRef = useRef();

  const handleFile = useCallback((file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setFileText(e.target.result);
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const analyze = async () => {
    const content = inputMode === "file" ? fileText : manualInput;
    if (!content.trim()) { setError("Please provide financial data first."); return; }
    setError("");
    setStep("analyzing");

    const steps = [
      "Parsing financial statements...",
      "Identifying comparable companies...",
      "Searching live market data...",
      "Pulling Yahoo Finance & SEC filings...",
      "Running DCF model...",
      "Building bear / base / bull scenarios...",
      "Verifying sources & building report...",
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) setProgress(steps[i++]);
    }, 2200);

    try {
      // Phase 1: Research
      const researchResp = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txType, content }),
      });
      if (!researchResp.ok) {
        const e = await researchResp.json();
        throw new Error(typeof e.error === "string" ? e.error : JSON.stringify(e));
      }
      const { researchText } = await researchResp.json();

      setProgress("Preparing valuation model...");
      await new Promise(r => setTimeout(r, 62000));

      // Phase 2: Valuation
      setProgress("Building scenarios & football field...");
      const valuationResp = await fetch("/api/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txType, content, researchText, companyType }),
      });
      clearInterval(interval);
      if (!valuationResp.ok) {
        const e = await valuationResp.json();
        throw new Error(typeof e.error === "string" ? e.error : JSON.stringify(e));
      }
      const parsed = await valuationResp.json();
      setResult(parsed);
      setStep("results");
    } catch (err) {
      clearInterval(interval);
      setError("Analysis failed: " + err.message);
      setStep("upload");
    }
  };

  const reset = () => {
    setStep("upload"); setResult(null);
    setFileText(""); setFileName("");
    setManualInput(""); setError("");
  };

  if (step === "analyzing") return <AnalyzingScreen progress={progress} />;
  if (step === "results" && result) return <ResultsScreen result={result} onReset={reset} />;

  return (
    <div className="page">
      <div className="upload-container">
        <div className="brand">
          <div className="brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f8fafc" strokeWidth="2">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
              <polyline points="16 7 22 7 22 13"/>
            </svg>
          </div>
          <span className="brand-label">Valuation Intelligence</span>
        </div>
        <h1 className="page-title">M&A & Equity Valuation</h1>
        <p className="page-sub">Upload financial statements or paste key metrics. Get bear, base, and bull case valuations with live market data.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: "1.75rem" }}>
          <div className="field-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Transaction Type</label>
            <div className="tx-types">
              {["M&A", "Equity Raise", "IPO"].map(t => (
                <button key={t} className={`tx-btn ${txType === t ? "active" : ""}`} onClick={() => setTxType(t)}>{t}</button>
              ))}
            </div>
          </div>
          <div className="field-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Company Type</label>
            <div className="tx-types">
              {[["private", "Private"], ["public", "Public"]].map(([val, label]) => (
                <button key={val} className={`tx-btn ${companyType === val ? "active" : ""}`} onClick={() => setCompanyType(val)}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        {companyType === "private" && (
          <div className="private-notice">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Private company mode applies illiquidity discounts, size adjustments, and higher WACC to public comp multiples
          </div>
        )}

        <div className="tabs">
          {[["manual", "Paste Financials"], ["file", "Upload File"]].map(([mode, label]) => (
            <button key={mode} className={`tab ${inputMode === mode ? "active" : ""}`} onClick={() => setInputMode(mode)}>{label}</button>
          ))}
        </div>

        {inputMode === "manual" ? (
          <textarea
            className="financials-input"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            placeholder={`Paste financial data, annual report excerpts, or key metrics here.\n\nExample:\nCompany: Acme SaaS Inc.\nFY2024 Revenue: $42M (grew 35% YoY)\nEBITDA: $8.4M (20% margin)\nARR: $45M, NRR: 118%\nNet Income: $2.1M\nCash: $12M, Debt: $5M\nIndustry: B2B SaaS`}
          />
        ) : (
          <div className="dropzone" onDragOver={e => e.preventDefault()} onDrop={handleDrop} onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".txt,.csv,.md,.json" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {fileName
              ? <><p className="drop-name">{fileName}</p><p className="drop-hint">File loaded · Click to replace</p></>
              : <><p className="drop-name">Drop financial statements here</p><p className="drop-hint">TXT, CSV, MD, JSON · or click to browse</p></>
            }
          </div>
        )}

        {error && <div className="error-box">{error}</div>}

        <button className="analyze-btn" onClick={analyze}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          Run Valuation Analysis
        </button>
        <p className="disclaimer">Live data sourced at time of analysis · Takes ~90 seconds · Not financial advice</p>
      </div>
    </div>
  );
}

function AnalyzingScreen({ progress }) {
  return (
    <div className="page center">
      <div className="spinner" />
      <h2 className="analyzing-title">Running Analysis</h2>
      <p className="analyzing-sub">{progress || "Initializing..."}</p>
      <p className="analyzing-note">Searching live data then building scenarios — takes ~90 seconds</p>
    </div>
  );
}

function LiveBadge({ verified }) {
  return verified
    ? <span className="live-badge live-green">● Live</span>
    : <span className="live-badge live-amber">~ Estimated</span>;
}

function ScenarioToggle({ scenarios, active, onChange }) {
  if (!scenarios) return null;
  const config = {
    bear: { label: "Bear Case", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: "↓" },
    base: { label: "Base Case", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", icon: "→" },
    bull: { label: "Bull Case", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", icon: "↑" },
  };

  const s = scenarios[active];
  const c = config[active];

  return (
    <div className="scenario-section">
      <div className="section-header">
        <h2 className="section-title">Scenario Analysis</h2>
        <span className="section-sub">Bear / Base / Bull</span>
      </div>

      <div className="scenario-tabs">
        {["bear", "base", "bull"].map(key => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`scenario-tab ${active === key ? "active" : ""}`}
            style={active === key ? { background: config[key].bg, border: `1.5px solid ${config[key].border}`, color: config[key].color } : {}}
          >
            <span className="scenario-icon">{config[key].icon}</span>
            {config[key].label}
          </button>
        ))}
      </div>

      {s && (
        <div className="scenario-card" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
          <div className="scenario-header">
            <div>
              <div className="scenario-label" style={{ color: c.color }}>{c.icon} {c.label}</div>
              <p className="scenario-desc">{s.description}</p>
            </div>
            <div className="scenario-value" style={{ color: c.color }}>{fmt(s.equity_value)}</div>
          </div>

          <div className="scenario-multiples">
            <div className="scenario-multiple">
              <span className="sm-label">EV/Revenue</span>
              <span className="sm-value" style={{ color: c.color }}>{fmtX(s.ev_revenue)}</span>
            </div>
            <div className="scenario-multiple">
              <span className="sm-label">EV/EBITDA</span>
              <span className="sm-value" style={{ color: c.color }}>{fmtX(s.ev_ebitda)}</span>
            </div>
          </div>

          <div className="scenario-grid">
            <div>
              <div className="scenario-list-title">Key Assumptions</div>
              {(s.key_assumptions || []).map((a, i) => (
                <div key={i} className="scenario-list-item">
                  <span style={{ color: c.color, fontWeight: 700, flexShrink: 0 }}>·</span>
                  <span>{a}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="scenario-list-title">{active === "bear" ? "Risks Materializing" : "Upside Drivers"}</div>
              {((active === "bear" ? s.risks_materializing : s.upside_drivers) || []).map((d, i) => (
                <div key={i} className="scenario-list-item">
                  <span style={{ color: c.color, fontWeight: 700, flexShrink: 0 }}>·</span>
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="scenario-summary">
        {["bear", "base", "bull"].map(key => (
          <div key={key} className="scenario-summary-item" style={{ borderColor: config[key].border }}>
            <div className="ssi-label" style={{ color: config[key].color }}>{config[key].icon} {config[key].label}</div>
            <div className="ssi-value" style={{ color: config[key].color }}>{fmt(scenarios[key]?.equity_value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultsScreen({ result, onReset }) {
  const {
    company_summary, extracted_financials: ef, market_comps,
    valuations: v, scenarios, precedent_deals, football_field,
    key_value_drivers, risk_factors, recommendation,
    implied_multiples, accuracy_assessment, private_company_adjustments,
    _research_summary
  } = result;

  const [activeScenario, setActiveScenario] = useState("base");
  const [showResearch, setShowResearch] = useState(false);

  const ranges = [
    { label: "Comps — EV/Revenue", low: v?.comps?.equity_value_low, mid: v?.comps?.equity_value_mid, high: v?.comps?.equity_value_high, color: "#2563eb" },
    { label: "Comps — EV/EBITDA", low: v?.comps?.ev_ebitda_low, mid: v?.comps?.ev_ebitda_mid, high: v?.comps?.ev_ebitda_high, color: "#3b82f6" },
    { label: "DCF Analysis", low: v?.dcf?.equity_value_low, mid: v?.dcf?.equity_value_mid, high: v?.dcf?.equity_value_high, color: "#0891b2" },
    { label: "Precedent Transactions", low: v?.precedent_transactions?.equity_value_low, mid: v?.precedent_transactions?.equity_value_mid, high: v?.precedent_transactions?.equity_value_high, color: "#7c3aed" },
  ];

  const allVals = ranges.flatMap(r => [r.low, r.mid, r.high]).filter(n => n && !isNaN(n));
  const chartMin = allVals.length ? Math.min(...allVals) * 0.85 : 0;
  const chartMax = allVals.length ? Math.max(...allVals) * 1.1 : 100;
  const chartRange = chartMax - chartMin || 1;
  const pct = (val) => Math.max(0, Math.min(100, ((val - chartMin) / chartRange) * 100));

  const liveCount = (market_comps || []).filter(c => c.data_verified).length;
  const totalCount = (market_comps || []).length;
  const isPrivate = company_summary?.company_type === "private";

  return (
    <div className="page">
      <div className="results-container">
        <div className="results-header">
          <div>
            <div className="badges">
              <span className="badge gray">{company_summary?.transaction_type}</span>
              <span className="badge blue">{company_summary?.industry}</span>
              {isPrivate && <span className="badge purple">Private Co.</span>}
              <span className="badge green-pill">{liveCount}/{totalCount} comps live</span>
            </div>
            <h1 className="company-name">{company_summary?.name}</h1>
            <p className="company-desc">{company_summary?.description}</p>
          </div>
          <button className="back-btn" onClick={onReset}>← New Analysis</button>
        </div>

        <div className="freshness-banner">
          <div className="freshness-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Market data retrieved live · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
          </div>
          <div className="freshness-sources">
            <span className="source-chip">Yahoo Finance</span>
            <span className="source-chip">SEC EDGAR</span>
            <span className="source-chip">Financial News</span>
          </div>
        </div>

        {isPrivate && private_company_adjustments && (
          <div className="private-adjustments">
            <div className="pa-title">Private Company Adjustments Applied</div>
            <div className="pa-grid">
              {private_company_adjustments.illiquidity_discount && <div className="pa-item"><span className="pa-label">Illiquidity Discount</span><span className="pa-value">{fmtPct(private_company_adjustments.illiquidity_discount)}</span></div>}
              {private_company_adjustments.size_discount && <div className="pa-item"><span className="pa-label">Size Discount</span><span className="pa-value">{fmtPct(private_company_adjustments.size_discount)}</span></div>}
              {private_company_adjustments.wacc_premium && <div className="pa-item"><span className="pa-label">WACC Premium</span><span className="pa-value">+{fmtPct(private_company_adjustments.wacc_premium)}</span></div>}
            </div>
            {private_company_adjustments.notes && <p className="pa-notes">{private_company_adjustments.notes}</p>}
          </div>
        )}

        <Section title="Key Financials" subtitle={ef?.fiscal_year}>
          <div className="kpi-grid">
            {[
              ["Revenue", fmt(ef?.revenue)],
              ["Rev Growth", fmtPct(ef?.revenue_growth)],
              ["EBITDA", fmt(ef?.ebitda)],
              ["EBITDA Margin", fmtPct(ef?.ebitda_margin)],
              ["Net Income", fmt(ef?.net_income)],
              ["Net Debt", fmt((ef?.total_debt || 0) - (ef?.cash || 0))],
            ].map(([label, val]) => (
              <div key={label} className="kpi-card">
                <div className="kpi-label">{label}</div>
                <div className="kpi-value">{val}</div>
              </div>
            ))}
          </div>
        </Section>

        <ScenarioToggle scenarios={scenarios} active={activeScenario} onChange={setActiveScenario} />

        <Section title="Valuation Football Field" subtitle="Equity value range by methodology">
          <div className="football-field">
            {ranges.map((r, i) => r.low && (
              <div key={i} className="ff-row">
                <div className="ff-meta">
                  <span className="ff-label">{r.label}</span>
                  <span className="ff-range">{fmt(r.low)} — {fmt(r.mid)} — {fmt(r.high)}</span>
                </div>
                <div className="ff-track">
                  <div className="ff-bar" style={{ left: `${pct(r.low)}%`, width: `${pct(r.high) - pct(r.low)}%`, background: r.color }} />
                  <div className="ff-mid" style={{ left: `${pct(r.mid) - 0.5}%` }} />
                </div>
              </div>
            ))}
            <div className="ff-total">
              <span className="ff-total-label">Overall Valuation Range</span>
              <div className="ff-total-right">
                <div className="ff-total-mid">{fmt(football_field?.overall_mid)}</div>
                <div className="ff-total-sub">{fmt(football_field?.overall_low)} – {fmt(football_field?.overall_high)}</div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Market Comparables" subtitle="Live data · sourced at time of analysis">
          <div className="table-wrap">
            <table className="comps-table">
              <thead>
                <tr>{["Company", "EV/Rev", "EV/EBITDA", "P/E", "Rev Growth", "Mkt Cap", "Source", "Date", ""].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(market_comps || []).map((c, i) => (
                  <tr key={i}>
                    <td className="td-company">
                      <div>{c.company}</div>
                      {c.ticker && <div className="td-ticker">{c.ticker}</div>}
                    </td>
                    <td className="td-mono">{fmtX(c.ev_revenue)}</td>
                    <td className="td-mono">{fmtX(c.ev_ebitda)}</td>
                    <td className="td-mono">{fmtX(c.pe_ratio)}</td>
                    <td className={`td-mono ${c.revenue_growth > 20 ? "td-green" : ""}`}>{fmtPct(c.revenue_growth)}</td>
                    <td className="td-mono">{fmt(c.market_cap)}</td>
                    <td className="td-source-cell">
                      {c.data_url
                        ? <a href={c.data_url} target="_blank" rel="noreferrer" className="source-link">{c.data_source || "Source"}</a>
                        : <span className="source-text">{c.data_source || "—"}</span>
                      }
                    </td>
                    <td className="td-mono td-date">{c.data_date || "—"}</td>
                    <td><LiveBadge verified={c.data_verified} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {precedent_deals?.length > 0 && (
          <Section title="Precedent Transactions" subtitle="Recent M&A deals in this sector">
            <div className="table-wrap">
              <table className="comps-table">
                <thead>
                  <tr>{["Target", "Acquirer", "Year", "Deal Value", "EV/EBITDA", "EV/Revenue", "Source"].map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {precedent_deals.map((d, i) => (
                    <tr key={i}>
                      <td className="td-company">{d.target}</td>
                      <td className="td-source-cell">{d.acquirer}</td>
                      <td className="td-mono">{d.year}</td>
                      <td className="td-mono">{fmt(d.deal_value)}</td>
                      <td className="td-mono">{fmtX(d.ev_ebitda_paid)}</td>
                      <td className="td-mono">{fmtX(d.ev_revenue_paid)}</td>
                      <td className="td-source-cell">{d.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        <div className="method-cards">
          {[
            { title: "DCF", cls: "card-teal", items: [`WACC: ${fmtPct(v?.dcf?.wacc_used)}`, `Terminal Growth: ${fmtPct(v?.dcf?.terminal_growth_rate)}`, `Projection: ${v?.dcf?.projection_years}yr`], range: `${fmt(v?.dcf?.equity_value_low)} — ${fmt(v?.dcf?.equity_value_high)}` },
            { title: "Precedent Tx", cls: "card-purple", items: [`Control Premium: ${fmtPct(v?.precedent_transactions?.control_premium)}`, `Avg EV/EBITDA Paid: ${fmtX(v?.precedent_transactions?.avg_ev_ebitda_paid)}`], range: `${fmt(v?.precedent_transactions?.equity_value_low)} — ${fmt(v?.precedent_transactions?.equity_value_high)}` },
            { title: "Implied Multiples", cls: "card-green", items: [`EV/Revenue: ${fmtX(implied_multiples?.ev_revenue)}`, `EV/EBITDA: ${fmtX(implied_multiples?.ev_ebitda)}`], range: "at midpoint valuation" },
          ].map((card, i) => (
            <div key={i} className={`method-card ${card.cls}`}>
              <div className="mc-title">{card.title}</div>
              {card.items.map((item, j) => <div key={j} className="mc-item">{item}</div>)}
              <div className="mc-range">{card.range}</div>
            </div>
          ))}
        </div>

        <div className="drivers-risks">
          <div className="drivers">
            <h3 className="dr-title green">Key Value Drivers</h3>
            {(key_value_drivers || []).map((d, i) => (
              <div key={i} className="dr-item"><span className="dr-icon green">+</span><span>{d}</span></div>
            ))}
          </div>
          <div className="risks">
            <h3 className="dr-title orange">Risk Factors</h3>
            {(risk_factors || []).map((r, i) => (
              <div key={i} className="dr-item"><span className="dr-icon orange">!</span><span>{r}</span></div>
            ))}
          </div>
        </div>

        <div className="recommendation">
          <div className="rec-label">Banker's View</div>
          <p className="rec-text">{recommendation}</p>
        </div>

        {accuracy_assessment && <AccuracySection accuracy={accuracy_assessment} />}

        {_research_summary && (
          <div className="research-toggle">
            <button className="toggle-btn" onClick={() => setShowResearch(!showResearch)}>
              {showResearch ? "▲ Hide" : "▼ Show"} raw market research
            </button>
            {showResearch && (
              <div className="research-box">
                <pre>{_research_summary}</pre>
              </div>
            )}
          </div>
        )}

        <p className="legal">LIVE DATA SOURCED AT TIME OF ANALYSIS · AI-ASSISTED VALUATION · NOT FINANCIAL ADVICE · VERIFY WITH LICENSED ADVISORS</p>
      </div>
    </div>
  );
}

function AccuracySection({ accuracy }) {
  const { overall_confidence, confidence_score, live_data_coverage, data_quality, methodology_notes, valuation_caveats, what_would_improve_accuracy } = accuracy;
  const scoreColor = confidence_score >= 70 ? "#059669" : confidence_score >= 45 ? "#d97706" : "#dc2626";
  const scoreBg = confidence_score >= 70 ? "#ecfdf5" : confidence_score >= 45 ? "#fffbeb" : "#fef2f2";
  const scoreBorder = confidence_score >= 70 ? "#a7f3d0" : confidence_score >= 45 ? "#fde68a" : "#fecaca";

  return (
    <div className="accuracy-section">
      <div className="section-header">
        <h2 className="section-title">Accuracy & Sources</h2>
        <span className="section-sub">Methodology transparency</span>
      </div>
      <div className="confidence-banner" style={{ background: scoreBg, border: `1px solid ${scoreBorder}` }}>
        <div className="confidence-left">
          <div className="confidence-score" style={{ color: scoreColor }}>{confidence_score}</div>
          <div className="confidence-label" style={{ color: scoreColor }}>Confidence</div>
        </div>
        <div className="confidence-bar-wrap">
          <div className="confidence-bar-track">
            <div className="confidence-bar-fill" style={{ width: `${confidence_score}%`, background: scoreColor }} />
          </div>
          <div className="confidence-meta">
            <span>Data Quality: {data_quality?.score}/100</span>
            <span>Live Coverage: {live_data_coverage != null ? `${live_data_coverage}%` : overall_confidence}</span>
          </div>
        </div>
      </div>
      <div className="accuracy-grid">
        <div className="accuracy-card">
          <div className="ac-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>Inputs provided</div>
          {(data_quality?.inputs_provided || []).map((item, i) => <div key={i} className="ac-item ac-item-green">{item}</div>)}
        </div>
        <div className="accuracy-card">
          <div className="ac-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Missing inputs</div>
          {(data_quality?.inputs_missing || []).map((item, i) => <div key={i} className="ac-item ac-item-amber">{item}</div>)}
        </div>
      </div>
      {data_quality?.assumptions_made?.length > 0 && (
        <div className="assumptions-box">
          <div className="ac-title" style={{ marginBottom: 10 }}>Assumptions made</div>
          {data_quality.assumptions_made.map((a, i) => (
            <div key={i} className="assumption-item"><span className="assumption-num">{i + 1}</span><span>{a}</span></div>
          ))}
        </div>
      )}
      {methodology_notes && (
        <div className="method-notes">
          <div className="ac-title" style={{ marginBottom: 12 }}>Methodology notes</div>
          {[["Comparable companies", methodology_notes.comps], ["DCF model", methodology_notes.dcf], ["Precedent transactions", methodology_notes.precedent_transactions]].map(([label, note]) => note && (
            <div key={label} className="method-note-row">
              <span className="method-note-label">{label}</span>
              <span className="method-note-text">{note}</span>
            </div>
          ))}
        </div>
      )}
      <div className="accuracy-grid">
        <div className="accuracy-card">
          <div className="ac-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Valuation caveats</div>
          {(valuation_caveats || []).map((c, i) => <div key={i} className="ac-item ac-item-red">{c}</div>)}
        </div>
        <div className="accuracy-card">
          <div className="ac-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>What would improve accuracy</div>
          {(what_would_improve_accuracy || []).map((w, i) => <div key={i} className="ac-item ac-item-blue">{w}</div>)}
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        {subtitle && <span className="section-sub">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}
