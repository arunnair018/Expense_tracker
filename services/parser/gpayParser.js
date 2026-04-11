
async function getPdfjs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}

/* ── helpers ─────────────────────────────────────────────────────────── */

function buildRows(items, yTolerance = 3) {
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

  rows.sort((a, b) => b.y - a.y); // top → bottom

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

/* ── Column detection ────────────────────────────────────────────────── */

const GPAY_HEADER_RE = /date.*transaction|transaction.*date/i;
const DATE_RE        = /^\d{1,2}\s+\w{3},?\s+\d{4}$/;
const TIME_RE        = /^\d{1,2}:\d{2}\s*[AP]M$/i;
const AMOUNT_RE      = /^[₹]?([\d,]+(?:\.\d{1,2})?)$/;
const PAID_TO_RE     = /^paid\s+to\s+(.+)/i;
const RECEIVED_RE    = /^received\s+from\s+(.+)/i;
const UPI_ID_RE      = /UPI\s*Transaction\s*ID\s*:/i;
const PAID_BY_RE     = /^paid\s+by\s+/i;

function parseAmount(str) {
  return parseFloat(str.replace(/[₹,]/g, '').trim());
}

/* ── Main export ─────────────────────────────────────────────────────── */

async function parseGPayPDF(buffer, password) {
  const pdfjs       = await getPdfjs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    password: password || '',
    useSystemFonts: true,
    verbosity: 0,
  });

  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    if (err.name === 'PasswordException') {
      throw err.code === 1
        ? Object.assign(new Error('PASSWORD_REQUIRED'), { code: 'PASSWORD_REQUIRED' })
        : Object.assign(new Error('WRONG_PASSWORD'),    { code: 'WRONG_PASSWORD' });
    }
    throw err;
  }

  const allRows = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page    = await doc.getPage(p);
    const content = await page.getTextContent();
    allRows.push(...buildRows(content.items));
  }

  /* ── Detect column X positions from header row ─── */
  let dateColX   = null;
  let detailColX = null;
  let amountColX = null;

  for (const row of allRows) {
    if (GPAY_HEADER_RE.test(row.text)) {
      for (const cell of row.cells) {
        const t = cell.str.toLowerCase();
        if (t.includes('date'))                              dateColX   = cell.x;
        if (t.includes('transaction') || t.includes('detail')) detailColX = cell.x;
        if (t.includes('amount'))                            amountColX = cell.x;
      }
      break;
    }
  }

  const COL_TOL = 80; // px tolerance for column matching
  const nearDate   = (x) => dateColX   === null || Math.abs(x - dateColX)   < COL_TOL;
  const nearDetail = (x) => detailColX === null || Math.abs(x - detailColX) < COL_TOL;
  const nearAmount = (x) => amountColX === null || Math.abs(x - amountColX) < COL_TOL;

  /* ── State machine to extract transactions ───── */
  const transactions = [];
  let current = null;

  const pushCurrent = () => {
    if (current && current.merchant && current.amount !== null) {
      transactions.push({ ...current });
    }
    current = null;
  };

  for (const row of allRows) {
    // Check if the row starts a new transaction: has a date-like cell in left column
    const dateCell = row.cells.find(c => DATE_RE.test(c.str.trim()) && nearDate(c.x));
    if (dateCell) {
      pushCurrent();
      current = { date: dateCell.str.trim(), time: null, merchant: null, type: 'debit', amount: null };

      // Same row might have detail and amount cells
      for (const cell of row.cells) {
        if (cell === dateCell) continue;
        const v = cell.str.trim();
        const paidTo = v.match(PAID_TO_RE);
        const recvd  = v.match(RECEIVED_RE);
        if (paidTo)                          { current.merchant = paidTo[1].trim();  current.type = 'debit'; }
        else if (recvd)                      { current.merchant = recvd[1].trim();   current.type = 'credit'; }
        else if (AMOUNT_RE.test(v) && nearAmount(cell.x)) {
          const amt = parseAmount(v);
          if (!isNaN(amt) && amt > 0) current.amount = amt;
        }
      }
      continue;
    }

    if (!current) continue;

    // Time row
    const timeCell = row.cells.find(c => TIME_RE.test(c.str.trim()));
    if (timeCell && !current.time) {
      current.time = timeCell.str.trim();
    }

    // Detail cells: merchant name, UPI ID (skip), Paid by (skip)
    for (const cell of row.cells) {
      const v = cell.str.trim();
      if (!v) continue;
      if (UPI_ID_RE.test(v)) continue;
      if (PAID_BY_RE.test(v)) continue;

      const paidTo = v.match(PAID_TO_RE);
      const recvd  = v.match(RECEIVED_RE);
      if (paidTo && !current.merchant)  { current.merchant = paidTo[1].trim(); current.type = 'debit'; }
      else if (recvd && !current.merchant) { current.merchant = recvd[1].trim(); current.type = 'credit'; }
      else if (AMOUNT_RE.test(v) && nearAmount(cell.x)) {
        const amt = parseAmount(v);
        if (!isNaN(amt) && amt > 0 && current.amount === null) current.amount = amt;
      }
    }
  }
  pushCurrent();

  return transactions; // [{ date, time, merchant, type, amount }]
}

module.exports = { parseGPayPDF };
