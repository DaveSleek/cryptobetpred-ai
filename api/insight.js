// /api/insight.js
// A Vercel Serverless Function. This runs on Vercel's server, NOT in the browser —
// that's the whole point. Your Gemini key lives here as an environment variable
// (set in the Vercel dashboard, never written in this file), so it's never
// exposed to anyone visiting your site.
//
// Uses Google's Gemini API — genuinely free, no credit card required.
// Get a key at https://ai.google.dev (sign in with a Google account).

export default async function handler(req, res) {
  const { symbol, price, change } = req.query;

  if (!symbol || !price || change === undefined) {
    return res.status(400).json({ error: 'Missing symbol, price, or change parameter.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY environment variable.' });
  }

  const direction = parseFloat(change) >= 0 ? 'up' : 'down';

  const prompt = `You are a market analyst writing short insight blurbs for a prediction dashboard.

Data:
Symbol: ${symbol}
Current price: ${price}
24h change: ${change}%
Direction: ${direction}

Respond with ONLY a raw JSON object (no markdown, no code fences, no extra text) with exactly these fields:
{
  "driver": "one short sentence, under 15 words, naming a plausible reason for this price movement",
  "risk": "one short sentence, under 15 words, naming a plausible near-term risk to this view",
  "confidence": a number between 40 and 75 representing confidence in the ${direction} bias
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const raw = data.candidates[0].content.parts[0].text;
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json({
      driver: parsed.driver,
      risk: parsed.risk,
      confidence: parsed.confidence,
      bias: direction
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}