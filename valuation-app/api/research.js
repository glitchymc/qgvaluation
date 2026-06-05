module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { txType, content } = req.body;
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
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `Research task for ${txType} valuation. Company: ${content.slice(0, 300)}

Find 4 public comparable companies with current EV/Revenue, EV/EBITDA, P/E, market cap, revenue growth, source URL and date. Also find 2 recent M&A deals in this sector with multiples paid. Be concise.`
        }]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(500).json({ error: "Research failed", detail });
    }

    const data = await response.json();
    const researchText = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n")
      .slice(0, 1500);

    return res.status(200).json({ researchText });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
