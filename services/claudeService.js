const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a bank statement parser. You will receive sanitized text extracted from a bank statement PDF (all sensitive identifiers have already been replaced with tokens like [ACCT], [UPI], [IFSC] etc.).

Your job is to extract structured data and return ONLY a valid JSON object — no markdown, no explanation, just raw JSON.

Return this exact shape:
{
  "openingBalance": <number or null>,
  "closingBalance": <number or null>,
  "transactions": [
    {
      "date": "<date string as it appears>",
      "description": "<cleaned narration>",
      "debitAmount": <number or null>,
      "creditAmount": <number or null>,
      "balance": <number or null>
    }
  ]
}

Rules:
- Amounts must be plain numbers (no commas, no currency symbols)
- If a field is not found, use null
- Skip header rows, totals rows, and non-transaction lines
- description should be a clean readable summary (remove tokens like [ACCT], [UPI] etc.)
- Dates should be kept as-is from the statement`;

async function parseWithClaude(sanitizedText) {
  const message = await client.messages.create({
    model:      'claude-haiku-4-5',
    max_tokens: 4096,
    system:     SYSTEM_PROMPT,
    messages: [
      {
        role:    'user',
        content: `Here is the sanitized bank statement text:\n\n${sanitizedText}`,
      },
    ],
  });

  const raw = message.content[0]?.text?.trim();
  if (!raw) throw new Error('Empty response from Claude');

  // Strip markdown code fences if Claude wraps in ```json ... ```
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Claude returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  return parsed;
}

module.exports = { parseWithClaude };
