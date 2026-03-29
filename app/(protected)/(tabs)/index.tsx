/**
 * Dashboard — Monthly income/expense tracker
 *
 * - Month switcher (horizontal scroll of pills)
 * - 4 stat cards (2×2 grid)
 * - Entry sections: Credits, Savings, Investments, Expenses, Subscriptions
 * - FAB → bottom sheet to add an entry
 * - New month setup modal (4-step) when opening an empty month
 */

import {
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  RefreshControl,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Keyboard,
} from 'react-native'
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'

import { useAuth } from '@/context/auth'
import { useUI } from '@/context/ui'
import {
  useMonthData,
  useMonthEntries,
  useInstruments,
  addEntry,
  deleteEntry,
  updateClosingBalance,
  confirmMonth,
  getMonthData,
  currentYearMonth,
  prevYearMonth,
  formatINR,
  formatINRShort,
  formatBalance,
  formatBalanceShort,
  Entry,
  EntryCategory,
  EntryType,
  Instrument,
} from '@/lib/firestore'

const { width: SW } = Dimensions.get('window')

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const THIS_YEAR = new Date().getFullYear()   // module-level — never changes

const CATEGORY_META: Record<EntryCategory, { label: string; color: string }> = {
  credit:       { label: 'Credits',       color: '#1D9E75' },
  savings:      { label: 'Savings',       color: '#378ADD' },
  investment:   { label: 'Investments',   color: '#378ADD' },
  expense:      { label: 'Expenses',      color: '#D85A30' },
  subscription: { label: 'Subscriptions', color: '#BA7517' },
}

const SECTION_ORDER: EntryCategory[] = ['credit','savings','investment','expense','subscription']

function makeYearMonth(monthIdx: number, year: number) {
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, color, icon,
}: { label: string; value: string; color: string; icon: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function EntryRow({
  entry, onDelete,
}: { entry: Entry; onDelete: () => void }) {
  const color = CATEGORY_META[entry.category].color
  return (
    <View style={styles.entryRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.entryName} numberOfLines={1}>{entry.name}</Text>
      {entry.type === 'recurring' && (
        <Ionicons name="repeat" size={11} color="#4a6090" style={{ marginRight: 4 }} />
      )}
      <Text style={[styles.entryAmount, { color }]}>{formatINR(entry.amount)}</Text>
      <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
        <Ionicons name="close-circle" size={16} color="#3a4d70" />
      </TouchableOpacity>
    </View>
  )
}

function SectionCard({
  category, entries, onDelete,
}: { category: EntryCategory; entries: Entry[]; onDelete: (id: string) => void }) {
  const { label, color } = CATEGORY_META[category]
  const total = entries.reduce((s, e) => s + e.amount, 0)
  if (entries.length === 0) return null
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: color }]} />
        <Text style={styles.sectionTitle}>{label}</Text>
        <Text style={[styles.sectionTotal, { color }]}>{formatINR(total)}</Text>
      </View>
      {entries.map(e => (
        <EntryRow key={e.id} entry={e} onDelete={() => onDelete(e.id)} />
      ))}
    </View>
  )
}

// ─── RD Instalment Checklist ──────────────────────────────────────────────────

const INSTRUMENT_COLOR: Record<string, string> = {
  rd:      '#378ADD',
  expense: '#D85A30',
  subscription: '#BA7517',
}

function getInstrumentColor(inst: Instrument): string {
  if (inst.kind === 'expense') {
    return INSTRUMENT_COLOR[inst.expenseCategory ?? 'expense'] ?? '#D85A30'
  }
  return INSTRUMENT_COLOR.rd
}

function RDChecklistSection({
  activeRDs,
  entries,
  onToggle,
  toggling,
}: {
  activeRDs: Instrument[]
  entries: Entry[]
  onToggle: (instrument: Instrument, existingEntry?: Entry) => void
  toggling: Set<string>
}) {
  if (activeRDs.length === 0) return null

  const paidCount = activeRDs.filter(inst =>
    entries.some(e => e.isAutoFromInstrument && e.instrumentId === inst.id)
  ).length

  return (
    <View style={styles.rdSection}>
      <View style={styles.rdSectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: '#4f8ef7' }]} />
        <Text style={styles.rdSectionTitle}>Recurring Items</Text>
        <Text style={styles.rdSectionSub}>{paidCount}/{activeRDs.length} done this month</Text>
      </View>
      {activeRDs.map(inst => {
        const existing = entries.find(e => e.isAutoFromInstrument && e.instrumentId === inst.id)
        const isPaid = !!existing
        const isToggling = toggling.has(inst.id)
        const color = getInstrumentColor(inst)
        return (
          <TouchableOpacity
            key={inst.id}
            style={styles.rdRow}
            onPress={() => onToggle(inst, existing)}
            disabled={isToggling}
            activeOpacity={0.7}
          >
            {isToggling
              ? <ActivityIndicator size="small" color={color} style={{ width: 24 }} />
              : <Ionicons
                  name={isPaid ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={isPaid ? color : '#3a4d70'}
                />
            }
            <Text style={[styles.rdItemName, isPaid && styles.rdItemNamePaid]}>
              {inst.name}
            </Text>
            <Text style={[styles.rdItemAmount, isPaid && { color }]}>
              {formatINR(inst.monthlyInstalment)}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ─── New Month Setup Modal (4-step) ──────────────────────────────────────────

interface SetupModalProps {
  visible: boolean
  yearMonth: string
  userId: string
  instruments: Instrument[]
  prevClosingBalance: number
  onDone: () => void
  onDismiss: () => void
}

interface PendingEntry {
  key: string
  name: string
  amount: string
  category: EntryCategory
  type: EntryType
  isAutoFromInstrument: boolean
  instrumentId?: string
  include: boolean
}

function SetupModal({ visible, yearMonth, userId, instruments, prevClosingBalance, onDone, onDismiss }: SetupModalProps) {
  const { toast } = useUI()
  const [step, setStep] = useState(1)
  // Editable opening balance (pre-filled from previous month's closing)
  const [openingBalanceStr, setOpeningBalanceStr] = useState('')
  const openingBalance = parseFloat(openingBalanceStr.replace(/,/g, '')) || 0

  const [recurring, setRecurring] = useState<PendingEntry[]>([])
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newCategory, setNewCategory] = useState<EntryCategory>('expense')
  const [extras, setExtras] = useState<PendingEntry[]>([])
  const [saving, setSaving] = useState(false)

  const [Y, M] = yearMonth.split('-').map(Number)
  const monthLabel = `${MONTHS[M - 1]} ${Y}`

  // Sync editable opening balance when modal opens or prevClosingBalance resolves
  useEffect(() => {
    if (!visible) {
      setStep(1)
      setExtras([])
      return
    }
    setOpeningBalanceStr(prevClosingBalance > 0 ? String(prevClosingBalance) : '')
  }, [visible, prevClosingBalance])

  useEffect(() => {
    if (!visible) return
    // Pre-populate recurring: active RDs as savings
    const rdEntries: PendingEntry[] = instruments
      .filter(i => i.status === 'active')
      .map(i => ({
        key: `rd-${i.id}`,
        name: i.name,
        amount: String(i.monthlyInstalment),
        category: 'savings' as EntryCategory,
        type: 'recurring' as EntryType,
        isAutoFromInstrument: true,
        instrumentId: i.id,
        include: true,
      }))
    setRecurring(rdEntries)
  }, [visible, instruments])

  function addExtra() {
    if (!newName.trim() || !newAmount.trim()) return
    setExtras(prev => [...prev, {
      key: Date.now().toString(),
      name: newName.trim(),
      amount: newAmount.trim(),
      category: newCategory,
      type: 'one-time',
      isAutoFromInstrument: false,
      include: true,
    }])
    setNewName('')
    setNewAmount('')
  }

  async function handleConfirm() {
    setSaving(true)
    try {
      const allEntries = [
        ...recurring.filter(e => e.include).map(e => ({
          name: e.name,
          amount: Number(e.amount) || 0,
          category: e.category,
          type: e.type,
          isAutoFromInstrument: e.isAutoFromInstrument,
          instrumentId: e.instrumentId,
        })),
        ...extras.map(e => ({
          name: e.name,
          amount: Number(e.amount) || 0,
          category: e.category,
          type: e.type,
          isAutoFromInstrument: false,
        })),
      ]
      await confirmMonth(userId, yearMonth, openingBalance, allEntries)
      onDone()
    } catch (err) {
      toast('error', 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const allIncluded = [...recurring.filter(e => e.include), ...extras]
  const totalCredits = allIncluded.filter(e => e.category === 'credit').reduce((s,e) => s + (Number(e.amount)||0), 0)
  const totalSaved = allIncluded.filter(e => e.category === 'savings' || e.category === 'investment').reduce((s,e) => s + (Number(e.amount)||0), 0)
  const totalExp = allIncluded.filter(e => e.category === 'expense' || e.category === 'subscription').reduce((s,e) => s + (Number(e.amount)||0), 0)
  const projectedBalance = openingBalance + totalCredits - totalSaved - totalExp

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalRoot} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1 }}>
          {/* Step indicator + dismiss */}
          <View style={styles.stepRow}>
            <View style={styles.stepDots}>
              {[1,2,3,4].map(s => (
                <View key={s} style={[styles.stepDot, s === step && styles.stepDotActive, s < step && styles.stepDotDone]} />
              ))}
            </View>
            <TouchableOpacity onPress={onDismiss} style={styles.modalCloseBtn} activeOpacity={0.6}>
              <Ionicons name="close" size={20} color="#4a6090" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">

            {/* ── Step 1: Opening balance ── */}
            {step === 1 && (
              <View>
                <Text style={styles.modalTitle}>Start {monthLabel}</Text>
                <Text style={styles.modalSub}>Set your opening balance for this month</Text>

                <Text style={styles.formLabel}>OPENING BALANCE (₹)</Text>
                <TextInput
                  style={styles.balanceInput}
                  value={openingBalanceStr}
                  onChangeText={(v) => {
                    // Allow digits, one leading minus, one decimal point — nothing else
                    const cleaned = v
                      .replace(/[^0-9.\-]/g, '')          // strip non-numeric chars
                      .replace(/(?!^)-/g, '')              // minus only at start
                      .replace(/(\..*)\./g, '$1')          // only one decimal point
                    setOpeningBalanceStr(cleaned)
                  }}
                  keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                  placeholder="e.g. 25000 or -5000"
                  placeholderTextColor="#3a4d70"
                  autoFocus
                />
                <View style={styles.debtHintRow}>
                  <Ionicons name="information-circle-outline" size={14} color="#4a6090" />
                  <Text style={styles.debtHintText}>
                    Use a negative value (e.g. -5000) if you're starting with a debt or overdraft.
                  </Text>
                </View>
                <Text style={styles.modalHint}>
                  {prevClosingBalance !== 0
                    ? `Pre-filled from last month's closing (${formatBalance(prevClosingBalance)}). Edit if needed.`
                    : 'Enter your current bank/savings balance to start tracking this month.'}
                </Text>
              </View>
            )}

            {/* ── Step 2: Recurring entries ── */}
            {step === 2 && (
              <View>
                <Text style={styles.modalTitle}>Recurring entries</Text>
                <Text style={styles.modalSub}>Review and adjust your monthly regulars</Text>
                {recurring.length === 0 && (
                  <Text style={styles.emptyNote}>No recurring entries yet. Add instruments to auto-populate RD savings.</Text>
                )}
                {recurring.map((e, i) => (
                  <View key={e.key} style={styles.recurringRow}>
                    <TouchableOpacity
                      onPress={() => {
                        const updated = [...recurring]
                        updated[i] = { ...e, include: !e.include }
                        setRecurring(updated)
                      }}
                    >
                      <Ionicons
                        name={e.include ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={e.include ? '#378ADD' : '#3a4d70'}
                      />
                    </TouchableOpacity>
                    <View style={[styles.recurringDot, { backgroundColor: CATEGORY_META[e.category].color }]} />
                    <Text style={[styles.recurringName, !e.include && { opacity: 0.4 }]}>{e.name}</Text>
                    <TextInput
                      style={[styles.recurringAmount, !e.include && { opacity: 0.4 }]}
                      value={e.amount}
                      onChangeText={v => {
                        const updated = [...recurring]
                        updated[i] = { ...e, amount: v }
                        setRecurring(updated)
                      }}
                      keyboardType="numeric"
                      editable={e.include}
                    />
                  </View>
                ))}
              </View>
            )}

            {/* ── Step 3: Add new entries ── */}
            {step === 3 && (
              <View>
                <Text style={styles.modalTitle}>New entries</Text>
                <Text style={styles.modalSub}>Add anything extra for {monthLabel}</Text>

                {/* Inline add form */}
                <View style={styles.inlineForm}>
                  <TextInput
                    style={[styles.inlineInput, { flex: 2 }]}
                    placeholder="Name"
                    placeholderTextColor="#3a4d70"
                    value={newName}
                    onChangeText={setNewName}
                  />
                  <TextInput
                    style={[styles.inlineInput, { flex: 1 }]}
                    placeholder="₹"
                    placeholderTextColor="#3a4d70"
                    value={newAmount}
                    onChangeText={setNewAmount}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity style={styles.inlineAddBtn} onPress={addExtra}>
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* Category picker */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {(Object.keys(CATEGORY_META) as EntryCategory[]).map(cat => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setNewCategory(cat)}
                      style={[
                        styles.catPill,
                        newCategory === cat && { backgroundColor: CATEGORY_META[cat].color + '33', borderColor: CATEGORY_META[cat].color },
                      ]}
                    >
                      <Text style={[styles.catPillText, newCategory === cat && { color: CATEGORY_META[cat].color }]}>
                        {CATEGORY_META[cat].label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {extras.map(e => (
                  <View key={e.key} style={styles.extraRow}>
                    <View style={[styles.recurringDot, { backgroundColor: CATEGORY_META[e.category].color }]} />
                    <Text style={styles.recurringName}>{e.name}</Text>
                    <Text style={[styles.recurringAmountText, { color: CATEGORY_META[e.category].color }]}>
                      {formatINR(Number(e.amount) || 0)}
                    </Text>
                    <TouchableOpacity onPress={() => setExtras(prev => prev.filter(x => x.key !== e.key))}>
                      <Ionicons name="close-circle" size={18} color="#3a4d70" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* ── Step 4: Confirm ── */}
            {step === 4 && (
              <View>
                <Text style={styles.modalTitle}>Confirm {monthLabel}</Text>
                <View style={styles.summaryCards}>
                  <View style={[styles.summaryCard, { borderColor: '#1D9E75' }]}>
                    <Text style={styles.summaryCardLabel}>Credits</Text>
                    <Text style={[styles.summaryCardVal, { color: '#1D9E75' }]}>{formatINRShort(totalCredits)}</Text>
                  </View>
                  <View style={[styles.summaryCard, { borderColor: '#378ADD' }]}>
                    <Text style={styles.summaryCardLabel}>Saved</Text>
                    <Text style={[styles.summaryCardVal, { color: '#378ADD' }]}>{formatINRShort(totalSaved)}</Text>
                  </View>
                  <View style={[styles.summaryCard, { borderColor: '#D85A30' }]}>
                    <Text style={styles.summaryCardLabel}>Expenses</Text>
                    <Text style={[styles.summaryCardVal, { color: '#D85A30' }]}>{formatINRShort(totalExp)}</Text>
                  </View>
                  <View style={[styles.summaryCard, { borderColor: projectedBalance >= 0 ? '#1D9E75' : '#D85A30' }]}>
                    <Text style={styles.summaryCardLabel}>Projected closing</Text>
                    <Text style={[styles.summaryCardVal, { color: projectedBalance >= 0 ? '#1D9E75' : '#D85A30' }]}>
                      {formatBalanceShort(projectedBalance)}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.modalSub, { marginTop: 16 }]}>All entries</Text>
                {[...recurring.filter(e => e.include), ...extras].map((e, i) => (
                  <View key={i} style={styles.confirmRow}>
                    <View style={[styles.dot, { backgroundColor: CATEGORY_META[e.category].color }]} />
                    <Text style={styles.confirmName}>{e.name}</Text>
                    <Text style={[styles.confirmAmount, { color: CATEGORY_META[e.category].color }]}>
                      {formatINR(Number(e.amount) || 0)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

          </ScrollView>

          {/* Bottom buttons */}
          <View style={styles.modalFooter}>
            {step > 1 && (
              <TouchableOpacity style={styles.modalBackBtn} onPress={() => setStep(s => s - 1)}>
                <Text style={styles.modalBackBtnText}>← Back</Text>
              </TouchableOpacity>
            )}
            {step < 4 ? (
              <TouchableOpacity style={styles.modalNextBtn} onPress={() => setStep(s => s + 1)}>
                <Text style={styles.modalNextBtnText}>
                  {step === 1 ? 'Review recurring →' : step === 2 ? 'Add new entries →' : 'Review & confirm →'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.modalNextBtn} onPress={handleConfirm} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.modalNextBtnText}>Confirm & open {monthLabel}</Text>
                }
              </TouchableOpacity>
            )}
          </View>
          </View>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { user } = useAuth()
  const { toast, confirm } = useUI()
  const insets = useSafeAreaInsets()
  const uid = user?.uid ?? ''

  // Month + year state
  const currentMIdx = new Date().getMonth()  // 0-indexed
  const [selectedMIdx, setSelectedMIdx] = useState(currentMIdx)
  const [selectedYear, setSelectedYear] = useState(THIS_YEAR)
  const yearMonth = makeYearMonth(selectedMIdx, selectedYear)

  function changeYear(delta: number) {
    const next = selectedYear + delta
    if (next < 2020 || next > THIS_YEAR) return   // guard: 2020 → current year
    setSelectedYear(next)
    setShowSetup(false)   // close any open setup modal when jumping year
  }

  // Firestore data
  const { data: monthData, loading: monthLoading, error: monthError } = useMonthData(uid, yearMonth)
  const { entries, loading: entriesLoading, error: entriesError } = useMonthEntries(uid, yearMonth)
  const { instruments, error: instrumentsError } = useInstruments(uid)

  // Bottom sheet
  const sheetRef = useRef<BottomSheet>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Add-entry form state
  const [addName, setAddName] = useState('')
  const [addAmount, setAddAmount] = useState('')
  const [addCategory, setAddCategory] = useState<EntryCategory>('expense')
  const [addLoading, setAddLoading] = useState(false)

  // New month setup modal
  const [showSetup, setShowSetup] = useState(false)
  const [prevBalance, setPrevBalance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  // Months the user has chosen to set up later — never auto-trigger again in this session
  const [dismissedMonths, setDismissedMonths] = useState<Set<string>>(new Set())

  function dismissSetup() {
    setDismissedMonths(prev => new Set([...prev, yearMonth]))
    setShowSetup(false)
  }

  // Consolidated Firestore error (any hook failing)
  const firestoreError = monthError || entriesError || instrumentsError || null

  // When month data loads and month is empty/unconfirmed, prompt setup
  useEffect(() => {
    if (monthLoading || entriesLoading || !uid) return
    if (firestoreError) return                         // don't open setup while offline
    if (dismissedMonths.has(yearMonth)) return         // user said "do it later" — respect that
    if (!monthData || !monthData.isConfirmed) {
      const pym = prevYearMonth(yearMonth)
      getMonthData(uid, pym)
        .then(prev => {
          setPrevBalance(prev?.closingBalance ?? 0)
          setSetupError(null)
          setShowSetup(true)
        })
        .catch(err => {
          // If offline, skip setup and show error banner instead
          const msg = err?.code === 'unavailable' || err?.message?.includes('offline')
            ? 'You appear to be offline. Connect to the internet to set up this month.'
            : (err?.message ?? 'Could not load previous month data.')
          setSetupError(msg)
        })
    }
  }, [monthLoading, entriesLoading, monthData, uid, firestoreError])

  // Group entries by category
  const byCategory = useMemo(() => {
    const map: Record<EntryCategory, Entry[]> = {
      credit: [], savings: [], investment: [], expense: [], subscription: [],
    }
    for (const e of entries) map[e.category].push(e)
    return map
  }, [entries])

  // Computed totals
  const totalCredits = byCategory.credit.reduce((s, e) => s + e.amount, 0)
  const totalSaved = [...byCategory.savings, ...byCategory.investment].reduce((s, e) => s + e.amount, 0)
  const totalExpenses = [...byCategory.expense, ...byCategory.subscription].reduce((s, e) => s + e.amount, 0)
  const opening = monthData?.openingBalance ?? 0
  const closingBalance = opening + totalCredits - totalSaved - totalExpenses

  // Keep Firestore closing balance in sync
  useEffect(() => {
    if (!uid || !monthData?.isConfirmed) return
    updateClosingBalance(uid, yearMonth, closingBalance).catch(() => {})
  }, [closingBalance, monthData?.isConfirmed])

  async function handleAddEntry() {
    if (!addName.trim() || !addAmount.trim()) return
    setAddLoading(true)
    Keyboard.dismiss()
    try {
      await addEntry(uid, yearMonth, {
        name: addName.trim(),
        amount: Number(addAmount),
        category: addCategory,
        type: 'one-time',
        isAutoFromInstrument: false,
      })
      setAddName('')
      setAddAmount('')
      sheetRef.current?.close()
      setSheetOpen(false)
    } catch {
      toast('error', 'Failed to save entry.')
    } finally {
      setAddLoading(false)
    }
  }

  function handleDelete(entryId: string) {
    confirm({
      title: 'Delete entry',
      body: 'Remove this entry? This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => deleteEntry(uid, yearMonth, entryId).catch(() => {}),
    })
  }

  // RD instalment toggle
  const [toggling, setToggling] = useState<Set<string>>(new Set())

  async function toggleRDInstalment(instrument: Instrument, existingEntry?: Entry) {
    if (toggling.has(instrument.id)) return
    setToggling(prev => new Set([...prev, instrument.id]))
    try {
      if (existingEntry) {
        await deleteEntry(uid, yearMonth, existingEntry.id)
      } else {
        await addEntry(uid, yearMonth, {
          name: instrument.name,
          amount: instrument.monthlyInstalment,
          category: instrument.kind === 'expense'
            ? (instrument.expenseCategory ?? 'expense')
            : 'savings',
          type: 'recurring',
          isAutoFromInstrument: true,
          instrumentId: instrument.id,
        })
      }
    } catch {
      toast('error', 'Failed to update instalment.')
    } finally {
      setToggling(prev => {
        const next = new Set(prev)
        next.delete(instrument.id)
        return next
      })
    }
  }

  const activeRDs = instruments.filter(i => i.status === 'active')

  function openAddSheet() {
    setSheetOpen(true)
    sheetRef.current?.expand()
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 800)
  }, [])

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.6}
      />
    ),
    []
  )

  const loading = monthLoading || entriesLoading
  const displayError = firestoreError || setupError

  // The tab bar already consumes insets.bottom — screens must NOT add it again.
  // Only add top inset (status bar / notch area) at the screen root.
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <View style={styles.yearNav}>
          <TouchableOpacity
            onPress={() => changeYear(-1)}
            style={[styles.yearArrow, selectedYear <= 2020 && styles.yearArrowDisabled]}
            activeOpacity={0.6}
            disabled={selectedYear <= 2020}
          >
            <Ionicons name="chevron-back" size={16} color={selectedYear <= 2020 ? '#2a3a5c' : '#4f8ef7'} />
          </TouchableOpacity>

          <Text style={styles.headerYear}>{selectedYear}</Text>

          <TouchableOpacity
            onPress={() => changeYear(1)}
            style={[styles.yearArrow, selectedYear >= THIS_YEAR && styles.yearArrowDisabled]}
            activeOpacity={0.6}
            disabled={selectedYear >= THIS_YEAR}
          >
            <Ionicons name="chevron-forward" size={16} color={selectedYear >= THIS_YEAR ? '#2a3a5c' : '#4f8ef7'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Month switcher */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.monthScrollContent}
        style={styles.monthScroll}
      >
        {MONTHS.map((m, i) => (
          <TouchableOpacity
            key={m}
            onPress={() => setSelectedMIdx(i)}
            style={[styles.monthPill, i === selectedMIdx && styles.monthPillActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.monthPillText, i === selectedMIdx && styles.monthPillTextActive]}>
              {m}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Error banner ── */}
      {displayError && (
        <View style={styles.errorBanner}>
          <Ionicons name="wifi-outline" size={16} color="#f87171" />
          <Text style={styles.errorBannerText} numberOfLines={2}>{displayError}</Text>
          <TouchableOpacity onPress={() => { setSetupError(null) }}>
            <Ionicons name="close" size={16} color="#f87171" />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color="#4f8ef7" />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 88 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f8ef7" />}
        >
          {/* Opening balance row */}
          {monthData?.isConfirmed && (
            <View style={styles.openingRow}>
              <Ionicons name="lock-closed" size={13} color="#185FA5" />
              <Text style={styles.openingLabel}>Opening balance</Text>
              <Text style={[styles.openingValue, opening < 0 && { color: '#D85A30' }]}>
                {formatBalance(opening)}
              </Text>
            </View>
          )}

          {/* 4 Stat cards — 2×2 grid */}
          <View style={styles.statGrid}>
            <StatCard
              label="Total Credits"
              value={formatINRShort(totalCredits)}
              color="#1D9E75"
              icon="arrow-down-circle"
            />
            <StatCard
              label="Saved & Invested"
              value={formatINRShort(totalSaved)}
              color="#378ADD"
              icon="shield-checkmark"
            />
            <StatCard
              label="Expenses"
              value={formatINRShort(totalExpenses)}
              color="#D85A30"
              icon="arrow-up-circle"
            />
            <StatCard
              label="Month-end Balance"
              value={formatBalanceShort(closingBalance)}
              color={closingBalance >= 0 ? '#1D9E75' : '#D85A30'}
              icon="wallet"
            />
          </View>

          {/* RD instalment checklist */}
          <RDChecklistSection
            activeRDs={activeRDs}
            entries={entries}
            onToggle={toggleRDInstalment}
            toggling={toggling}
          />

          {/* Entry sections */}
          {SECTION_ORDER.map(cat => (
            <SectionCard
              key={cat}
              category={cat}
              entries={byCategory[cat]}
              onDelete={handleDelete}
            />
          ))}

          {entries.length === 0 && monthData?.isConfirmed && (
            <Text style={styles.emptyNote}>No entries yet. Tap + to add one.</Text>
          )}
        </ScrollView>
      )}

      {/* FAB */}
      {!sheetOpen && (
        <TouchableOpacity style={styles.fab} onPress={openAddSheet} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* ── Add Entry Bottom Sheet ── */}
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={['60%', '90%']}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
        onClose={() => setSheetOpen(false)}
        keyboardBehavior="interactive"
        keyboardBlursBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.sheetTitle}>Add Entry</Text>
          <Text style={styles.sheetLabel}>NAME</Text>
          <TextInput
            style={styles.sheetInput}
            placeholder="e.g. Groceries, Salary…"
            placeholderTextColor="#3a4d70"
            value={addName}
            onChangeText={setAddName}
          />

          <Text style={styles.sheetLabel}>AMOUNT (₹)</Text>
          <TextInput
            style={styles.sheetInput}
            placeholder="0"
            placeholderTextColor="#3a4d70"
            value={addAmount}
            onChangeText={setAddAmount}
            keyboardType="numeric"
          />

          <Text style={styles.sheetLabel}>CATEGORY</Text>
          <View style={styles.catGrid}>
            {(Object.keys(CATEGORY_META) as EntryCategory[]).map(cat => (
              <TouchableOpacity
                key={cat}
                onPress={() => setAddCategory(cat)}
                style={[
                  styles.catPill,
                  addCategory === cat && { backgroundColor: CATEGORY_META[cat].color + '33', borderColor: CATEGORY_META[cat].color },
                ]}
              >
                <Text style={[styles.catPillText, addCategory === cat && { color: CATEGORY_META[cat].color }]}>
                  {CATEGORY_META[cat].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.sheetSaveBtn, addLoading && { opacity: 0.6 }]}
            onPress={handleAddEntry}
            disabled={addLoading}
          >
            {addLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.sheetSaveBtnText}>Save Entry</Text>
            }
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheet>

      {/* ── New Month Setup Modal ── */}
      <SetupModal
        visible={showSetup}
        yearMonth={yearMonth}
        userId={uid}
        instruments={instruments}
        prevClosingBalance={prevBalance}
        onDone={() => setShowSetup(false)}
        onDismiss={dismissSetup}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080d1c' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
    paddingTop: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#f0f4ff', letterSpacing: -0.5 },
  yearNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(79,142,247,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(79,142,247,0.18)',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  yearArrow: {
    padding: 6,
    borderRadius: 16,
  },
  yearArrowDisabled: {
    opacity: 0.35,
  },
  headerYear: { fontSize: 14, color: '#c8d6f0', fontWeight: '700', paddingHorizontal: 4 },

  // Month switcher
  monthScroll: { maxHeight: 40, marginBottom: 6 },
  monthScrollContent: { paddingHorizontal: 16, gap: 6, alignItems: 'center' },
  monthPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.12)',
  },
  monthPillActive: { backgroundColor: '#4f8ef7', borderColor: '#4f8ef7' },
  monthPillText: { fontSize: 12, fontWeight: '600', color: '#3a4d70' },
  monthPillTextActive: { color: '#fff' },

  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#3a4d70', fontWeight: '500' },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  errorBannerText: { flex: 1, fontSize: 13, color: '#f87171', fontWeight: '500', lineHeight: 17 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  openingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#0f1e35',
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(24,95,165,0.3)',
  },
  openingLabel: { flex: 1, fontSize: 12, color: '#4a6090', fontWeight: '500' },
  openingValue: { fontSize: 14, color: '#185FA5', fontWeight: '700' },

  // Stat grid
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    width: (SW - 42) / 2,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.1)',
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#f0f4ff', letterSpacing: -0.5, marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#4a6090', fontWeight: '600', letterSpacing: 0.5 },

  // Section cards
  sectionCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.1)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: '#c8d6f0' },
  sectionTotal: { fontSize: 14, fontWeight: '800' },

  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(99,130,220,0.06)',
    gap: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  entryName: { flex: 1, fontSize: 13, color: '#c8d6f0', fontWeight: '500' },
  entryAmount: { fontSize: 13, fontWeight: '700' },
  deleteBtn: { padding: 2, marginLeft: 4 },

  emptyNote: {
    textAlign: 'center',
    color: '#3a4d70',
    fontSize: 13,
    marginTop: 32,
    fontStyle: 'italic',
  },

  // FAB — sits inside the content area (above tab bar), no need for inset offset
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  // Bottom sheet
  sheetBg: { backgroundColor: '#0f1523' },
  sheetHandle: { backgroundColor: '#2a3a5c', width: 36 },
  sheetContent: { padding: 20, paddingBottom: 60 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#f0f4ff', marginBottom: 20, letterSpacing: -0.5 },
  sheetLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4a6090',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sheetInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.2)',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#fff',
    marginBottom: 18,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.15)',
  },
  catPillText: { fontSize: 13, fontWeight: '600', color: '#4a6090' },
  sheetSaveBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  sheetSaveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Debt hint row (below opening balance input)
  debtHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 8,
  },
  debtHintText: {
    flex: 1,
    fontSize: 12,
    color: '#4a6090',
    lineHeight: 17,
  },

  // Balance input (Step 1 of setup modal)
  balanceInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(79,142,247,0.35)',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 28,
    fontWeight: '800',
    color: '#f0f4ff',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4a6090',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Setup modal
  modalRoot: { flex: 1, backgroundColor: '#080d1c' },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  stepDots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 16,
    top: 10,
    padding: 8,
  },
  stepDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#1e2d4a',
  },
  stepDotActive: { backgroundColor: '#4f8ef7', width: 24 },
  stepDotDone: { backgroundColor: '#1D9E75' },
  modalScroll: { padding: 24, paddingBottom: 40 },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f0f4ff',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  modalSub: { fontSize: 14, color: '#4a6090', marginBottom: 24 },
  modalHint: { fontSize: 13, color: '#3a4d70', fontStyle: 'italic', marginTop: 8 },
  balanceDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0f1e35',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(24,95,165,0.35)',
  },
  balanceDisplayText: { fontSize: 24, fontWeight: '800', color: '#185FA5' },

  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99,130,220,0.07)',
  },
  recurringDot: { width: 8, height: 8, borderRadius: 4 },
  recurringName: { flex: 1, fontSize: 14, color: '#c8d6f0', fontWeight: '500' },
  recurringAmount: {
    width: 80,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.15)',
    borderRadius: 8,
    padding: 6,
    fontSize: 14,
    color: '#f0f4ff',
    textAlign: 'right',
  },
  recurringAmountText: { fontSize: 14, fontWeight: '700' },
  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99,130,220,0.07)',
  },

  inlineForm: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  inlineInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.2)',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: '#fff',
  },
  inlineAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },

  summaryCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: {
    width: (SW - 68) / 2,
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
  },
  summaryCardLabel: { fontSize: 11, color: '#4a6090', fontWeight: '600', marginBottom: 6 },
  summaryCardVal: { fontSize: 18, fontWeight: '800' },

  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99,130,220,0.06)',
  },
  confirmName: { flex: 1, fontSize: 14, color: '#c8d6f0' },
  confirmAmount: { fontSize: 14, fontWeight: '700' },

  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(99,130,220,0.1)',
  },
  modalBackBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.15)',
  },
  modalBackBtnText: { color: '#4a6090', fontWeight: '600' },
  modalNextBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  modalNextBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // RD instalment checklist
  rdSection: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(55,138,221,0.18)',
  },
  rdSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  rdSectionTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: '#c8d6f0' },
  rdSectionSub: { fontSize: 11, color: '#4a6090', fontWeight: '600' },
  rdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(99,130,220,0.06)',
    gap: 10,
  },
  rdItemName: { flex: 1, fontSize: 13, color: '#c8d6f0', fontWeight: '500' },
  rdItemNamePaid: { color: '#4a6090', textDecorationLine: 'line-through' },
  rdItemAmount: { fontSize: 13, fontWeight: '700', color: '#4a6090' },
})
