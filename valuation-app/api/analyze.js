module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { txType, content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: "No financial data provided" });
  }

  const trimmedContent = content.slice(0, 2000);

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
        max_tokens: 3000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `You are a financial research assistant for an M&A valuation.

Company data: ${trimmedContent}
Transaction type: ${txType}

Use web search to find:
1. 5 public comparable companies with their current EV/Revenue, EV/EBITDA, P/E multiples, market cap, and revenue growth. Cite the source URL and date for each.
2. 3 recent M&A transactions in this industry (last 2-3 years) with deal value and multiples paid. Cite sources.

Be specific with numbers. State clearly where each data point came from.`
        }]
      })
    });

    if (!researchResp.ok) {
      const detail = await researchResp.text();
      return res.status(500).json({ error: "Research phase failed", detail });
    }

    const researchData = await researchResp.json();
    const researchText = (researchData.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n")
      .slice(0, 3000);

    // Delay between phases
    await new Promise(r => setTimeout(r, 3000));

    // Phase 2: Valuation
    const valuationResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        system: `You are a senior M&A investment banker. Using the financial data and live market research provided, produce a rigorous valuation. Use ONLY multiples from the live research where available — cite source and date for each. Return ONLY a raw JSON object with these exact keys:
company_summary (name, industry, description, transaction_type),
extracted_financials (revenue, revenue_growth, ebitda, ebitda_margin, net_income, total_debt, cash, fiscal_year),
market_comps (array: company, ticker, ev_revenue, ev_ebitda, pe_ratio, revenue_growth, market_cap, why_comparable, data_source, data_url, data_date, data_verified),
valuations (comps: ev_revenue_low/mid/high, ev_ebitda_low/mid/high, equity_value_low/mid/high; dcf: equity_value_low/mid/high, wacc_used, terminal_growth_rate, projection_years; precedent_transactions: equity_value_low/mid/high, control_premium, avg_ev_ebitda_paid),
precedent_deals (array: target, acquirer, year, deal_value, ev_ebitda_paid, ev_revenue_paid, source),
football_field (overall_low, overall_mid, overall_high),
key_value_drivers (array of strings),
risk_factors (array of strings),
recommendation (string),
implied_multiples (ev_revenue, ev_ebitda),
accuracy_assessment (overall_confidence, confidence_score 0-100, live_data_coverage 0-100, data_quality with score/inputs_provided/inputs_missing/assumptions_made, methodology_notes with comps/dcf/precedent_transactions, valuation_caveats, what_would_improve_accuracy).
All money in millions USD. No markdown. Raw JSON only.`,
        messages: [{
          role: "user",
          content: `Transaction type: ${txType}
Company financials: ${trimmedContent}
Live market research: ${researchText}`
        }]
      })
    });

    if (!valuationResp.ok) {
      const detail = await valuationResp.text();
      return res.status(500).json({ error: "Valuation phase failed", detail });
    }

    const valuationData = await valuationResp.json();
    const rawText = (valuationData.content || []).map(b => b.text || "").join("");

    let jsonStr = rawText.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    const braceStart = jsonStr.indexOf("{");
    const braceEnd = jsonStr.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd !== -1) {
      jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      return res.status(500).json({ error: "JSON parse failed", detail: parseErr.message, raw: rawText.slice(0, 500) });
    }

    parsed._research_summary = researchText;
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
