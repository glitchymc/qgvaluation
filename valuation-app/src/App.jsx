import { useState, useRef, useCallback } from "react";
import "./App.css";

const fmt = (n, decimals = 1) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}B`;
  return `$${n.toFixed(decimals)}M`;
};
const fmtPct = (n) => (n == null ? "—" : `${Number(n).toFixed(1)}%`);
const fmtX = (n) => (n == null ? "—" : `${Number(n).toFixed(1)}x`);

export default function App() {
  const [step, setStep] = useState("upload");
  const [txType, setTxType] = useState("M&A");
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
      "Identifying industry & peers...",
      "Pulling market comparables...",
      "Running DCF model...",
      "Analyzing precedent transactions...",
      "Building football field...",
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) setProgress(steps[i++]);
    }, 1800);

    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txType, content }),
      });
      clearInterval(interval);
      if (!resp.ok) {
        const e = await resp.json();
        throw new Error(e.error || "Server error");
      }
      const parsed = await resp.json();
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
        <p className="page-sub">Upload financial statements or paste key metrics. Get institutional-grade valuation with market comps, DCF, and precedent transactions.</p>

        <div className="field-group">
          <label className="field-label">Transaction Type</label>
          <div className="tx-types">
            {["M&A", "Equity Raise", "IPO"].map(t => (
              <button key={t} className={`tx-btn ${txType === t ? "active" : ""}`} onClick={() => setTxType(t)}>{t}</button>
            ))}
          </div>
        </div>

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
            placeholder={`Paste financial data, annual report excerpts, or key metrics here.\n\nExample:\nCompany: Acme SaaS Inc.\nFY2024 Revenue: $42M (grew 35% YoY)\nEBITDA: $8.4M (20% margin)\nARR: $45M, NRR: 118%\nNet Income: $2.1M\nCash: $12M, Debt: $5M\nCustomers: 850 enterprise accounts\nIndustry: B2B SaaS / Workflow Automation`}
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
        <p className="disclaimer">AI-powered · Uses market data through training cutoff · Not financial advice</p>
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
    </div>
  );
}

function ResultsScreen({ result, onReset }) {
  const { company_summary, extracted_financials: ef, market_comps, valuations: v, football_field, key_value_drivers, risk_factors, recommendation, implied_multiples } = result;

  const ranges = [
    { label: "Comps — EV/Revenue", low: v.comps.equity_value_low, mid: v.comps.equity_value_mid, high: v.comps.equity_value_high, color: "#2563eb" },
    { label: "Comps — EV/EBITDA", low: v.comps.ev_ebitda_low, mid: v.comps.ev_ebitda_mid, high: v.comps.ev_ebitda_high, color: "#3b82f6" },
    { label: "DCF Analysis", low: v.dcf.equity_value_low, mid: v.dcf.equity_value_mid, high: v.dcf.equity_value_high, color: "#0891b2" },
    { label: "Precedent Transactions", low: v.precedent_transactions.equity_value_low, mid: v.precedent_transactions.equity_value_mid, high: v.precedent_transactions.equity_value_high, color: "#7c3aed" },
  ];

  const allVals = ranges.flatMap(r => [r.low, r.mid, r.high]).filter(Boolean);
  const chartMin = Math.min(...allVals) * 0.85;
  const chartMax = Math.max(...allVals) * 1.1;
  const chartRange = chartMax - chartMin;
  const pct = (val) => ((val - chartMin) / chartRange) * 100;

  return (
    <div className="page">
      <div className="results-container">
        <div className="results-header">
          <div>
            <div className="badges">
              <span className="badge gray">{company_summary.transaction_type}</span>
              <span className="badge blue">{company_summary.industry}</span>
            </div>
            <h1 className="company-name">{company_summary.name}</h1>
            <p className="company-desc">{company_summary.description}</p>
          </div>
          <button className="back-btn" onClick={onReset}>← New Analysis</button>
        </div>

        <Section title="Key Financials" subtitle={ef.fiscal_year}>
          <div className="kpi-grid">
            {[
              ["Revenue", fmt(ef.revenue)],
              ["Rev Growth", fmtPct(ef.revenue_growth)],
              ["EBITDA", fmt(ef.ebitda)],
              ["EBITDA Margin", fmtPct(ef.ebitda_margin)],
              ["Net Income", fmt(ef.net_income)],
              ["Net Debt", fmt((ef.total_debt || 0) - (ef.cash || 0))],
            ].map(([label, val]) => (
              <div key={label} className="kpi-card">
                <div className="kpi-label">{label}</div>
                <div className="kpi-value">{val}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Valuation Football Field" subtitle="Equity value range by methodology">
          <div className="football-field">
            {ranges.map((r, i) => (
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
                <div className="ff-total-mid">{fmt(football_field.overall_mid)}</div>
                <div className="ff-total-sub">{fmt(football_field.overall_low)} – {fmt(football_field.overall_high)}</div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Market Comparables" subtitle="Public company benchmarks">
          <div className="table-wrap">
            <table className="comps-table">
              <thead>
                <tr>{["Company", "EV/Rev", "EV/EBITDA", "P/E", "Rev Growth", "Why Comparable"].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(market_comps || []).map((c, i) => (
                  <tr key={i}>
                    <td className="td-company">{c.company}</td>
                    <td className="td-mono">{fmtX(c.ev_revenue)}</td>
                    <td className="td-mono">{fmtX(c.ev_ebitda)}</td>
                    <td className="td-mono">{fmtX(c.pe_ratio)}</td>
                    <td className={`td-mono ${c.revenue_growth > 20 ? "td-green" : ""}`}>{fmtPct(c.revenue_growth)}</td>
                    <td className="td-why">{c.why_comparable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="method-cards">
          {[
            { title: "DCF", cls: "card-teal", items: [`WACC: ${fmtPct(v.dcf.wacc_used)}`, `Terminal Growth: ${fmtPct(v.dcf.terminal_growth_rate)}`, `Projection: ${v.dcf.projection_years}yr`], range: `${fmt(v.dcf.equity_value_low)} — ${fmt(v.dcf.equity_value_high)}` },
            { title: "Precedent Tx", cls: "card-purple", items: [`Control Premium: ${fmtPct(v.precedent_transactions.control_premium)}`, `Avg EV/EBITDA Paid: ${fmtX(v.precedent_transactions.avg_ev_ebitda_paid)}`], range: `${fmt(v.precedent_transactions.equity_value_low)} — ${fmt(v.precedent_transactions.equity_value_high)}` },
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

        <p className="legal">AI-GENERATED VALUATION · FOR REFERENCE ONLY · NOT FINANCIAL ADVICE · VERIFY WITH LICENSED ADVISORS</p>
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
