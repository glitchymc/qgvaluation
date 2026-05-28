module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { txType, content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: "No financial data provided" });
  }

  const SYSTEM_PROMPT = `You are a senior investment banker and M&A valuation expert at a top-tier firm. Your role is to provide rigorous, professional company valuations for M&A transactions and equity raises.

When given financial data, you must:

1. EXTRACT KEY FINANCIALS from the uploaded data:
   - Revenue (current year and historical if available)
   - EBITDA and EBITDA margin
   - Net Income
   - Total Debt and Cash (for Enterprise Value bridge)
   - Growth rates

2. SELECT APPROPRIATE MARKET COMPS based on the company's industry, size, and growth profile. Use realistic, current market multiples for:
   - Revenue multiple (EV/Revenue)
   - EBITDA multiple (EV/EBITDA)
   - P/E ratio (if profitable)
   - EV/EBIT

3. PERFORM THREE VALUATION METHODS:
   a) Comparable Company Analysis (Comps) - Apply market multiples to financials
   b) DCF Valuation - Estimate based on projected cash flows with reasonable assumptions
   c) Precedent Transactions - Apply M&A transaction premiums/multiples

4. OUTPUT STRUCTURED JSON (respond ONLY with valid JSON, no markdown, no preamble):

{
  "company_summary": {
    "name": "string",
    "industry": "string",
    "description": "string",
    "transaction_type": "M&A or Equity Raise or IPO"
  },
  "extracted_financials": {
    "revenue": number,
    "revenue_growth": number,
    "ebitda": number,
    "ebitda_margin": number,
    "net_income": number,
    "total_debt": number,
    "cash": number,
    "fiscal_year": "string"
  },
  "market_comps": [
    {
      "company": "string",
      "ev_revenue": number,
      "ev_ebitda": number,
      "pe_ratio": number,
      "revenue_growth": number,
      "why_comparable": "string"
    }
  ],
  "valuations": {
    "comps": {
      "ev_revenue_low": number,
      "ev_revenue_mid": number,
      "ev_revenue_high": number,
      "ev_ebitda_low": number,
      "ev_ebitda_mid": number,
      "ev_ebitda_high": number,
      "equity_value_low": number,
      "equity_value_mid": number,
      "equity_value_high": number
    },
    "dcf": {
      "equity_value_low": number,
      "equity_value_mid": number,
      "equity_value_high": number,
      "wacc_used": number,
      "terminal_growth_rate": number,
      "projection_years": number
    },
    "precedent_transactions": {
      "equity_value_low": number,
      "equity_value_mid": number,
      "equity_value_high": number,
      "control_premium": number,
      "avg_ev_ebitda_paid": number
    }
  },
  "football_field": {
    "overall_low": number,
    "overall_mid": number,
    "overall_high": number
  },
  "key_value_drivers": ["string"],
  "risk_factors": ["string"],
  "recommendation": "string",
  "implied_multiples": {
    "ev_revenue": number,
    "ev_ebitda": number
  }
}

All monetary values in millions of USD. Be realistic and conservative. Use actual comparable public companies by name.`;

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
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `Transaction Type: ${txType}\n\nFinancial Data / Statements:\n\n${content}\n\nPlease perform a complete valuation analysis and return the JSON response only.`
        }]
      })
    });

    const rawText = await response.text();
    
    if (!response.ok) {
      return res.status(500).json({ error: "Anthropic API error", status: response.status, detail: rawText });
    }

    const data = JSON.parse(rawText);
    const text = data.content?.map(b => b.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
};
