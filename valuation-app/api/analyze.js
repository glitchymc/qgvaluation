module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { txType, content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: "No financial data provided" });
  }

  const SEARCH_PROMPT = `You are a financial research assistant supporting an M&A valuation. 

Analyze the financial data below, identify the company's industry, and select 5-6 appropriate public comparable companies.

Then use web search to find CURRENT LIVE data for each comparable:
- Current market cap and enterprise value
- Last 12 months (LTM) revenue and EBITDA
- EV/Revenue and EV/EBITDA multiples
- P/E ratio
- YoY revenue growth rate

Also search for:
- Recent M&A transactions in this industry (past 2-3 years) with deal values and multiples paid
- Any recent analyst reports or industry valuation benchmarks

Cite every source with URL and date. Flag any data you could not find live.

Financial data:
${content}

Transaction type: ${txType}`;

  const VALUATION_SYSTEM = `You are a senior investment banker. Using live market research, produce a rigorous valuation. 
Use ONLY multiples actually found in the research. Cite source and date for every number. Flag estimates clearly.
Respond ONLY with valid JSON — no markdown, no preamble.

JSON structure:
{
  "company_summary": { "name": "string", "industry": "string", "description": "string", "transaction_type": "string" },
  "extracted_financials": { "revenue": number, "revenue_growth": number, "ebitda": number, "ebitda_margin": number, "net_income": number, "total_debt": number, "cash": number, "fiscal_year": "string" },
  "market_comps": [
    {
      "company": "string",
      "ticker": "string",
      "ev_revenue": number,
      "ev_ebitda": number,
      "pe_ratio": number,
      "revenue_growth": number,
      "market_cap": number,
      "why_comparable": "string",
      "data_source": "string",
      "data_url": "string",
      "data_date": "string",
      "data_verified": true
    }
  ],
  "valuations": {
    "comps": { "ev_revenue_low": number, "ev_revenue_mid": number, "ev_revenue_high": number, "ev_ebitda_low": number, "ev_ebitda_mid": number, "ev_ebitda_high": number, "equity_value_low": number, "equity_value_mid": number, "equity_value_high": number },
    "dcf": { "equity_value_low": number, "equity_value_mid": number, "equity_value_high": number, "wacc_used": number, "terminal_growth_rate": number, "projection_years": number },
    "precedent_transactions": { "equity_value_low": number, "equity_value_mid": number, "equity_value_high": number, "control_premium": number, "avg_ev_ebitda_paid": number }
  },
  "precedent_deals": [
    {
      "target": "string",
      "acquirer": "string",
      "year": number,
      "deal_value": number,
      "ev_ebitda_paid": number,
      "ev_revenue_paid": number,
      "source": "string"
    }
  ],
  "football_field": { "overall_low": number, "overall_mid": number, "overall_high": number },
  "key_value_drivers": ["string"],
  "risk_factors": ["string"],
  "recommendation": "string",
  "implied_multiples": { "ev_revenue": number, "ev_ebitda": number },
  "accuracy_assessment": {
    "overall_confidence": "High or Medium or Low",
    "confidence_score": number,
    "live_data_coverage": number,
    "data_quality": {
      "score": number,
      "inputs_provided": ["string"],
      "inputs_missing": ["string"],
      "assumptions_made": ["string"]
    },
    "methodology_notes": { "comps": "string", "dcf": "string", "precedent_transactions": "string" },
    "valuation_caveats": ["string"],
    "what_would_improve_accuracy": ["string"]
  }
}
All monetary values in millions USD.`;

  try {
    // Phase 1: Live web research
    const researchResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 5000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: SEARCH_PROMPT }]
      })
    });

    const researchRaw = await researchResp.text();
    if (!researchResp.ok) {
      return res.status(500).json({ error: "Research phase failed", detail: researchRaw });
    }

    const researchData = JSON.parse(researchRaw);
    const researchText = (researchData.content || [])
      .map(b => {
        if (b.type === "text") return b.text;
        if (b.type === "tool_result") return JSON.stringify(b.content);
        return "";
      })
      .filter(Boolean)
      .join("\n\n");

    // Phase 2: Valuation using live data
    const valuationResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 5000,
        system: VALUATION_SYSTEM,
        messages: [{
          role: "user",
          content: `Transaction Type: ${txType}\n\nOriginal Financial Data:\n${content}\n\n---\n\nLIVE MARKET RESEARCH (retrieved via web search right now):\n${researchText}\n\nGenerate the complete valuation JSON using this live data.`
        }]
      })
    });

    const valuationRaw = await valuationResp.text();
    if (!valuationResp.ok) {
      return res.status(500).json({ error: "Valuation phase failed", detail: valuationRaw });
    }

    const valuationData = JSON.parse(valuationRaw);
    const text = (valuationData.content || []).map(b => b.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    parsed._research_summary = researchText.slice(0, 4000);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
