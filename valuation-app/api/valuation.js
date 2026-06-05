module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { txType, content, researchText } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: "No content provided" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        system: `You are a senior M&A investment banker. Using the financial data and live market research, produce a rigorous valuation. Use multiples from live research where available and cite sources. Return ONLY a raw JSON object with these keys:
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
Company financials: ${content.slice(0, 1500)}
Live market research: ${researchText || "Not available — use training data for comps."}`
        }]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(500).json({ error: "Valuation failed", detail });
    }

    const data = await response.json();
    const rawText = (data.content || []).map(b => b.text || "").join("");

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
      return res.status(200).json({ error: "JSON parse failed", detail: parseErr.message, raw: rawText.slice(0, 1000) });
    }

    parsed._research_summary = researchText || "";
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
