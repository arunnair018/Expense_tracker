/**
 * Instruments — Define RDs / FDs once.
 * Smart date logic: any two of {start, end, tenure} derives the third.
 * Feeds into Dashboard (monthly savings) and Corpus (maturity events).
 */

import { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import { useAuth } from '@/context/auth'
import { useUI } from '@/context/ui'
import {
  useInstruments,
  addInstrument,
  updateInstrument,
  deleteInstrument,
  formatINR,
  formatINRShort,
  addMonths,
  Instrument,
  EntryCategory,
} from '@/lib/firestore'

const { width: SW } = Dimensions.get('window')
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthsElapsed(startDate: Date): number {
  const now = new Date()
  const diff = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth())
  return Math.max(0, diff)
}

function monthsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()))
}

function formatMonthYear(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

function dateFromPicker(year: number, monthIdx: number): Date {
  return new Date(year, monthIdx, 1)
}

// ─── Reusable month+year picker ───────────────────────────────────────────────

function MonthYearPicker({
  label, monthIdx, year, onMonth, onYear,
}: {
  label: string
  monthIdx: number
  year: number
  onMonth: (i: number) => void
  onYear: (y: number) => void
}) {
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={styles.formLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {MONTHS.map((m, i) => (
          <TouchableOpacity
            key={m}
            onPress={() => onMonth(i)}
            style={[styles.mpPill, i === monthIdx && styles.mpPillActive]}
          >
            <Text style={[styles.mpPillText, i === monthIdx && styles.mpPillTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.yearRow}>
        <TouchableOpacity onPress={() => onYear(year - 1)} style={styles.yearBtn}>
          <Ionicons name="chevron-back" size={16} color="#4a6090" />
        </TouchableOpacity>
        <Text style={styles.yearText}>{year}</Text>
        <TouchableOpacity onPress={() => onYear(year + 1)} style={styles.yearBtn}>
          <Ionicons name="chevron-forward" size={16} color="#4a6090" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={15} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  )
}

const EXPENSE_CAT_META: Record<string, { label: string; color: string }> = {
  expense:      { label: 'Expense',      color: '#D85A30' },
  subscription: { label: 'Subscription', color: '#BA7517' },
}

function InstrumentCard({
  instrument,
  onMarkMatured,
  onDelete,
}: {
  instrument: Instrument
  onMarkMatured: () => void
  onDelete: () => void
}) {
  const isExpense = instrument.kind === 'expense'

  if (isExpense) {
    const cat = instrument.expenseCategory ?? 'expense'
    const meta = EXPENSE_CAT_META[cat] ?? EXPENSE_CAT_META.expense
    return (
      <View style={styles.instrumentCard}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{instrument.name}</Text>
            <Text style={styles.cardSub}>Recurring expense</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: meta.color + '22' }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={16} color="#4a6090" />
          </TouchableOpacity>
        </View>
        <View style={styles.detailGrid}>
          <DetailRow label="Monthly" value={formatINR(instrument.monthlyInstalment)} />
          <DetailRow label="Per year" value={formatINR(instrument.monthlyInstalment * 12)} />
        </View>
        <Text style={styles.autoNote}>
          <Ionicons name="repeat" size={11} color={meta.color} /> Auto-appears in monthly checklist
        </Text>
      </View>
    )
  }

  const elapsed   = monthsElapsed(instrument.startDate)
  const remaining = Math.max(0, instrument.tenureMonths - elapsed)
  const paidSoFar = instrument.monthlyInstalment * Math.min(elapsed, instrument.tenureMonths)
  const progress  = Math.min(1, elapsed / instrument.tenureMonths)
  const isMatured = instrument.status === 'matured'
  const statusColor = isMatured ? '#BA7517' : '#1D9E75'

  return (
    <View style={[styles.instrumentCard, isMatured && { opacity: 0.85 }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{instrument.name}</Text>
          <Text style={styles.cardSub}>{instrument.tenureMonths}-month RD</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {isMatured ? 'Matured' : 'Active'}
          </Text>
        </View>
      </View>

      {/* Detail grid */}
      <View style={styles.detailGrid}>
        <DetailRow label="Monthly"        value={formatINR(instrument.monthlyInstalment)} />
        <DetailRow label="Tenure"         value={`${instrument.tenureMonths} months`} />
        <DetailRow label="Started"        value={formatMonthYear(instrument.startDate)} />
        <DetailRow label="Matures"        value={formatMonthYear(instrument.maturityDate)} />
        <DetailRow label="Paid so far"    value={formatINR(paidSoFar)} />
        <DetailRow label="Remaining"      value={remaining > 0 ? `${remaining} months` : 'Complete'} />
        <DetailRow label="Maturity amt"   value={formatINR(instrument.maturityAmount)} />
        <DetailRow label="Total invested" value={formatINR(instrument.monthlyInstalment * instrument.tenureMonths)} />
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: statusColor }]} />
        </View>
        <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <View style={styles.cardFooterRow}>
          <View style={{ flex: 1, gap: 6 }}>
            {!isMatured && (
              <Text style={styles.autoNote}>
                <Ionicons name="repeat" size={11} color="#378ADD" /> Auto-adds ₹{instrument.monthlyInstalment.toLocaleString('en-IN')} to monthly savings
              </Text>
            )}
            {!isMatured && remaining === 0 && (
              <TouchableOpacity style={styles.matureBtn} onPress={onMarkMatured}>
                <Text style={styles.matureBtnText}>Mark as matured →</Text>
              </TouchableOpacity>
            )}
            {isMatured && (
              <Text style={styles.autoNote}>View in Corpus for goal allocation</Text>
            )}
          </View>
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={16} color="#4a6090" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

// ─── Add Instrument Form ───────────────────────────────────────────────────────

type DateMode = 'start-tenure' | 'start-end' | 'end-tenure'

const DATE_MODES: { key: DateMode; label: string }[] = [
  { key: 'start-tenure', label: 'Start + Tenure' },
  { key: 'start-end',    label: 'Start + End'    },
  { key: 'end-tenure',   label: 'End + Tenure'   },
]

function AddRDForm({ uid, onSaved }: { uid: string; onSaved: () => void }) {
  const { toast } = useUI()
  const now = new Date()

  const [name,        setName]        = useState('')
  const [instalment,  setInstalment]  = useState('')
  const [tenure,      setTenure]      = useState('')
  const [dateMode,    setDateMode]    = useState<DateMode>('start-tenure')
  const [startYear,   setStartYear]   = useState(now.getFullYear())
  const [startMonth,  setStartMonth]  = useState(now.getMonth())
  const [endYear,     setEndYear]     = useState(now.getFullYear())
  const [endMonth,    setEndMonth]    = useState(now.getMonth())
  const [maturityAmt, setMaturityAmt] = useState('')
  const [saving,      setSaving]      = useState(false)

  const startDate    = dateFromPicker(startYear, startMonth)
  const endDate      = dateFromPicker(endYear, endMonth)
  const tenureNum    = parseInt(tenure) || 0
  const instalmentNum = parseFloat(instalment) || 0

  // ── Derivation logic ──
  // start + tenure  → compute end
  const derivedEnd    = dateMode === 'start-tenure' && tenureNum > 0
    ? addMonths(startDate, tenureNum)
    : null

  // end + tenure  → compute start
  const derivedStart  = dateMode === 'end-tenure' && tenureNum > 0
    ? addMonths(endDate, -tenureNum)
    : null

  // start + end  → compute tenure
  const derivedTenure = dateMode === 'start-end'
    ? monthsBetween(startDate, endDate)
    : null

  // Resolved values actually used when saving
  const actualStart  = dateMode === 'end-tenure'   ? (derivedStart  ?? startDate) : startDate
  const actualEnd    = dateMode === 'start-tenure'  ? (derivedEnd    ?? endDate)   : endDate
  const actualTenure = dateMode === 'start-end'     ? (derivedTenure ?? 0)         : tenureNum
  const estimatedMaturity = maturityAmt
    ? parseFloat(maturityAmt)
    : instalmentNum * actualTenure

  function isValid(): boolean {
    if (!name.trim() || instalmentNum <= 0) return false
    if (dateMode === 'start-tenure' && tenureNum <= 0) return false
    if (dateMode === 'end-tenure'   && tenureNum <= 0) return false
    if (dateMode === 'start-end'    && monthsBetween(startDate, endDate) <= 0) return false
    return true
  }

  function validationMessage(): string {
    if (!name.trim()) return 'Please enter a name for this instrument.'
    if (instalmentNum <= 0) return 'Please enter a monthly instalment amount.'
    if (dateMode === 'start-end' && monthsBetween(startDate, endDate) <= 0)
      return 'End month must be after start month.'
    return 'Please fill in the tenure or date fields.'
  }

  async function handleSave() {
    if (!isValid()) {
      toast('error', validationMessage())
      return
    }
    setSaving(true)
    Keyboard.dismiss()
    try {
      await addInstrument(uid, {
        name:              name.trim(),
        bank:              '',           // removed from UI — kept in model for compat
        monthlyInstalment: instalmentNum,
        tenureMonths:      actualTenure,
        startDate:         actualStart,
        maturityDate:      actualEnd,
        maturityAmount:    estimatedMaturity,
        status:            'active',
      })
      // Reset
      setName(''); setInstalment(''); setTenure(''); setMaturityAmt('')
      setStartYear(now.getFullYear()); setStartMonth(now.getMonth())
      setEndYear(now.getFullYear());   setEndMonth(now.getMonth())
      setDateMode('start-tenure')
      onSaved()
    } catch {
      toast('error', 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.addForm}>
        <Text style={styles.addFormTitle}>Add new RD / FD</Text>

        {/* Name */}
        <Text style={styles.formLabel}>NICKNAME / NAME</Text>
        <TextInput
          style={styles.formInput}
          placeholder="e.g. SBI RD, Emergency Fund RD…"
          placeholderTextColor="#3a4d70"
          value={name}
          onChangeText={setName}
        />

        {/* Monthly instalment */}
        <Text style={styles.formLabel}>MONTHLY INSTALMENT (₹)</Text>
        <TextInput
          style={styles.formInput}
          placeholder="e.g. 5000"
          placeholderTextColor="#3a4d70"
          value={instalment}
          onChangeText={setInstalment}
          keyboardType="numeric"
        />

        {/* Date mode selector */}
        <Text style={styles.formLabel}>I KNOW THE…</Text>
        <View style={styles.modeSelector}>
          {DATE_MODES.map(m => (
            <TouchableOpacity
              key={m.key}
              onPress={() => setDateMode(m.key)}
              style={[styles.modePill, dateMode === m.key && styles.modePillActive]}
              activeOpacity={0.75}
            >
              <Text style={[styles.modePillText, dateMode === m.key && styles.modePillTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Inputs based on mode */}
        {(dateMode === 'start-tenure' || dateMode === 'start-end') && (
          <MonthYearPicker
            label="START MONTH"
            monthIdx={startMonth}
            year={startYear}
            onMonth={setStartMonth}
            onYear={setStartYear}
          />
        )}

        {(dateMode === 'start-end' || dateMode === 'end-tenure') && (
          <MonthYearPicker
            label="END / MATURITY MONTH"
            monthIdx={endMonth}
            year={endYear}
            onMonth={setEndMonth}
            onYear={setEndYear}
          />
        )}

        {(dateMode === 'start-tenure' || dateMode === 'end-tenure') && (
          <>
            <Text style={styles.formLabel}>TENURE (MONTHS)</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. 24"
              placeholderTextColor="#3a4d70"
              value={tenure}
              onChangeText={setTenure}
              keyboardType="numeric"
            />
          </>
        )}

        {/* Derived value preview */}
        {dateMode === 'start-tenure' && derivedEnd && (
          <View style={styles.derivedChip}>
            <Ionicons name="calculator-outline" size={13} color="#378ADD" />
            <Text style={styles.derivedText}>
              Matures: <Text style={{ fontWeight: '700' }}>{formatMonthYear(derivedEnd)}</Text>
            </Text>
          </View>
        )}
        {dateMode === 'end-tenure' && derivedStart && (
          <View style={styles.derivedChip}>
            <Ionicons name="calculator-outline" size={13} color="#378ADD" />
            <Text style={styles.derivedText}>
              Started: <Text style={{ fontWeight: '700' }}>{formatMonthYear(derivedStart)}</Text>
            </Text>
          </View>
        )}
        {dateMode === 'start-end' && derivedTenure !== null && (
          <View style={[styles.derivedChip, derivedTenure <= 0 && { borderColor: '#D85A30', backgroundColor: 'rgba(216,90,48,0.08)' }]}>
            <Ionicons
              name="calculator-outline"
              size={13}
              color={derivedTenure > 0 ? '#378ADD' : '#D85A30'}
            />
            <Text style={[styles.derivedText, derivedTenure <= 0 && { color: '#D85A30' }]}>
              {derivedTenure > 0
                ? <>Tenure: <Text style={{ fontWeight: '700' }}>{derivedTenure} months</Text></>
                : 'End month must be after start month'
              }
            </Text>
          </View>
        )}

        {/* Optional maturity amount */}
        <Text style={[styles.formLabel, { marginTop: 8 }]}>MATURITY AMOUNT ₹ (OPTIONAL)</Text>
        <TextInput
          style={styles.formInput}
          placeholder={
            instalmentNum && actualTenure
              ? `Leave blank — estimated ${formatINR(instalmentNum * actualTenure)}`
              : 'Leave blank to auto-estimate'
          }
          placeholderTextColor="#3a4d70"
          value={maturityAmt}
          onChangeText={setMaturityAmt}
          keyboardType="numeric"
        />

        {/* Live preview */}
        {instalmentNum > 0 && actualTenure > 0 && (
          <View style={styles.preview}>
            <Ionicons name="information-circle" size={15} color="#378ADD" />
            <Text style={styles.previewText}>
              Maturity estimate: {formatINR(estimatedMaturity)}
              {actualEnd ? ` · Matures ${formatMonthYear(actualEnd)}` : ''}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, (!isValid() || saving) && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Save Instrument</Text>
          }
        </TouchableOpacity>
    </View>
  )
}

// ─── Add Recurring Expense Form ───────────────────────────────────────────────

const EXPENSE_CATEGORIES: { key: EntryCategory; label: string; color: string }[] = [
  { key: 'expense',      label: 'Expense',      color: '#D85A30' },
  { key: 'subscription', label: 'Subscription', color: '#BA7517' },
]

function AddExpenseForm({ uid, onSaved }: { uid: string; onSaved: () => void }) {
  const { toast } = useUI()
  const [name,     setName]     = useState('')
  const [amount,   setAmount]   = useState('')
  const [category, setCategory] = useState<EntryCategory>('expense')
  const [saving,   setSaving]   = useState(false)

  async function handleSave() {
    if (!name.trim() || !parseFloat(amount)) {
      toast('error', 'Please enter a name and amount.')
      return
    }
    setSaving(true)
    Keyboard.dismiss()
    const sentinel = new Date(2099, 11, 31)
    try {
      await addInstrument(uid, {
        name:              name.trim(),
        bank:              '',
        monthlyInstalment: parseFloat(amount),
        tenureMonths:      0,
        startDate:         new Date(),
        maturityDate:      sentinel,
        maturityAmount:    0,
        status:            'active',
        kind:              'expense',
        expenseCategory:   category,
      })
      setName(''); setAmount(''); setCategory('expense')
      onSaved()
    } catch {
      toast('error', 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.addForm}>
      <Text style={styles.addFormTitle}>Add recurring expense</Text>

      <Text style={styles.formLabel}>NAME</Text>
      <TextInput
        style={styles.formInput}
        placeholder="e.g. Rent, EMI — HDFC, Netflix…"
        placeholderTextColor="#3a4d70"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.formLabel}>MONTHLY AMOUNT (₹)</Text>
      <TextInput
        style={styles.formInput}
        placeholder="e.g. 15000"
        placeholderTextColor="#3a4d70"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />

      <Text style={styles.formLabel}>CATEGORY</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        {EXPENSE_CATEGORIES.map(c => (
          <TouchableOpacity
            key={c.key}
            onPress={() => setCategory(c.key)}
            style={[
              styles.modePill,
              { flex: 1, alignItems: 'center' },
              category === c.key && { backgroundColor: c.color + '22', borderColor: c.color },
            ]}
            activeOpacity={0.75}
          >
            <Text style={[styles.modePillText, category === c.key && { color: c.color }]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, (!name.trim() || !parseFloat(amount) || saving) && { opacity: 0.5 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>Save Expense</Text>
        }
      </TouchableOpacity>
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function InstrumentsScreen() {
  const { user } = useAuth()
  const { confirm } = useUI()
  const insets = useSafeAreaInsets()
  const uid = user?.uid ?? ''

  const { instruments, loading, error } = useInstruments(uid)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formKind, setFormKind] = useState<'rd' | 'expense'>('rd')
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (showAddForm) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)
    }
  }, [showAddForm, formKind])

  const activeInstruments = instruments.filter(i => i.status === 'active')
  const totalMonthly = activeInstruments.reduce((s, i) => s + i.monthlyInstalment, 0)
  const nextMaturity  = activeInstruments.length > 0 ? activeInstruments[0] : null

  function handleDelete(instrument: Instrument) {
    confirm({
      title: 'Delete instrument',
      body: `Delete "${instrument.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => deleteInstrument(uid, instrument.id).catch(() => {}),
    })
  }

  function handleMarkMatured(instrument: Instrument) {
    confirm({
      title: 'Mark as matured',
      body: `Mark "${instrument.name}" as matured? It will stop auto-adding to monthly savings.`,
      confirmLabel: 'Mark matured',
      destructive: true,
      onConfirm: () => updateInstrument(uid, instrument.id, { status: 'matured' }).catch(() => {}),
    })
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Instruments</Text>
        <TouchableOpacity
          onPress={() => setShowAddForm(v => !v)}
          style={styles.headerBtn}
          activeOpacity={0.75}
        >
          <Ionicons name={showAddForm ? 'close' : 'add'} size={22} color="#4f8ef7" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="wifi-outline" size={15} color="#f87171" />
          <Text style={styles.errorBannerText} numberOfLines={2}>{error}</Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Stat cards */}
        <View style={styles.statGrid}>
          <StatCard
            label="Active deposits"
            value={String(activeInstruments.length)}
            color="#1D9E75"
            icon="checkmark-circle"
          />
          <StatCard
            label="Monthly commitment"
            value={formatINRShort(totalMonthly)}
            color="#378ADD"
            icon="arrow-down-circle"
          />
          <View style={[styles.statCard, styles.statCardWide, { borderLeftColor: '#BA7517' }]}>
            <View style={[styles.statIcon, { backgroundColor: '#BA751722' }]}>
              <Ionicons name="calendar" size={15} color="#BA7517" />
            </View>
            <Text style={styles.statValue}>
              {nextMaturity ? formatMonthYear(nextMaturity.maturityDate) : '—'}
            </Text>
            <Text style={styles.statLabel}>Next maturity</Text>
          </View>
        </View>

        {loading && <ActivityIndicator color="#4f8ef7" style={{ marginTop: 32 }} />}

        {instruments.map(inst => (
          <InstrumentCard
            key={inst.id}
            instrument={inst}
            onMarkMatured={() => handleMarkMatured(inst)}
            onDelete={() => handleDelete(inst)}
          />
        ))}

        {!loading && instruments.length === 0 && (
          <Text style={styles.emptyNote}>No instruments yet. Tap + above to add your first RD or FD.</Text>
        )}

        {showAddForm && (
          <View>
            {/* Kind selector */}
            <View style={styles.kindSelector}>
              <TouchableOpacity
                style={[styles.kindPill, formKind === 'rd' && styles.kindPillRdActive]}
                onPress={() => setFormKind('rd')}
                activeOpacity={0.75}
              >
                <Ionicons name="trending-up" size={14} color={formKind === 'rd' ? '#378ADD' : '#3a4d70'} />
                <Text style={[styles.kindPillText, formKind === 'rd' && { color: '#378ADD' }]}>RD / FD</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.kindPill, formKind === 'expense' && styles.kindPillExpActive]}
                onPress={() => setFormKind('expense')}
                activeOpacity={0.75}
              >
                <Ionicons name="repeat" size={14} color={formKind === 'expense' ? '#D85A30' : '#3a4d70'} />
                <Text style={[styles.kindPillText, formKind === 'expense' && { color: '#D85A30' }]}>Recurring Expense</Text>
              </TouchableOpacity>
            </View>
            {formKind === 'rd'
              ? <AddRDForm uid={uid} onSaved={() => setShowAddForm(false)} />
              : <AddExpenseForm uid={uid} onSaved={() => setShowAddForm(false)} />
            }
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080d1c' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 6,
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  errorBannerText: { flex: 1, fontSize: 13, color: '#f87171', fontWeight: '500', lineHeight: 17 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 10, paddingTop: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#f0f4ff', letterSpacing: -0.5 },
  headerBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(79,142,247,0.12)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(79,142,247,0.2)',
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    width: (SW - 42) / 2, backgroundColor: '#111827',
    borderRadius: 16, padding: 14,
    borderLeftWidth: 3, borderWidth: 1, borderColor: 'rgba(99,130,220,0.1)',
  },
  statCardWide: { width: '100%' },
  statIcon: { width: 28, height: 28, borderRadius: 7, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#f0f4ff', marginBottom: 3 },
  statLabel: { fontSize: 11, color: '#4a6090', fontWeight: '600', letterSpacing: 0.5 },

  // Instrument card
  instrumentCard: {
    backgroundColor: '#111827', borderRadius: 18, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: 'rgba(99,130,220,0.12)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  cardName:   { fontSize: 16, fontWeight: '800', color: '#f0f4ff', marginBottom: 2 },
  cardSub:    { fontSize: 12, color: '#4a6090', fontWeight: '500' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:  { fontSize: 12, fontWeight: '700' },

  detailGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    backgroundColor: 'rgba(99,130,220,0.04)',
    borderRadius: 12, padding: 12, marginBottom: 14,
  },
  detailRow:  { width: '50%', paddingVertical: 5 },
  detailLabel: { fontSize: 11, color: '#3a4d70', fontWeight: '600', marginBottom: 2 },
  detailValue: { fontSize: 13, color: '#c8d6f0', fontWeight: '700' },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  progressTrack: {
    flex: 1, height: 5,
    backgroundColor: 'rgba(99,130,220,0.12)',
    borderRadius: 99, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 99 },
  progressPct: { fontSize: 11, fontWeight: '700', color: '#4a6090', width: 32, textAlign: 'right' },

  cardFooter: { gap: 8 },
  cardFooterRow: { flexDirection: 'row', alignItems: 'flex-end' },
  autoNote:   { fontSize: 12, color: '#3a4d70', fontStyle: 'italic' },
  matureBtn:  { alignSelf: 'flex-start' },
  matureBtnText: { fontSize: 13, color: '#BA7517', fontWeight: '700' },
  deleteBtn: { padding: 6, marginLeft: 8 },

  emptyNote: {
    textAlign: 'center', color: '#3a4d70',
    fontSize: 13, marginTop: 32, fontStyle: 'italic',
  },

  // Kind selector (above add form)
  kindSelector: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  kindPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0f1523',
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.15)',
  },
  kindPillRdActive:  { backgroundColor: 'rgba(55,138,221,0.12)', borderColor: '#378ADD' },
  kindPillExpActive: { backgroundColor: 'rgba(216,90,48,0.12)',  borderColor: '#D85A30' },
  kindPillText: { fontSize: 13, fontWeight: '600', color: '#3a4d70' },

  // Add form
  addForm: {
    backgroundColor: '#111827', borderRadius: 18, padding: 18,
    marginTop: 8, borderWidth: 1, borderColor: 'rgba(99,130,220,0.15)',
  },
  addFormTitle: { fontSize: 17, fontWeight: '800', color: '#f0f4ff', marginBottom: 18 },
  formLabel: {
    fontSize: 11, fontWeight: '700', color: '#4a6090',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8,
  },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(99,130,220,0.18)',
    borderRadius: 11, padding: 13, fontSize: 14, color: '#fff', marginBottom: 16,
  },

  // Date mode selector
  modeSelector: { flexDirection: 'row', gap: 8, marginBottom: 18, flexWrap: 'wrap' },
  modePill: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#0f1523',
    borderWidth: 1, borderColor: 'rgba(99,130,220,0.15)',
  },
  modePillActive: { backgroundColor: 'rgba(55,138,221,0.2)', borderColor: '#378ADD' },
  modePillText: { fontSize: 12, fontWeight: '600', color: '#3a4d70' },
  modePillTextActive: { color: '#378ADD' },

  // Month picker
  mpPill: {
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20,
    backgroundColor: '#0f1523',
    borderWidth: 1, borderColor: 'rgba(99,130,220,0.12)', marginRight: 6,
  },
  mpPillActive: { backgroundColor: '#378ADD', borderColor: '#378ADD' },
  mpPillText: { fontSize: 12, fontWeight: '600', color: '#3a4d70' },
  mpPillTextActive: { color: '#fff' },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  yearBtn:  { padding: 4 },
  yearText: { fontSize: 15, fontWeight: '700', color: '#c8d6f0' },

  // Derived value chip
  derivedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(55,138,221,0.1)',
    borderRadius: 10, padding: 10, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(55,138,221,0.2)',
  },
  derivedText: { fontSize: 13, color: '#378ADD', lineHeight: 18 },

  preview: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(55,138,221,0.08)',
    borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(55,138,221,0.18)',
  },
  previewText: { flex: 1, fontSize: 13, color: '#378ADD', fontWeight: '500', lineHeight: 18 },

  saveBtn: {
    backgroundColor: '#2563eb', borderRadius: 13,
    paddingVertical: 15, alignItems: 'center', marginTop: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
