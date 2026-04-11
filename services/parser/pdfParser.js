async function getPdfjs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}

/* ─── helpers ──────────────────────────────────────────────── */

// Strips commas + trailing CR/DR before parseFloat
function parseAmt(str) {
  return parseFloat(str.replace(/,/g, '').replace(/(cr|dr)$/i, '').trim());
}

// Matches: 1,23,456.78  /  26,008.00  /  40.00  /  82,146.65CR
const AMOUNT_RE = /^[\d,]+\.\d{2}(?:cr|dr)?$/i;

// Date at the very start of a string — handles glued or spaced separators
const DATE_RE = /^(\d{2}\s*[\/\-.]\s*\d{2}\s*[\/\-.]\s*\d{2,4}|\d{2}\s+[A-Za-z]{3}\s+\d{2,4}|\d{4}-\d{2}-\d{2})/;

// Placeholder "empty" cells in Indian bank statements
const PLACEHOLDER = /^[-–—Nil]+$/i;

/* ─────────────────────────────────────────────────────────────
   STEP 1 — Position-aware row builder
   Uses item.width to decide whether adjacent fragments should
   be glued (gap < 2 → "01"+"/"+"04" = "01/04") or spaced.
───────────────────────────────────────────────────────────── */
function buildRows(items, yTolerance = 4) {
  const rows = [];

  for (const item of items) {
    if (!item.str?.trim()) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const w = item.width ?? 0;
    const existing = rows.find(r => Math.abs(r.y - y) <= yTolerance);
    if (existing) {
      existing.cells.push({ x, w, str: item.str });
    } else {
      rows.push({ y, cells: [{ x, w, str: item.str }] });
    }
  }

  rows.sort((a, b) => b.y - a.y);

  for (const row of rows) {
    row.cells.sort((a, b) => a.x - b.x);
    let text = '';
    for (let i = 0; i < row.cells.length; i++) {
      const cell = row.cells[i];
      if (i === 0) { text = cell.str; continue; }
      const gap = cell.x - (row.cells[i - 1].x + row.cells[i - 1].w);
      text += (gap < 2 ? '' : ' ') + cell.str;
    }
    row.text = text.replace(/\s{2,}/g, ' ').trim();
  }

  return rows;
}

/* ─────────────────────────────────────────────────────────────
   STEP 2 — Transaction table header detection
   MUST contain "date" to exclude summary/footer rows.
   Threshold lowered to 2 keyword hits (some headers are terse).
───────────────────────────────────────────────────────────── */
const HEADER_KEYWORDS = ['narration', 'description', 'particulars', 'details',
                         'debit', 'credit', 'withdrawal', 'deposit', 'balance',
                         'cheque', 'chq', 'amount'];

function detectHeader(rows) {
  for (let i = 0; i < rows.length; i++) {
    const lc = rows[i].text.toLowerCase();
    if (!lc.includes('date')) continue;            // ← key guard
    if (HEADER_KEYWORDS.filter(k => lc.includes(k)).length < 2) continue;

    const cols = { debitX: null, creditX: null, balanceX: null, dateX: null, descX: null };
    for (const cell of rows[i].cells) {
      // Strip currency symbols before matching
      const t = cell.str.toLowerCase().replace(/[₹$€£]/g, '').trim();
      if (/\bdate\b/.test(t))                           cols.dateX    = cell.x;
      if (/details|narration|description|particulars/.test(t)) cols.descX = cell.x;
      if (/debit|withdrawal|dr\b/.test(t))              cols.debitX   = cell.x;
      if (/credit|deposit|cr\b/.test(t))                cols.creditX  = cell.x;
      if (/balance|bal\b/.test(t))                      cols.balanceX = cell.x;
    }

    console.log('[parser] header >', rows[i].text);
    console.log('[parser] cols   >', JSON.stringify(cols));
    return { headerRowIndex: i, cols };
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────
   STEP 3 — Transaction row parsing

   State-machine approach:
   • When we hit a row that STARTS with a date → new transaction
   • Subsequent rows with NO amounts and NO leading date are
     treated as continuation lines of the current description
   • Each transaction collects up to MAX_CONTINUATION_ROWS
     description lines before we force-stop (handles page breaks)
───────────────────────────────────────────────────────────── */
const COL_TOLERANCE        = 60;
const MAX_CONTINUATION_ROWS = 8;

function cellNear(x, target) {
  return target !== null && Math.abs(x - target) <= COL_TOLERANCE;
}

const NOISE_ROW = /^(page\s*(no\.?|num(ber)?)?[\s.]?\d+|[-–—]+|\s*)$/i;

function detectType(text) {
  const lc = text.toLowerCase();
  if (/dep\s*tfr|upi\/cr\/|upi_cr|credit|credited|deposit/.test(lc)) return 'credit';
  if (/wdl\s*tfr|upi\/dr\/|upi_dr|debit|debited|withdrawal|withdraw/.test(lc)) return 'debit';
  return null;
}

function parseTransactionRows(rows, headerInfo) {
  const startIdx   = headerInfo ? headerInfo.headerRowIndex + 1 : 0;
  const cols       = headerInfo?.cols ?? {};
  const hasColInfo = cols.debitX !== null || cols.creditX !== null;
  const transactions = [];

  let currentTxn   = null;
  let contLines     = 0;

  const pushCurrent = () => {
    if (!currentTxn) return;
    currentTxn.description = currentTxn.description.replace(/\s{2,}/g, ' ').trim();
    // Final type resolution if still unknown
    if (currentTxn.type === 'unknown') {
      if      (currentTxn.debitAmount  && !currentTxn.creditAmount) currentTxn.type = 'debit';
      else if (currentTxn.creditAmount && !currentTxn.debitAmount)  currentTxn.type = 'credit';
    }
    transactions.push(currentTxn);
    currentTxn = null;
    contLines  = 0;
  };

  for (let i = startIdx; i < rows.length; i++) {
    const row  = rows[i];

    // Normalise date separators (handles "01 / 04 / 2026" → "01/04/2026")
    const norm = row.text.replace(/(\d{2})\s*([\/\-.])\s*(\d{2})\s*([\/\-.])\s*(\d{2,4})/,
                                  '$1$2$3$4$5');

    if (DATE_RE.test(norm.trim())) {
      // ── New transaction ────────────────────────────────────
      pushCurrent();

      const dateMatch = norm.trim().match(DATE_RE);
      let debitAmt = null, creditAmt = null, balanceAmt = null;
      const descParts = [];

      for (const cell of row.cells) {
        const v = cell.str.trim();
        if (!v || PLACEHOLDER.test(v)) continue;

        if (AMOUNT_RE.test(v)) {
          const amt = parseAmt(v);
          if (hasColInfo) {
            if      (cellNear(cell.x, cols.debitX))   debitAmt   = debitAmt   ?? amt;
            else if (cellNear(cell.x, cols.creditX))  creditAmt  = creditAmt  ?? amt;
            else if (cellNear(cell.x, cols.balanceX)) balanceAmt = balanceAmt ?? amt;
          } else {
            if      (debitAmt  === null) debitAmt  = amt;
            else if (creditAmt === null) creditAmt = amt;
            else                         balanceAmt = amt;
          }
        } else if (!DATE_RE.test(v)) {
          descParts.push(v);
        }
      }

      if (debitAmt === null && creditAmt === null) continue; // no amounts → skip

      const typeFromDesc = detectType(descParts.join(' ') + ' ' + row.text);
      const type =
        typeFromDesc ||
        (debitAmt && !creditAmt ? 'debit' : creditAmt && !debitAmt ? 'credit' : 'unknown');

      currentTxn = {
        date:         dateMatch[1],
        description:  descParts.join(' '),
        debitAmount:  debitAmt,
        creditAmount: creditAmt,
        balance:      balanceAmt,
        amounts:      [debitAmt ?? creditAmt],
        type,
        raw:          row.text,
      };

    } else if (currentTxn && contLines < MAX_CONTINUATION_ROWS) {
      // ── Continuation line ───────────────────────────────────
      const text = row.text.trim();
      if (text && !NOISE_ROW.test(text)) {
        // Only append if it has no amounts (not a new data row slipping through)
        const hasAmt = row.cells.some(c => AMOUNT_RE.test(c.str.trim()));
        if (!hasAmt) {
          currentTxn.description += ' ' + text;
          contLines++;
        } else {
          pushCurrent(); // unexpected — end current
        }
      }
    } else if (currentTxn && contLines >= MAX_CONTINUATION_ROWS) {
      pushCurrent();
    }
  }

  pushCurrent(); // flush last
  return transactions;
}

/* ─────────────────────────────────────────────────────────────
   STEP 4 — Balance extraction

   Two strategies:
   A) Inline: "Opening Balance  82,146.65"  (same line)
   B) Summary table (e.g. HDFC):
        Header: "Brought Forward (₹) ... Closing Balance (₹)"
        Data:   "82,146.65CR  42  1  79,445.55  26,008.00  28,709.10CR"
      → first amount in data row = opening, last = closing
───────────────────────────────────────────────────────────── */
function extractBalances(allRows, rawText) {
  const inline = (pattern) => {
    const re = new RegExp(
      `(?:${pattern})[\\s:₹Rs.(INR)]*([\\d,]+\\.\\d{2}(?:cr|dr)?)`, 'i');
    const m = rawText.match(re);
    return m ? parseAmt(m[1]) : null;
  };

  const fromSummaryTable = () => {
    for (let i = 0; i < allRows.length - 1; i++) {
      const lc = allRows[i].text.toLowerCase();
      if (!lc.includes('brought forward') && !lc.includes('opening bal')) continue;

      // Scan next 1-2 rows for amounts
      for (let j = i + 1; j <= Math.min(i + 2, allRows.length - 1); j++) {
        const amounts = allRows[j].cells
          .map(c => c.str.trim())
          .filter(v => AMOUNT_RE.test(v))
          .map(v => parseAmt(v));

        if (amounts.length >= 2) {
          return { openingBalance: amounts[0], closingBalance: amounts[amounts.length - 1] };
        }
      }
    }
    return null;
  };

  let openingBalance = inline('opening\\s*balance|op\\.?\\s*bal');
  let closingBalance = inline('closing\\s*balance|cl\\.?\\s*bal');

  if (openingBalance === null || closingBalance === null) {
    const summary = fromSummaryTable();
    if (summary) {
      openingBalance = openingBalance ?? summary.openingBalance;
      closingBalance = closingBalance ?? summary.closingBalance;
    }
  }

  return { openingBalance, closingBalance };
}

/* ─── PDF loader ───────────────────────────────────────────── */
async function loadPDF(buffer, password) {
  const pdfjs       = await getPdfjs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    password: password || '',
    useSystemFonts: true,
    verbosity: 0,
  });
  try {
    return await loadingTask.promise;
  } catch (err) {
    if (err.name === 'PasswordException') {
      throw err.code === 1
        ? Object.assign(new Error('PASSWORD_REQUIRED'), { code: 'PASSWORD_REQUIRED' })
        : Object.assign(new Error('WRONG_PASSWORD'),    { code: 'WRONG_PASSWORD' });
    }
    throw err;
  }
}

/* ─── Main export ──────────────────────────────────────────── */
async function parsePDF(buffer, password) {
  const doc      = await loadPDF(buffer, password);
  const numPages = doc.numPages;
  const allRows  = [];

  for (let p = 1; p <= numPages; p++) {
    const page    = await doc.getPage(p);
    const content = await page.getTextContent();
    allRows.push(...buildRows(content.items));
  }

  const rawText    = allRows.map(r => r.text).join('\n');
  const headerInfo = detectHeader(allRows);
  const txns       = parseTransactionRows(allRows, headerInfo);

  const debugRows = headerInfo
    ? allRows.slice(headerInfo.headerRowIndex, headerInfo.headerRowIndex + 6).map(r => r.text)
    : allRows.slice(0, 6).map(r => r.text);

  const credits = txns.filter(t => t.type === 'credit');
  const debits  = txns.filter(t => t.type === 'debit');
  const sum     = (arr, key) => parseFloat(arr.reduce((s, t) => s + (t[key] ?? 0), 0).toFixed(2));

  const totalCredits = sum(credits, 'creditAmount');
  const totalDebits  = sum(debits,  'debitAmount');

  const { openingBalance, closingBalance } = extractBalances(allRows, rawText);

  let tallyPassed = null, tallyDelta = null;
  if (openingBalance !== null && closingBalance !== null) {
    const expected  = parseFloat((openingBalance + totalCredits - totalDebits).toFixed(2));
    tallyDelta      = parseFloat((closingBalance - expected).toFixed(2));
    tallyPassed     = Math.abs(tallyDelta) < 1;
  }

  return {
    numPages,
    rawText,
    headerDetected: !!headerInfo,
    _debug: { headerCols: headerInfo?.cols ?? null, sampleRows: debugRows },
    openingBalance,
    closingBalance,
    totalCredits,
    totalDebits,
    tallyPassed,
    tallyDelta,
    transactionCount: txns.length,
    credits,
    debits,
    unknownTransactions: txns.filter(t => t.type === 'unknown'),
  };
}

module.exports = { parsePDF };
