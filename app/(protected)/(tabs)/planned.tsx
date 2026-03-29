/**
 * Planned — Upcoming expected expenses with balance impact preview.
 * Fully isolated from the monthly dashboard.
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
  Keyboard,
  Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import { useAuth } from '@/context/auth'
import { useUI } from '@/context/ui'
import {
  usePlannedItems,
  useMonthData,
  useMonthEntries,
  addPlannedItem,
  deletePlannedItem,
  markPlannedMoved,
  addEntry,
  currentYearMonth,
  formatINR,
  formatBalance,
  PlannedItem,
  EntryCategory,
} from '@/lib/firestore'

const { width: SW } = Dimensions.get('window')

const CATEGORY_META: Record<EntryCategory, { label: string; color: string }> = {
  credit:       { label: 'Credit',       color: '#1D9E75' },
  savings:      { label: 'Savings',      color: '#378ADD' },
  investment:   { label: 'Investment',   color: '#378ADD' },
  expense:      { label: 'Expense',      color: '#D85A30' },
  subscription: { label: 'Subscription', color: '#BA7517' },
}

const PLAN_CATEGORIES: EntryCategory[] = ['expense', 'subscription', 'savings', 'investment']

// ─── Planned item card ─────────────────────────────────────────────────────────

function PlannedItemCard({
  item,
  onMove,
  onDelete,
  isDone = false,
}: {
  item: PlannedItem
  onMove: (actualAmount: number) => void
  onDelete: () => void
  isDone?: boolean
}) {
  const { toast } = useUI()
  const [confirming, setConfirming] = useState(false)
  const [actualAmt, setActualAmt] = useState(String(item.estimatedAmount))
  const meta = CATEGORY_META[item.category]

  return (
    <View style={[styles.itemCard, isDone && styles.itemCardDone]}>
      <View style={styles.itemRow}>
        <View style={[styles.itemDot, { backgroundColor: isDone ? '#3a4d70' : meta.color }]} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.itemName, isDone && styles.itemNameDone]}>{item.name}</Text>
          <View style={[styles.catBadge, { backgroundColor: meta.color + '22' }]}>
            <Text style={[styles.catBadgeText, { color: isDone ? '#4a6090' : meta.color }]}>
              {meta.label}
            </Text>
          </View>
        </View>
        <Text style={[styles.itemAmount, isDone && { color: '#4a6090' }]}>
          {formatINR(item.estimatedAmount)}
        </Text>
      </View>

      {!isDone && !confirming && (
        <View style={styles.itemActions}>
          <TouchableOpacity
            style={styles.moveBtn}
            onPress={() => setConfirming(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="checkmark-circle-outline" size={15} color="#1D9E75" />
            <Text style={styles.moveBtnText}>Mark done</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.75}>
            <Ionicons name="trash-outline" size={16} color="#D85A30" />
          </TouchableOpacity>
        </View>
      )}

      {!isDone && confirming && (
        <View style={styles.confirmArea}>
          <Text style={styles.confirmLabel}>Actual amount spent (₹)</Text>
          <View style={styles.confirmRow}>
            <TextInput
              style={styles.confirmInput}
              value={actualAmt}
              onChangeText={setActualAmt}
              keyboardType="numeric"
              autoFocus
              selectTextOnFocus
            />
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => {
                const amt = parseFloat(actualAmt)
                if (!amt || amt <= 0) {
                  toast('error', 'Enter a valid amount.')
                  return
                }
                Keyboard.dismiss()
                onMove(amt)
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmBtnText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setConfirming(false)
                setActualAmt(String(item.estimatedAmount))
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={16} color="#4a6090" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isDone && (
        <View style={styles.itemActions}>
          <View style={styles.doneBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#1D9E75" />
            <Text style={styles.doneBadgeText}>Moved to expense</Text>
          </View>
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.75}>
            <Ionicons name="trash-outline" size={15} color="#4a6090" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function PlannedScreen() {
  const { user } = useAuth()
  const { toast, confirm } = useUI()
  const insets = useSafeAreaInsets()
  const uid = user?.uid ?? ''
  const yearMonth = currentYearMonth()

  const { items, loading } = usePlannedItems(uid)
  const { data: monthData } = useMonthData(uid, yearMonth)
  const { entries } = useMonthEntries(uid, yearMonth)

  const [showAdd, setShowAdd]     = useState(false)
  const [showDone, setShowDone]   = useState(false)
  const [newName, setNewName]     = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newCategory, setNewCategory] = useState<EntryCategory>('expense')
  const [addLoading, setAddLoading]   = useState(false)

  // Current month closing balance
  const totalCredits  = entries.filter(e => e.category === 'credit').reduce((s, e) => s + e.amount, 0)
  const totalSaved    = entries.filter(e => e.category === 'savings' || e.category === 'investment').reduce((s, e) => s + e.amount, 0)
  const totalExpenses = entries.filter(e => e.category === 'expense' || e.category === 'subscription').reduce((s, e) => s + e.amount, 0)
  const opening        = monthData?.openingBalance ?? 0
  const currentBalance = opening + totalCredits - totalSaved - totalExpenses

  const plannedItems = items.filter(i => i.status === 'planned')
  const doneItems    = items.filter(i => i.status === 'moved')
  const totalPlanned = plannedItems.reduce((s, i) => s + i.estimatedAmount, 0)
  const balanceAfter = currentBalance - totalPlanned

  async function handleAdd() {
    if (!newName.trim() || !parseFloat(newAmount)) return
    Keyboard.dismiss()
    setAddLoading(true)
    try {
      await addPlannedItem(uid, {
        name: newName.trim(),
        estimatedAmount: parseFloat(newAmount),
        category: newCategory,
      })
      setNewName(''); setNewAmount(''); setNewCategory('expense')
      setShowAdd(false)
    } catch {
      toast('error', 'Failed to save. Please try again.')
    } finally {
      setAddLoading(false)
    }
  }

  async function handleMove(item: PlannedItem, actualAmount: number) {
    try {
      await addEntry(uid, yearMonth, {
        name: item.name,
        amount: actualAmount,
        category: item.category,
        type: 'one-time',
        isAutoFromInstrument: false,
      })
      await markPlannedMoved(uid, item.id)
    } catch {
      toast('error', 'Failed to move to expense. Please try again.')
    }
  }

  function handleDelete(item: PlannedItem) {
    confirm({
      title: 'Remove item',
      body: `Remove "${item.name}" from your plan?`,
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: () => deletePlannedItem(uid, item.id).catch(() => {}),
    })
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Planned</Text>
          <Text style={styles.headerSub}>Upcoming expected expenses</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowAdd(v => !v)}
          style={styles.headerBtn}
          activeOpacity={0.75}
        >
          <Ionicons name={showAdd ? 'close' : 'add'} size={22} color="#4f8ef7" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Balance impact card */}
        <View style={styles.impactCard}>
          <View style={styles.impactHeader}>
            <Ionicons name="analytics-outline" size={16} color="#4f8ef7" />
            <Text style={styles.impactTitle}>Balance Impact</Text>
          </View>

          <View style={styles.impactMainRow}>
            <View style={styles.impactMainItem}>
              <Text style={styles.impactMainLabel}>Current balance</Text>
              <Text style={[styles.impactMainValue, { color: currentBalance >= 0 ? '#1D9E75' : '#D85A30' }]}>
                {formatBalance(currentBalance)}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color="#3a4d70" />
            <View style={styles.impactMainItem}>
              <Text style={styles.impactMainLabel}>After planned</Text>
              <Text style={[styles.impactMainValue, { color: balanceAfter >= 0 ? '#1D9E75' : '#D85A30' }]}>
                {plannedItems.length > 0 ? formatBalance(balanceAfter) : '—'}
              </Text>
            </View>
          </View>

          {plannedItems.length > 0 && (
            <View style={styles.impactBreakdown}>
              {plannedItems.map(item => {
                const meta = CATEGORY_META[item.category]
                return (
                  <View key={item.id} style={styles.impactLine}>
                    <View style={[styles.impactDot, { backgroundColor: meta.color }]} />
                    <Text style={styles.impactLineName} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.impactLineAmt, { color: meta.color }]}>
                      − {formatINR(item.estimatedAmount)}
                    </Text>
                  </View>
                )
              })}
              <View style={styles.impactTotalRow}>
                <Text style={styles.impactTotalLabel}>Total planned</Text>
                <Text style={styles.impactTotalAmt}>− {formatINR(totalPlanned)}</Text>
              </View>
            </View>
          )}

          {plannedItems.length === 0 && (
            <Text style={styles.impactEmpty}>Add items below to see balance impact</Text>
          )}
        </View>

        {/* Add form */}
        {showAdd && (
          <View style={styles.addForm}>
            <Text style={styles.addFormTitle}>Add to plan</Text>

            <Text style={styles.formLabel}>NAME</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. Birthday gift, New laptop…"
              placeholderTextColor="#3a4d70"
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={styles.formLabel}>ESTIMATED AMOUNT (₹)</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. 3000"
              placeholderTextColor="#3a4d70"
              value={newAmount}
              onChangeText={setNewAmount}
              keyboardType="numeric"
            />

            <Text style={styles.formLabel}>CATEGORY</Text>
            <View style={styles.catGrid}>
              {PLAN_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setNewCategory(cat)}
                  style={[
                    styles.catPill,
                    newCategory === cat && {
                      backgroundColor: CATEGORY_META[cat].color + '33',
                      borderColor: CATEGORY_META[cat].color,
                    },
                  ]}
                >
                  <Text style={[styles.catPillText, newCategory === cat && { color: CATEGORY_META[cat].color }]}>
                    {CATEGORY_META[cat].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.saveBtn,
                (!newName.trim() || !parseFloat(newAmount) || addLoading) && { opacity: 0.5 },
              ]}
              onPress={handleAdd}
              disabled={addLoading || !newName.trim() || !parseFloat(newAmount)}
            >
              {addLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>Add to Plan</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Loading */}
        {loading && <ActivityIndicator color="#4f8ef7" style={{ marginTop: 32 }} />}

        {/* Empty state */}
        {!loading && plannedItems.length === 0 && !showAdd && (
          <Text style={styles.emptyNote}>
            No planned expenses yet.{'\n'}Tap + to add upcoming spends and see their impact on your balance.
          </Text>
        )}

        {/* Planned items */}
        {plannedItems.map(item => (
          <PlannedItemCard
            key={item.id}
            item={item}
            onMove={(amt) => handleMove(item, amt)}
            onDelete={() => handleDelete(item)}
          />
        ))}

        {/* Done items */}
        {doneItems.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.doneToggle}
              onPress={() => setShowDone(v => !v)}
              activeOpacity={0.75}
            >
              <Text style={styles.doneToggleText}>
                {showDone ? 'Hide' : 'Show'} {doneItems.length} completed item{doneItems.length !== 1 ? 's' : ''}
              </Text>
              <Ionicons name={showDone ? 'chevron-up' : 'chevron-down'} size={14} color="#4a6090" />
            </TouchableOpacity>
            {showDone && doneItems.map(item => (
              <PlannedItemCard
                key={item.id}
                item={item}
                onMove={() => {}}
                onDelete={() => handleDelete(item)}
                isDone
              />
            ))}
          </>
        )}
      </ScrollView>
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
    paddingBottom: 12,
    paddingTop: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#f0f4ff', letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: '#4a6090', fontWeight: '500', marginTop: 2 },
  headerBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(79,142,247,0.12)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(79,142,247,0.2)',
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },

  // Balance impact card
  impactCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(79,142,247,0.18)',
  },
  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  impactTitle: { fontSize: 13, fontWeight: '700', color: '#c8d6f0' },
  impactMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  impactMainItem: { flex: 1, alignItems: 'center', gap: 4 },
  impactMainLabel: { fontSize: 11, color: '#4a6090', fontWeight: '600', letterSpacing: 0.3 },
  impactMainValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  impactBreakdown: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(99,130,220,0.08)',
    paddingTop: 10,
    gap: 7,
  },
  impactLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  impactDot: { width: 6, height: 6, borderRadius: 3 },
  impactLineName: { flex: 1, fontSize: 12, color: '#8899b0', fontWeight: '500' },
  impactLineAmt: { fontSize: 12, fontWeight: '700' },
  impactTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(99,130,220,0.08)',
    paddingTop: 8,
    marginTop: 2,
  },
  impactTotalLabel: { fontSize: 12, color: '#4a6090', fontWeight: '600' },
  impactTotalAmt: { fontSize: 12, fontWeight: '700', color: '#D85A30' },
  impactEmpty: {
    fontSize: 12, color: '#3a4d70', fontStyle: 'italic', textAlign: 'center', paddingBottom: 4,
  },

  // Add form
  addForm: {
    backgroundColor: '#111827', borderRadius: 18, padding: 18,
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(99,130,220,0.15)',
  },
  addFormTitle: { fontSize: 16, fontWeight: '800', color: '#f0f4ff', marginBottom: 16 },
  formLabel: {
    fontSize: 11, fontWeight: '700', color: '#4a6090',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8,
  },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(99,130,220,0.18)',
    borderRadius: 11, padding: 13, fontSize: 14, color: '#fff', marginBottom: 16,
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  catPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#0f1523',
    borderWidth: 1, borderColor: 'rgba(99,130,220,0.15)',
  },
  catPillText: { fontSize: 13, fontWeight: '600', color: '#4a6090' },
  saveBtn: {
    backgroundColor: '#2563eb', borderRadius: 13,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Item cards
  itemCard: {
    backgroundColor: '#111827', borderRadius: 16, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: 'rgba(99,130,220,0.1)',
  },
  itemCardDone: { opacity: 0.55 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  itemDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#f0f4ff', marginBottom: 2 },
  itemNameDone: { color: '#4a6090', textDecorationLine: 'line-through' },
  catBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  catBadgeText: { fontSize: 11, fontWeight: '600' },
  itemAmount: { fontSize: 16, fontWeight: '800', color: '#f0f4ff' },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  moveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(29,158,117,0.1)',
    borderWidth: 1, borderColor: 'rgba(29,158,117,0.25)',
  },
  moveBtnText: { fontSize: 13, fontWeight: '600', color: '#1D9E75' },
  deleteBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(99,130,220,0.06)' },
  doneBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  doneBadgeText: { fontSize: 12, color: '#1D9E75', fontWeight: '500' },

  // Confirm actual amount
  confirmArea: { gap: 6 },
  confirmLabel: { fontSize: 12, color: '#4a6090', fontWeight: '600', marginBottom: 2 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirmInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(79,142,247,0.35)',
    borderRadius: 10, padding: 10, fontSize: 16, color: '#fff', fontWeight: '700',
  },
  confirmBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#1D9E75',
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cancelBtn: { padding: 10, borderRadius: 10, backgroundColor: 'rgba(99,130,220,0.08)' },

  // Done toggle
  doneToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, marginTop: 4,
  },
  doneToggleText: { fontSize: 12, color: '#4a6090', fontWeight: '600' },

  emptyNote: {
    textAlign: 'center', color: '#3a4d70',
    fontSize: 13, marginTop: 40, fontStyle: 'italic', lineHeight: 20,
  },
})
