const fmt    = (n) => Number(n ?? 0).toLocaleString('en-IN');
const fmtPct = (n) => (n > 0 ? n.toFixed(1) + '%' : '0%');

/* ── Donut chart ─────────────────────────────────────────────── */
function DonutChart({ segments, size = 220, thickness = 38 }) {
  const r  = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C  = 2 * Math.PI * r;
  const total = segments.reduce((s, d) => s + d.value, 0);

  if (total === 0) return null;

  const GAP = 2.5; // px gap between slices
  let angle = -90; // start from 12 o'clock

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      {/* Background ring */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        strokeWidth={thickness}
        style={{ stroke: 'var(--bg-hover)' }}
      />

      {segments.map((d, i) => {
        const pct    = d.value / total;
        const arcLen = Math.max(0, pct * C - GAP);
        const startAngle = angle;
        angle += pct * 360;

        if (arcLen <= 0) return null;

        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            strokeWidth={thickness}
            strokeLinecap="butt"
            strokeDasharray={`${arcLen} ${C}`}
            transform={`rotate(${startAngle}, ${cx}, ${cy})`}
            style={{ stroke: d.color }}
          />
        );
      })}
    </svg>
  );
}

/* ── Main analytics view ─────────────────────────────────────── */
export default function Analytics({ totals }) {
  const {
    totalCredits       = 0,
    totalSavings       = 0,
    totalInvestments   = 0,
    totalSubscriptions = 0,
    totalPlannedExpenses = 0,
    totalExpenses      = 0,
    balance            = 0,
  } = totals;

  const totalSpending = totalSavings + totalInvestments + totalSubscriptions + totalPlannedExpenses + totalExpenses;
  const savingsRate   = totalCredits > 0 ? ((totalSavings + totalInvestments) / totalCredits * 100) : 0;

  const spendingSegments = [
    { label: 'Savings',          value: totalSavings,          color: 'var(--clr-savings)'      },
    { label: 'Investments',      value: totalInvestments,      color: '#5da8f0'                  },
    { label: 'Subscriptions',    value: totalSubscriptions,    color: 'var(--clr-subscription)'  },
    { label: 'Planned Expenses', value: totalPlannedExpenses,  color: 'var(--clr-planned)'       },
    { label: 'Expenses',         value: totalExpenses,         color: 'var(--clr-expense)'       },
  ].filter(s => s.value > 0);

  const creditSegments = [
    { label: 'Spent',     value: totalSpending, color: 'var(--clr-expense)' },
    { label: 'Remaining', value: Math.max(0, balance), color: 'var(--clr-credit)' },
  ];

  return (
    <div className="space-y-4">

      {/* ── Income vs Spending overview ─────────────────────── */}
      <div
        className="rounded-2xl px-5 py-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Month at a Glance
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Income',   value: totalCredits,  color: 'var(--clr-credit)'   },
            { label: 'Total Spending', value: totalSpending, color: 'var(--clr-expense)'  },
            { label: 'Net Savings',    value: balance,       color: balance >= 0 ? 'var(--clr-positive)' : 'var(--clr-negative)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <p className="text-sm font-bold tabular-nums" style={{ color }}>{value < 0 ? '-' : ''}₹{fmt(Math.abs(value))}</p>
            </div>
          ))}
        </div>
        {totalCredits > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--divider)' }}>
            <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
              <span>Amount used</span>
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                {fmtPct(totalSpending / totalCredits * 100)} of income
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, totalSpending / totalCredits * 100)}%`,
                  background: totalSpending > totalCredits ? 'var(--clr-negative)' : 'var(--clr-savings)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Spending breakdown chart ────────────────────────── */}
      {totalSpending > 0 && (
        <div
          className="rounded-2xl px-5 py-5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
            Spending Breakdown
          </p>

          {/* Donut + legend side by side on larger screens, stacked on small */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Chart */}
            <div className="relative shrink-0">
              <DonutChart segments={spendingSegments} size={200} thickness={36} />
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Spent</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--clr-expense)' }}>
                  ₹{fmt(totalSpending)}
                </p>
              </div>
            </div>

            {/* Legend / breakdown list */}
            <div className="flex-1 w-full space-y-2.5">
              {spendingSegments.map(seg => {
                const pct = totalSpending > 0 ? (seg.value / totalSpending) * 100 : 0;
                return (
                  <div key={seg.label}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{seg.label}</span>
                      </div>
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtPct(pct)}</span>
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>₹{fmt(seg.value)}</span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: seg.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Income vs Spending donut ────────────────────────── */}
      {totalCredits > 0 && (
        <div
          className="rounded-2xl px-5 py-5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
            Income Usage
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative shrink-0">
              <DonutChart segments={creditSegments} size={160} thickness={28} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Savings rate</p>
                <p className="text-sm font-bold" style={{ color: 'var(--clr-savings)' }}>
                  {fmtPct(savingsRate)}
                </p>
              </div>
            </div>
            <div className="flex-1 w-full space-y-3">
              {creditSegments.map(seg => (
                <div key={seg.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{seg.label}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: seg.color }}>
                    ₹{fmt(seg.value)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid var(--divider)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Total Income</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--clr-credit)' }}>
                  ₹{fmt(totalCredits)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {totalSpending === 0 && totalCredits === 0 && (
        <div className="flex flex-col items-center py-16 gap-3">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} style={{ color: 'var(--text-faint)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>No data for this month yet</p>
        </div>
      )}
    </div>
  );
}
