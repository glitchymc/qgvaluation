export default async function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY;
  
  if (!key) {
    return res.status(200).json({ error: "No API key found in environment" });
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "laude-sonnet-4-5",
      max_tokens: 10,
      messages: [{ role: "user", content: "Say hi" }]
    })
  });

  const data = await response.json();
  return res.status(200).json({ status: response.status, data });
}
