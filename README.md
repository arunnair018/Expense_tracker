# 📊 Bank Statement Tally

A MERN stack single-page application that parses your bank statement for any given month, extracts and categorizes transactions using the Claude AI API, and reconciles your credits and debits to verify your financial records are accurate.

> **This is not a traditional expense tracker.** The goal is _reconciliation_ — ensuring your statement totals tally correctly — with AI-assisted categorization as a bonus layer on top.

---

## ✨ Features

- 📁 Upload bank statements (PDF / CSV)
- 📅 Filter and parse transactions by a specific month
- 💰 Extract **opening balance** and **closing balance** automatically
- 🔍 Separate **credits** and **debits** from raw transaction data
- 🔒 Strip all **PII / sensitive information** before any external API call
- 🤖 Send sanitized credit data to **Claude API** for structured categorization
- 🗂️ Get back enriched, categorized transaction data (e.g. Salary, Refund, Transfer)
- ✅ Perform a **tally check** — verify that `Opening Balance + Credits − Debits = Closing Balance`
- 📊 View a clean monthly summary dashboard

---

## 🛠️ Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React.js (SPA)                      |
| Backend    | Node.js + Express.js                |
| Database   | MongoDB + Mongoose                  |
| AI         | Anthropic Claude API                |
| Parsing    | PDF.js / csv-parser (configurable)  |
| Styling    | TailwindCSS / CSS Modules           |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        React SPA                            │
│  ┌──────────────┐   ┌─────────────────┐   ┌─────────────┐  │
│  │ File Upload  │ → │  Month Selector  │ → │  Dashboard  │  │
│  └──────────────┘   └─────────────────┘   └─────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API
┌──────────────────────────▼──────────────────────────────────┐
│                     Express.js API                          │
│                                                             │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────────┐  │
│  │  Statement  │   │  Sanitizer   │   │  Tally Engine   │  │
│  │   Parser    │ → │  (PII Strip) │ → │  (Reconcile)    │  │
│  └─────────────┘   └──────┬───────┘   └─────────────────┘  │
│                           │                                 │
│                    ┌──────▼───────┐                         │
│                    │  Claude API  │                         │
│                    │  (Categorize)│                         │
│                    └──────────────┘                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                       MongoDB                               │
│         Stores parsed & categorized monthly records         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow

```
1. User uploads bank statement (PDF or CSV)
         │
         ▼
2. Parser extracts for the selected month:
   - Opening Balance
   - Closing Balance
   - Raw Credits [ ]
   - Raw Debits  [ ]
         │
         ▼
3. Sanitizer strips PII from credits:
   - Remove account numbers, names, UPI IDs, phone numbers
   - Keep: amount, date, generic description/narration
         │
         ▼
4. Sanitized credits → Claude API
   - Prompt: categorize each transaction
   - Response: structured JSON with category, sub-category, confidence
         │
         ▼
5. Tally Engine reconciles:
   Opening Balance + Total Credits − Total Debits = Closing Balance ✅ / ❌
         │
         ▼
6. Save enriched monthly record to MongoDB
         │
         ▼
7. Render dashboard with:
   - Balance summary
   - Credit categories (pie / bar chart)
   - Debit summary
   - Tally status (pass / mismatch + delta)
```

---

## 📁 Project Structure

```
bank-statement-tally/
├── client/                          # React frontend
│   ├── public/
│   └── src/
│       ├── components/
│       │   ├── Upload/              # File upload + month picker
│       │   ├── Dashboard/           # Monthly summary view
│       │   ├── TallyStatus/         # Reconciliation result card
│       │   └── TransactionTable/    # Credits & debits table
│       ├── pages/
│       │   ├── Home.jsx
│       │   └── MonthView.jsx
│       ├── services/
│       │   └── api.js               # Axios calls to backend
│       └── App.jsx
│
├── server/                          # Express backend
│   ├── config/
│   │   └── db.js                    # MongoDB connection
│   ├── controllers/
│   │   ├── statementController.js   # Upload & parse handler
│   │   └── tallyController.js       # Reconciliation logic
│   ├── middleware/
│   │   └── upload.js                # Multer config
│   ├── models/
│   │   └── MonthlyRecord.js         # Mongoose schema
│   ├── routes/
│   │   ├── statement.js
│   │   └── tally.js
│   ├── services/
│   │   ├── parser/
│   │   │   ├── pdfParser.js         # PDF statement parser
│   │   │   └── csvParser.js         # CSV statement parser
│   │   ├── sanitizer.js             # PII removal logic
│   │   ├── claudeService.js         # Claude API integration
│   │   └── tallyEngine.js           # Balance reconciliation
│   └── index.js
│
├── .env.example
├── .gitignore
└── README.md
```

---

## 🔐 PII Sanitization

Before any data leaves your server toward the Claude API, the sanitizer removes:

| Field              | Action                              |
|--------------------|-------------------------------------|
| Account numbers    | Removed entirely                    |
| UPI / VPA IDs      | Replaced with `[UPI_ID]`            |
| Mobile numbers     | Replaced with `[MOBILE]`            |
| Personal names     | Replaced with `[NAME]`              |
| IFSC codes         | Replaced with `[IFSC]`              |
| Email addresses    | Replaced with `[EMAIL]`             |

Only **amount**, **date**, and a **sanitized narration/description** are sent to Claude.

---

## 🤖 Claude API Categorization

Each sanitized credit transaction is sent to Claude with a prompt like:

```
Given a list of bank credit transactions (amount + description only),
categorize each into one of: Salary, Freelance, Refund, Interest,
Transfer, Cashback, Investment Return, or Other.
Return a JSON array with: { id, category, subCategory, confidence }
```

The response is merged back with the original (local) transaction data.

---

## ✅ Tally Engine

The reconciliation check is simple but powerful:

```
Opening Balance
  + Sum of all Credits
  - Sum of all Debits
─────────────────────
= Expected Closing Balance

If Expected == Actual Closing Balance → ✅ TALLY PASSED
If Expected != Actual Closing Balance → ❌ MISMATCH (delta shown)
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- MongoDB (local or Atlas)
- Anthropic API key

### Installation

```bash
# Clone the repo
git clone https://github.com/your-username/bank-statement-tally.git
cd bank-statement-tally

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/bank-tally
ANTHROPIC_API_KEY=your_claude_api_key_here
```

### Run the App

```bash
# Start backend (from /server)
npm run dev

# Start frontend (from /client)
npm start
```

Visit `http://localhost:3000`

---

## 📦 MongoDB Schema

```js
// MonthlyRecord
{
  month: String,           // e.g. "2024-03"
  openingBalance: Number,
  closingBalance: Number,
  totalCredits: Number,
  totalDebits: Number,
  tallyPassed: Boolean,
  tallyDelta: Number,      // 0 if passed, else the mismatch amount
  credits: [
    {
      date: Date,
      amount: Number,
      rawDescription: String,   // stored locally, never sent to API
      sanitizedDescription: String,
      category: String,         // from Claude
      subCategory: String,      // from Claude
      confidence: Number        // from Claude
    }
  ],
  debits: [
    {
      date: Date,
      amount: Number,
      description: String
    }
  ],
  createdAt: Date
}
```

---

## 🛡️ Privacy & Security Notes

- Raw bank statement files are **not stored** on disk after parsing — they are processed in memory and discarded.
- PII is stripped **server-side** before any API call.
- The Claude API only ever sees amounts, dates, and sanitized descriptions.
- No transaction data is logged in production.

---

## 📌 Roadmap

- [ ] Support for multiple bank formats (SBI, HDFC, ICICI, Axis)
- [ ] Multi-month trend view
- [ ] Debit categorization (via Claude)
- [ ] Export monthly report as PDF
- [ ] Auth layer (JWT) for multi-user support
- [ ] Mobile-responsive UI improvements

---

## 📄 License

MIT License — see [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgements

- [Anthropic Claude](https://www.anthropic.com) for AI categorization
- [PDF.js](https://mozilla.github.io/pdf.js/) for PDF parsing
- [Mongoose](https://mongoosejs.com/) for MongoDB ODM