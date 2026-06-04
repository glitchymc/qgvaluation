module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { txType, content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: "No financial data provided" });
  }

  // Trim input to 1500 chars to stay well under rate limit
  const trimmedContent = content.slice(0, 1500);

  try {
    // Phase 1: Research — minimal prompt, just get comp data
    const researchResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `M&A valuation research task. Industry: ${txType}. Company data: ${trimmedContent.slice(0, 400)}

Search for: (1) 4 public comparable companies with current EV/Revenue, EV/EBITDA, P/E multiples and sources. (2) 2 recent M&A deals in this sector with multiples paid. Be brief and factual.`
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
      .slice(0, 2500);

    // Small delay to avoid hitting rate limit between calls
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
        system: "You are an M&A banker. Return ONLY a raw JSON object, no markdown.",
        messages: [{
          role: "user",
          content: `Transaction: ${txType}
Financials: ${trimmedContent}
Live research: ${researchText}

Return JSON:
{"company_summary":{"name":"","industry":"","description":"","transaction_type":""},"extracted_financials":{"revenue":0,"revenue_growth":0,"ebitda":0,"ebitda_margin":0,"net_income":0,"total_debt":0,"cash":0,"fiscal_year":""},"market_comps":[{"company":"","ticker":"","ev_revenue":0,"ev_ebitda":0,"pe_ratio":0,"revenue_growth":0,"market_cap":0,"why_comparable":"","data_source":"","data_url":"","data_date":"","data_verified":true}],"valuations":{"comps":{"ev_revenue_low":0,"ev_revenue_mid":0,"ev_revenue_high":0,"ev_ebitda_low":0,"ev_ebitda_mid":0,"ev_ebitda_high":0,"equity_value_low":0,"equity_value_mid":0,"equity_value_high":0},"dcf":{"equity_value_low":0,"equity_value_mid":0,"equity_value_high":0,"wacc_used":0,"terminal_growth_rate":0,"projection_years":0},"precedent_transactions":{"equity_value_low":0,"equity_value_mid":0,"equity_value_high":0,"control_premium":0,"avg_ev_ebitda_paid":0}},"precedent_deals":[{"target":"","acquirer":"","year":0,"deal_value":0,"ev_ebitda_paid":0,"ev_revenue_paid":0,"source":""}],"football_field":{"overall_low":0,"overall_mid":0,"overall_high":0},"key_value_drivers":[],"risk_factors":[],"recommendation":"","implied_multiples":{"ev_revenue":0,"ev_ebitda":0},"accuracy_assessment":{"overall_confidence":"Medium","confidence_score":0,"live_data_coverage":0,"data_quality":{"score":0,"inputs_provided":[],"inputs_missing":[],"assumptions_made":[]},"methodology_notes":{"comps":"","dcf":"","precedent_transactions":""},"valuation_caveats":[],"what_would_improve_accuracy":[]}}`
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
