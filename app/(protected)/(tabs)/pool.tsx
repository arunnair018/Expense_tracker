/**
 * Corpus — Track RD/FD maturity events and goal allocations.
 * Completely independent from monthly Dashboard tracker.
 */

import { useState } from 'react'
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
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import { useAuth } from '@/context/auth'
import { useUI } from '@/context/ui'
import {
  usePool,
  useInstruments,
  addAllocation,
  updatePoolEvent,
  formatINR,
  formatINRShort,
  PoolEvent,
  Allocation,
  Instrument,
} from '@/lib/firestore'

const { width: SW } = Dimensions.get('window')
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatMonthYear(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
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

function StatusBadge({ status }: { status: PoolEvent['status'] }) {
  const config = {
    'upcoming':    { label: 'Upcoming',    color: '#378ADD' },
    'in-progress': { label: 'In Progress', color: '#BA7517' },
    'done':        { label: 'Done',        color: '#1D9E75' },
  }[status]
  return (
    <View style={[styles.badge, { backgroundColor: config.color + '22' }]}>
      <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  )
}

// ─── Allocation form (inline per card) ───────────────────────────────────────

function AllocationForm({ uid, poolId, onSaved }: { uid: string; poolId: string; onSaved: () => void }) {
  const { toast } = useUI()
  const [goalName, setGoalName] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!goalName.trim() || !amount.trim()) return
    setSaving(true)
    try {
      const alloc: Allocation = {
        id: Date.now().toString(),
        goalName: goalName.trim(),
        amount: parseFloat(amount) || 0,
        plannedOrActual: 'planned',
      }
      await addAllocation(uid, poolId, alloc)
      setGoalName('')
      setAmount('')
      onSaved()
    } catch {
      toast('error', 'Failed to save allocation.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.allocForm}>
      <TextInput
        style={[styles.allocInput, { flex: 2 }]}
        placeholder="Goal name"
        placeholderTextColor="#3a4d70"
        value={goalName}
        onChangeText={setGoalName}
      />
      <TextInput
        style={[styles.allocInput, { flex: 1 }]}
        placeholder="₹"
        placeholderTextColor="#3a4d70"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />
      <TouchableOpacity style={styles.allocAddBtn} onPress={handleAdd} disabled={saving}>
        {saving
          ? <ActivityIndicator size="small" color="#fff" />
          : <Ionicons name="add" size={18} color="#fff" />
        }
      </TouchableOpacity>
    </View>
  )
}

// ─── Pool Event Card ──────────────────────────────────────────────────────────

const GOAL_COLORS = ['#1D9E75','#378ADD','#D85A30','#BA7517','#818cf8','#ec4899','#4f8ef7']

function PoolCard({ event, uid, instrument }: { event: PoolEvent; uid: string; instrument?: Instrument }) {
  const { confirm } = useUI()
  const [showForm, setShowForm] = useState(false)
  const [collapsed, setCollapsed] = useState(event.status === 'done')

  const totalAllocated = event.allocations.reduce((s, a) => s + a.amount, 0)
  const unallocated = event.maturedAmount - totalAllocated
  const progress = event.maturedAmount > 0 ? Math.min(1, totalAllocated / event.maturedAmount) : 0
  const isDone = event.status === 'done'

  function markDone() {
    if (unallocated > 0) {
      confirm({
        title: 'Unallocated funds',
        body: `You still have ${formatINR(unallocated)} unallocated. Mark as done anyway?`,
        confirmLabel: 'Mark done',
        onConfirm: () => updatePoolEvent(uid, event.id, { status: 'done' }),
      })
    } else {
      updatePoolEvent(uid, event.id, { status: 'done' })
    }
  }

  return (
    <View style={styles.poolCard}>
      {/* Card header */}
      <TouchableOpacity style={styles.poolCardHeader} onPress={() => setCollapsed(c => !c)} activeOpacity={0.8}>
        <View style={{ flex: 1 }}>
          <Text style={styles.poolCardName}>{instrument?.name ?? `Instrument #${event.instrumentId.slice(-4)}`}</Text>
          <Text style={styles.poolCardBank}>{instrument?.bank ?? ''}</Text>
        </View>
        <StatusBadge status={event.status} />
        <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={18} color="#3a4d70" style={{ marginLeft: 8 }} />
      </TouchableOpacity>

      {/* Maturity amount */}
      <View style={styles.maturityRow}>
        <Text style={styles.maturityLabel}>Maturity amount</Text>
        <Text style={styles.maturityValue}>{formatINR(event.maturedAmount)}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressPct}>{Math.round(progress * 100)}% allocated</Text>
      </View>

      {!collapsed && (
        <>
          {/* Allocation list */}
          {event.allocations.map((alloc, i) => {
            const pct = event.maturedAmount > 0 ? ((alloc.amount / event.maturedAmount) * 100).toFixed(1) : '0'
            return (
              <View key={alloc.id} style={styles.allocRow}>
                <View style={[styles.allocDot, { backgroundColor: GOAL_COLORS[i % GOAL_COLORS.length] }]} />
                <Text style={styles.allocName}>{alloc.goalName}</Text>
                <Text style={styles.allocPct}>{pct}%</Text>
                <Text style={styles.allocAmount}>{formatINR(alloc.amount)}</Text>
              </View>
            )
          })}

          {/* Unallocated remainder */}
          {unallocated > 0 && (
            <View style={[styles.allocRow, styles.unallocRow]}>
              <View style={[styles.allocDot, { backgroundColor: '#BA7517' }]} />
              <Text style={[styles.allocName, { color: '#BA7517' }]}>Unallocated</Text>
              <Text style={[styles.allocAmount, { color: '#BA7517' }]}>{formatINR(unallocated)}</Text>
            </View>
          )}

          {/* Add goal form */}
          {!isDone && (
            <>
              {showForm
                ? <AllocationForm uid={uid} poolId={event.id} onSaved={() => setShowForm(false)} />
                : (
                  <TouchableOpacity style={styles.addGoalBtn} onPress={() => setShowForm(true)}>
                    <Ionicons name="add-circle-outline" size={16} color="#4f8ef7" />
                    <Text style={styles.addGoalBtnText}>+ add goal</Text>
                  </TouchableOpacity>
                )
              }

              {!isDone && (
                <TouchableOpacity style={styles.doneBtn} onPress={markDone}>
                  <Text style={styles.doneBtnText}>Mark as done →</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </>
      )}

      {/* Link */}
      {instrument && (
        <Text style={styles.viewLink}>↗ {instrument.name} in Instruments</Text>
      )}
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CorpusScreen() {
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const uid = user?.uid ?? ''

  const { events, loading: poolLoading, error: poolError } = usePool(uid)
  const { instruments, error: instrumentsError } = useInstruments(uid)
  const poolDisplayError = poolError || instrumentsError

  const totalMatured = events.reduce((s, e) => s + e.maturedAmount, 0)
  const totalAllocated = events.reduce(
    (s, e) => s + e.allocations.reduce((a, al) => a + al.amount, 0), 0
  )
  const totalUnallocated = totalMatured - totalAllocated

  const activeInstruments = instruments.filter(i => i.status === 'active')
  const totalMonthly = activeInstruments.reduce((s, i) => s + i.monthlyInstalment, 0)

  // Split events by status
  const active = events.filter(e => e.status !== 'done')
  const done = events.filter(e => e.status === 'done')

  function instrumentFor(event: PoolEvent): Instrument | undefined {
    return instruments.find(i => i.id === event.instrumentId)
  }

  // Tab bar consumes insets.bottom — only apply top inset here
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Corpus</Text>
        <Text style={styles.headerSub}>Track where your matured funds go</Text>
      </View>

      {/* Error banner */}
      {poolDisplayError && (
        <View style={styles.errorBanner}>
          <Ionicons name="wifi-outline" size={15} color="#f87171" />
          <Text style={styles.errorBannerText} numberOfLines={2}>{poolDisplayError}</Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Stat cards */}
        <View style={styles.statGrid}>
          <StatCard
            label="Total Matured"
            value={formatINRShort(totalMatured)}
            color="#1D9E75"
            icon="checkmark-done-circle"
          />
          <StatCard
            label="Allocated"
            value={formatINRShort(totalAllocated)}
            color="#378ADD"
            icon="pie-chart"
          />
          <View style={[
            styles.statCard,
            styles.statCardWide,
            { borderLeftColor: totalUnallocated > 0 ? '#BA7517' : '#1D9E75' },
          ]}>
            <View style={[styles.statIcon, { backgroundColor: totalUnallocated > 0 ? '#BA751722' : '#1D9E7522' }]}>
              <Ionicons
                name={totalUnallocated > 0 ? 'warning' : 'checkmark-circle'}
                size={15}
                color={totalUnallocated > 0 ? '#BA7517' : '#1D9E75'}
              />
            </View>
            <Text style={styles.statValue}>{formatINRShort(totalUnallocated)}</Text>
            <Text style={styles.statLabel}>
              Unallocated{totalUnallocated > 0 ? ' — needs attention' : ' — all clear'}
            </Text>
          </View>
        </View>

        {poolLoading && <ActivityIndicator color="#4f8ef7" style={{ marginTop: 32 }} />}

        {/* Active / In-progress events */}
        {active.length > 0 && (
          <>
            <Text style={styles.groupLabel}>Active & In Progress</Text>
            {active.map(e => (
              <PoolCard key={e.id} event={e} uid={uid} instrument={instrumentFor(e)} />
            ))}
          </>
        )}

        {/* Done events (collapsed by default) */}
        {done.length > 0 && (
          <>
            <Text style={styles.groupLabel}>Completed</Text>
            {done.map(e => (
              <PoolCard key={e.id} event={e} uid={uid} instrument={instrumentFor(e)} />
            ))}
          </>
        )}

        {!poolLoading && events.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={48} color="#1e2d4a" />
            <Text style={styles.emptyTitle}>No corpus events yet</Text>
            <Text style={styles.emptyNote}>
              Corpus events are created when an instrument matures. Mark an instrument as matured from the Instruments tab to get started.
            </Text>
          </View>
        )}

        {/* Bottom section: Monthly contributions + upcoming */}
        <View style={styles.bottomSection}>
          {/* Monthly RD contributions */}
          <View style={styles.bottomCard}>
            <Text style={styles.bottomCardTitle}>Monthly RD contributions</Text>
            {activeInstruments.length === 0 && (
              <Text style={styles.emptyNote}>No active RDs.</Text>
            )}
            {activeInstruments.map(i => (
              <View key={i.id} style={styles.rdRow}>
                <View style={styles.rdDot} />
                <Text style={styles.rdName}>{i.name}</Text>
                <Text style={styles.rdAmount}>{formatINR(i.monthlyInstalment)}/mo</Text>
              </View>
            ))}
            {activeInstruments.length > 0 && (
              <View style={styles.rdTotalRow}>
                <Text style={styles.rdTotalLabel}>Total monthly</Text>
                <Text style={styles.rdTotalValue}>{formatINR(totalMonthly)}</Text>
              </View>
            )}
          </View>

          {/* Upcoming maturities */}
          <View style={styles.bottomCard}>
            <Text style={styles.bottomCardTitle}>Upcoming maturities</Text>
            {activeInstruments.length === 0 && (
              <Text style={styles.emptyNote}>No upcoming maturities.</Text>
            )}
            {activeInstruments.map(i => (
              <View key={i.id} style={styles.upcomingRow}>
                <View>
                  <Text style={styles.upcomingDate}>{formatMonthYear(i.maturityDate)}</Text>
                  <Text style={styles.upcomingName}>{i.name}</Text>
                </View>
                <Text style={styles.upcomingAmount}>{formatINRShort(i.maturityAmount)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080d1c' },

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

  header: { paddingHorizontal: 20, paddingBottom: 10, paddingTop: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#f0f4ff', letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: '#3a4d70', fontWeight: '500', marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    width: (SW - 42) / 2,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.1)',
  },
  statCardWide: { width: '100%' },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: '#f0f4ff', marginBottom: 3 },
  statLabel: { fontSize: 11, color: '#4a6090', fontWeight: '600', letterSpacing: 0.3 },

  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3a4d70',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },

  // Pool card
  poolCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.12)',
  },
  poolCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  poolCardName: { fontSize: 15, fontWeight: '800', color: '#f0f4ff', marginBottom: 2 },
  poolCardBank: { fontSize: 12, color: '#4a6090' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  maturityRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  maturityLabel: { fontSize: 12, color: '#4a6090', fontWeight: '600' },
  maturityValue: { fontSize: 16, fontWeight: '800', color: '#f0f4ff' },

  progressRow: { gap: 6, marginBottom: 14 },
  progressTrack: {
    height: 5,
    backgroundColor: 'rgba(99,130,220,0.12)',
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#378ADD', borderRadius: 99 },
  progressPct: { fontSize: 11, color: '#4a6090', fontWeight: '600' },

  allocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(99,130,220,0.06)',
  },
  unallocRow: { backgroundColor: 'rgba(186,117,23,0.07)', borderRadius: 8, paddingHorizontal: 8 },
  allocDot: { width: 8, height: 8, borderRadius: 4 },
  allocName: { flex: 1, fontSize: 13, color: '#c8d6f0', fontWeight: '500' },
  allocPct: { fontSize: 12, color: '#4a6090', fontWeight: '600', width: 40, textAlign: 'right' },
  allocAmount: { fontSize: 13, fontWeight: '700', color: '#c8d6f0' },

  allocForm: { flexDirection: 'row', gap: 8, marginTop: 12 },
  allocInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.18)',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: '#fff',
  },
  allocAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },

  addGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  addGoalBtnText: { fontSize: 14, color: '#4f8ef7', fontWeight: '600' },

  doneBtn: { marginTop: 12, alignSelf: 'flex-end' },
  doneBtnText: { fontSize: 13, color: '#1D9E75', fontWeight: '700' },

  viewLink: { fontSize: 12, color: '#3a4d70', marginTop: 12, fontStyle: 'italic' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#2a3a5c' },
  emptyNote: { fontSize: 13, color: '#3a4d70', textAlign: 'center', lineHeight: 20 },

  // Bottom section
  bottomSection: { gap: 14, marginTop: 8 },
  bottomCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.1)',
  },
  bottomCardTitle: { fontSize: 14, fontWeight: '800', color: '#c8d6f0', marginBottom: 14 },

  rdRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  rdDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#378ADD' },
  rdName: { flex: 1, fontSize: 13, color: '#c8d6f0', fontWeight: '500' },
  rdAmount: { fontSize: 13, fontWeight: '700', color: '#378ADD' },
  rdTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(99,130,220,0.1)',
  },
  rdTotalLabel: { fontSize: 12, color: '#4a6090', fontWeight: '600' },
  rdTotalValue: { fontSize: 14, fontWeight: '800', color: '#f0f4ff' },

  upcomingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99,130,220,0.07)',
  },
  upcomingDate: { fontSize: 13, fontWeight: '700', color: '#c8d6f0', marginBottom: 2 },
  upcomingName: { fontSize: 11, color: '#4a6090', fontWeight: '500' },
  upcomingAmount: { fontSize: 14, fontWeight: '800', color: '#BA7517' },
})
