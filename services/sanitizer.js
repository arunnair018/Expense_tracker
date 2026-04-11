/**
 * Strips PII from strings and transaction objects.
 * Applied to parsed output before sending to frontend / storing in DB.
 */

const RULES = [
  // Account numbers — 9 to 18 digit standalone numbers (not amounts like 1234.56)
  { re: /\b\d{9,18}\b/g,                          sub: '[ACCT]'    },

  // UPI IDs — anything@anything (VPA format)
  { re: /\b[\w.\-+]+@[\w.\-]+\b/g,                sub: '[UPI]'     },

  // IFSC codes — 4 letters, 0, 6 alphanumeric
  { re: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,              sub: '[IFSC]'    },

  // Indian mobile numbers — 10 digits starting 6-9, optional +91/91 prefix
  { re: /(?:\+91|91)?[6-9]\d{9}\b/g,              sub: '[MOBILE]'  },

  // Email addresses
  { re: /[\w.\-+]+@[\w.\-]+\.[a-z]{2,}/gi,        sub: '[EMAIL]'   },

  // PAN numbers — 5 letters, 4 digits, 1 letter
  { re: /\b[A-Z]{5}\d{4}[A-Z]\b/g,                sub: '[PAN]'     },

  // Card numbers — 16 digits with optional spaces/dashes
  { re: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, sub: '[CARD]' },
];

// Sanitize a plain string
function sanitize(text) {
  if (!text || typeof text !== 'string') return text;
  let out = text;
  for (const { re, sub } of RULES) {
    // Reset lastIndex for global regexes between calls
    re.lastIndex = 0;
    out = out.replace(re, sub);
  }
  return out;
}

// Sanitize the string fields of a transaction object
function sanitizeTransaction(t) {
  return {
    ...t,
    description: sanitize(t.description),
    raw:         sanitize(t.raw),
  };
}

// Sanitize all transactions in the parsed result
function sanitizeParsed(parsed) {
  return {
    ...parsed,
    rawText:             undefined,          // never expose raw text to client
    credits:             (parsed.credits             ?? []).map(sanitizeTransaction),
    debits:              (parsed.debits              ?? []).map(sanitizeTransaction),
    unknownTransactions: (parsed.unknownTransactions ?? []).map(sanitizeTransaction),
  };
}

module.exports = { sanitize, sanitizeParsed };
