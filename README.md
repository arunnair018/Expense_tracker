# Finance Tracker App — Full Spec for Claude Code

## Tech Stack
- React Native + Expo (Expo Router file-based navigation)
- Firebase Firestore (database)
- Firebase Auth (authentication)
- Expo Go compatible (avoid bare workflow dependencies where possible)

---

## App Structure — 3 Pages

Navigation: **bottom tab bar** (not top tabs) using `expo-router` tabs.

```
app/
  (tabs)/
    index.tsx          → Dashboard
    pool.tsx           → Pool
    instruments.tsx    → Instruments
  _layout.tsx          → Root layout with tab bar
```

---

## Page 1 — Dashboard

### Purpose
Monthly income/expense tracker. Shows where money went each month.

### Key Concepts
- User selects a month at the top (month switcher, horizontal scroll)
- All data is scoped to the selected month
- Opening balance = previous month's closing balance (auto-calculated, read-only)
- Closing balance = opening balance + credits - savings - investments - expenses - subscriptions
- Closing balance is NOT shown as a credit line item — it silently rolls to next month

### UI Components

**Month switcher** — horizontal scrollable row of month pills (Jan, Feb... Dec). Active month highlighted.

**4 stat cards (2×2 grid on mobile)**
- Total credits (green) — sum of all credit entries this month
- Saved & invested (blue) — sum of savings + investment entries
- Expenses (red) — sum of expense entries + subscriptions
- Month-end balance (green) — auto-calculated

**Sections with entry rows** (each section is a card):
1. Credits — salary, Paru, interest, Groww, etc.
2. Savings — RD instalments (auto-populated from Instruments)
3. Investments — SIP, BHIMA GLD, etc.
4. Expenses — rent, grocery, trips, amazon, etc.
5. Subscriptions — OpenAI, Claude, etc.

Each row: `name` on left, `amount` on right, with a category color dot.

**Floating "+" button** — opens bottom sheet to add a new entry.

### Add Entry — Bottom Sheet
Fields:
- Name (text input)
- Amount (numeric input, ₹)
- Category (picker: Credit / Savings / Investment / Expense / Subscription)
- Type tag (recurring / one-time) — optional

On save: entry added to Firestore under `months/{year-month}/entries/{id}`.

### New Month Setup Flow (4-step modal, triggered when opening a month with no data)

**Step 1 — Start month**
- Show opening balance (auto-calculated from last month, locked/read-only)
- CTA: "Review recurring entries →"

**Step 2 — Recurring entries**
- Pre-populate from previous month's recurring entries + RD instalments from Instruments
- Each row has: checkbox (to include/skip), name, editable amount field
- Sections: Credits, Savings (from Instruments), Investments, Fixed Expenses, Subscriptions
- CTA: "Done, add new entries →"

**Step 3 — Add new entries**
- Simple inline form: name + amount + category + "+" button
- Lists entries added so far
- CTA: "Review & confirm →"

**Step 4 — Confirm**
- Summary stat cards (total credits, saved, expenses, projected balance)
- Confirm list grouped by section
- CTA: "Confirm & open [Month]"
- On confirm: write all entries to Firestore, lock opening balance

---

## Page 2 — Pool

### Purpose
Track RD/FD maturity events and how the lump sum is allocated to goals. **Completely separate from monthly tracker.** Pool money comes from instrument maturities, not from monthly salary.

### Key Concepts
- Each maturity event is independent
- User plans allocation before/when money arrives
- Leftover after allocation → goes to savings or reinvested
- Pool has NO connection to monthly opening/closing balance

### UI Components

**3 stat cards**
- Total matured (lifetime) — sum of all matured instrument amounts
- Allocated so far — sum of all allocations across all maturities
- Unallocated — difference (shown in amber if > 0)

**Maturity event cards** (one per RD/FD that has matured or is upcoming)

Each card has:
- RD name + bank name
- Status badge: `active` (upcoming maturity) / `in progress` (matured, partially allocated) / `done` (fully allocated)
- Maturity amount
- Progress bar: % allocated
- Allocation list — each goal as a row: dot color + name + amount + %
- Unallocated remainder row (amber if pending)
- "View in instruments →" link
- "+ add goal" inline form (name + amount)

**States:**
- Upcoming: show planned allocations, allow editing
- Matured: show actual allocations, track remainder
- Done: read-only, collapsed by default

**Bottom section (2 columns):**
- Upcoming maturities timeline (vertical list with date + amount)
- Monthly RD contributions summary (pulled from Instruments)

### Firestore Structure
```
pool/
  {maturity-event-id}/
    instrumentId: string
    maturedAmount: number
    maturedDate: timestamp
    status: 'upcoming' | 'in-progress' | 'done'
    allocations: [
      { id, goalName, amount, plannedOrActual }
    ]
```

---

## Page 3 — Instruments

### Purpose
Define all RDs/FDs once. This page feeds data into both Dashboard (auto-populates monthly RD instalments as savings entries) and Pool (tracks maturity events).

### UI Components

**3 stat cards**
- Active RDs count
- Total monthly going in (sum of all active RD instalments)
- Next maturity (nearest upcoming date)

**RD cards** (one per instrument, sorted by maturity date)

Each card shows:
- Name + bank/institution
- Status badge: `active` / `matured`
- Detail grid (2×3):
  - Monthly instalment
  - Tenure (months)
  - Maturity date
  - Paid so far (auto-calculated: instalment × months elapsed)
  - Remaining months
  - Maturity amount (entered by user or estimated)
- Progress bar: months paid / total tenure
- "View in pool →" link (if matured or upcoming maturity)
- Footer note: "Auto-populates ₹X in monthly savings"
- Edit button

**Add new RD form** (collapsible at bottom, toggles open)

Fields:
- RD name / nickname (text)
- Bank / institution (text)
- Monthly instalment ₹ (number)
- Tenure in months (number)
- Start date (month picker)
- Maturity amount ₹ (optional — if blank, estimate as instalment × tenure)

**Live preview while filling form:**
- "Estimated maturity: ₹X,XX,XXX · Matures MMM YYYY"
- Updates as user types

On save: writes to Firestore, auto-creates a recurring savings entry template for Dashboard.

### Firestore Structure
```
instruments/
  {instrument-id}/
    name: string
    bank: string
    monthlyInstalment: number
    tenureMonths: number
    startDate: timestamp
    maturityDate: timestamp (calculated)
    maturityAmount: number (user-entered or estimated)
    status: 'active' | 'matured'
    createdAt: timestamp
```

---

## Firebase / Firestore Structure (Complete)

```
users/
  {userId}/
    createdAt: timestamp
    displayName: string

    months/
      {YYYY-MM}/                          ← e.g. "2025-03"
        openingBalance: number            ← locked, copied from prev month closing
        closingBalance: number            ← auto-calculated
        isConfirmed: boolean              ← true after new month setup flow

        entries/
          {entryId}/
            name: string
            amount: number
            category: 'credit' | 'savings' | 'investment' | 'expense' | 'subscription'
            type: 'recurring' | 'one-time'
            isAutoFromInstrument: boolean ← true if pulled from RD
            instrumentId?: string
            createdAt: timestamp

    instruments/
      {instrumentId}/                     ← as above

    pool/
      {poolEventId}/                      ← as above
```

---

## Business Logic

### Closing balance calculation
```
closingBalance = openingBalance + sum(credits) - sum(savings) - sum(investments) - sum(expenses) - sum(subscriptions)
```

### Opening balance rule
- `months/{YYYY-MM}/openingBalance` = `months/{prev-YYYY-MM}/closingBalance`
- For the very first month: user sets opening balance manually
- Once set and month is confirmed, openingBalance is locked (read-only)

### RD auto-population
When a new month is started:
1. Fetch all active instruments where `status === 'active'`
2. For each, create a pre-filled savings entry: `{ name: instrument.name, amount: instrument.monthlyInstalment, category: 'savings', isAutoFromInstrument: true, instrumentId: instrument.id }`
3. Show in Step 2 of new month setup flow (user can edit amount or uncheck to skip)

### Instrument status auto-update
- When current date passes `maturityDate`, set `status = 'matured'`
- Create a pool event: `{ instrumentId, maturedAmount: instrument.maturityAmount, status: 'upcoming', allocations: [] }`
- Stop auto-populating that RD in new month setup

### Amount display
- Stat cards: abbreviate — ₹1,54,343 → ₹1.54L
- Entry rows: full amount with Indian locale formatting — ₹1,54,343
- Use `toLocaleString('en-IN')` for formatting

---

## Mobile UX Patterns

| Pattern | Implementation |
|---|---|
| Add entry | `@gorhom/bottom-sheet` bottom sheet |
| New month setup | Full-screen modal with 4-step stepper |
| Swipe to edit/delete entry | `react-native-gesture-handler` Swipeable |
| Pull to refresh | `RefreshControl` on ScrollView |
| Date picker (RD start) | `@react-native-community/datetimepicker` |
| Navigation | `expo-router` bottom tabs |

---

## Color System

| Meaning | Color |
|---|---|
| Credits / positive | `#1D9E75` (green) |
| Savings / investments | `#378ADD` (blue) |
| Expenses | `#D85A30` (coral/red) |
| Subscriptions / warning | `#BA7517` (amber) |
| Unallocated pool | `#BA7517` (amber) |
| Auto-calculated / locked | `#185FA5` (blue, with lock icon) |
| Background (cards) | `#FFFFFF` |
| Background (surface) | `#F5F5F5` |
| Border | `rgba(0,0,0,0.1)` |

---

## Key Constraints for Claude Code

1. Pool and monthly tracker are **fully independent** — no shared balance, no carry-forward between them
2. Opening balance is **locked after month is confirmed** — never editable after that
3. RD instalments **auto-appear** in new month setup as savings entries — user confirms or skips
4. Maturity amount is **optional on instrument creation** — default to `instalment × tenure` if blank
5. Bottom tab navigation with 3 tabs: Dashboard, Pool, Instruments
6. Use **Indian number formatting** throughout (`en-IN` locale, lakh notation in stat cards)
7. Expo Go compatible — avoid bare native modules where possible; use `expo-reanimated` + `expo-gesture-handler` for bottom sheet (requires development build, acceptable)