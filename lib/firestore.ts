/**
 * Firestore data layer — types, helpers, and real-time hooks.
 *
 * Data model (scoped per user):
 *   users/{uid}/months/{YYYY-MM}/entries/{id}
 *   users/{uid}/instruments/{id}
 *   users/{uid}/pool/{id}
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from './firebase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EntryCategory = 'credit' | 'savings' | 'investment' | 'expense' | 'subscription'
export type EntryType = 'recurring' | 'one-time'

export interface Entry {
  id: string
  name: string
  amount: number
  category: EntryCategory
  type: EntryType
  isAutoFromInstrument: boolean
  instrumentId?: string
  createdAt: Date
}

export interface MonthData {
  yearMonth: string        // "2026-03"
  openingBalance: number
  closingBalance: number
  isConfirmed: boolean
}

export interface Instrument {
  id: string
  name: string
  bank: string
  monthlyInstalment: number
  tenureMonths: number
  startDate: Date
  maturityDate: Date
  maturityAmount: number
  status: 'active' | 'matured'
  kind?: 'rd' | 'expense'          // 'rd' if absent (backward compat)
  expenseCategory?: EntryCategory  // only for kind='expense'
  createdAt: Date
}

export interface Allocation {
  id: string
  goalName: string
  amount: number
  plannedOrActual: 'planned' | 'actual'
}

export interface PoolEvent {
  id: string
  instrumentId: string
  maturedAmount: number
  maturedDate: Date
  status: 'upcoming' | 'in-progress' | 'done'
  allocations: Allocation[]
}

// ─── Error helpers ────────────────────────────────────────────────────────────

export function friendlyFirestoreError(err: any): string {
  const code: string = err?.code ?? ''
  if (code === 'unavailable' || code === 'failed-precondition' || err?.message?.includes('offline')) {
    return 'You appear to be offline. Check your connection and try again.'
  }
  if (code === 'permission-denied') {
    return 'Permission denied. Make sure you are signed in and Firestore rules are deployed.'
  }
  if (code === 'not-found') {
    return 'No data found for this period.'
  }
  if (code === 'unauthenticated') {
    return 'Your session has expired. Please sign in again.'
  }
  if (err?.message?.includes('projectId')) {
    return 'Firebase project is not configured. Check your .env file.'
  }
  return err?.message ?? 'An unexpected error occurred. Please try again.'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function currentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function prevYearMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** For entry amounts — always unsigned (category conveys direction). */
export function formatINR(amount: number): string {
  return '₹' + Math.abs(amount).toLocaleString('en-IN')
}

/** For entry amounts short — always unsigned. */
export function formatINRShort(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 100_000) return '₹' + (abs / 100_000).toFixed(2) + 'L'
  if (abs >= 1_000) return '₹' + (abs / 1_000).toFixed(1) + 'K'
  return '₹' + abs.toLocaleString('en-IN')
}

/** For balance values — preserves negative sign so debts are visible. */
export function formatBalance(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  return sign + '₹' + Math.abs(amount).toLocaleString('en-IN')
}

/** Short balance — preserves negative sign (K / L notation). */
export function formatBalanceShort(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  if (abs >= 100_000) return sign + '₹' + (abs / 100_000).toFixed(2) + 'L'
  if (abs >= 1_000) return sign + '₹' + (abs / 1_000).toFixed(1) + 'K'
  return sign + '₹' + abs.toLocaleString('en-IN')
}

export function addMonths(date: Date, n: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

function tsToDate(ts: any): Date {
  if (!ts) return new Date()
  if (ts instanceof Timestamp) return ts.toDate()
  if (ts instanceof Date) return ts
  return new Date(ts)
}

// ─── Firestore path helpers ───────────────────────────────────────────────────

const monthDoc = (uid: string, ym: string) => doc(db, 'users', uid, 'months', ym)
const entriesCol = (uid: string, ym: string) =>
  collection(db, 'users', uid, 'months', ym, 'entries')
const entryDoc = (uid: string, ym: string, id: string) =>
  doc(db, 'users', uid, 'months', ym, 'entries', id)
const instrumentsCol = (uid: string) => collection(db, 'users', uid, 'instruments')
const instrumentDoc = (uid: string, id: string) =>
  doc(db, 'users', uid, 'instruments', id)
const poolCol = (uid: string) => collection(db, 'users', uid, 'pool')
const poolEventDoc = (uid: string, id: string) =>
  doc(db, 'users', uid, 'pool', id)

// ─── Month data ───────────────────────────────────────────────────────────────

export function useMonthData(uid: string, yearMonth: string) {
  const [data, setData] = useState<MonthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid || !yearMonth) { setLoading(false); return }
    setLoading(true)
    setError(null)
    const unsub = onSnapshot(
      monthDoc(uid, yearMonth),
      snap => {
        setData(snap.exists()
          ? { yearMonth, ...(snap.data() as Omit<MonthData, 'yearMonth'>) }
          : null
        )
        setLoading(false)
        setError(null)
      },
      err => {
        setError(friendlyFirestoreError(err))
        setLoading(false)
      }
    )
    return unsub
  }, [uid, yearMonth])

  return { data, loading, error }
}

export async function getMonthData(uid: string, yearMonth: string): Promise<MonthData | null> {
  if (!uid) return null
  const snap = await getDoc(monthDoc(uid, yearMonth))
  if (!snap.exists()) return null
  return { yearMonth, ...(snap.data() as Omit<MonthData, 'yearMonth'>) }
}

export async function confirmMonth(
  uid: string,
  yearMonth: string,
  openingBalance: number,
  entries: Omit<Entry, 'id' | 'createdAt'>[],
) {
  await setDoc(monthDoc(uid, yearMonth), {
    openingBalance,
    closingBalance: 0,
    isConfirmed: true,
  })
  const col = entriesCol(uid, yearMonth)
  for (const e of entries) {
    await addDoc(col, { ...e, createdAt: serverTimestamp() })
  }
}

export async function updateClosingBalance(uid: string, yearMonth: string, closing: number) {
  if (!uid) return
  await updateDoc(monthDoc(uid, yearMonth), { closingBalance: closing })
}

// ─── Entries ──────────────────────────────────────────────────────────────────

export function useMonthEntries(uid: string, yearMonth: string) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid || !yearMonth) { setLoading(false); return }
    setLoading(true)
    setError(null)
    const q = query(entriesCol(uid, yearMonth), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(
      q,
      snap => {
        setEntries(
          snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            createdAt: tsToDate(d.data().createdAt),
          } as Entry))
        )
        setLoading(false)
        setError(null)
      },
      err => {
        setError(friendlyFirestoreError(err))
        setLoading(false)
      }
    )
    return unsub
  }, [uid, yearMonth])

  return { entries, loading, error }
}

export async function addEntry(
  uid: string,
  yearMonth: string,
  entry: Omit<Entry, 'id' | 'createdAt'>,
) {
  if (!uid) throw new Error('Not authenticated')
  // Ensure month doc exists
  const mSnap = await getDoc(monthDoc(uid, yearMonth))
  if (!mSnap.exists()) {
    await setDoc(monthDoc(uid, yearMonth), {
      openingBalance: 0,
      closingBalance: 0,
      isConfirmed: false,
    })
  }
  return addDoc(entriesCol(uid, yearMonth), { ...entry, createdAt: serverTimestamp() })
}

export async function updateEntry(
  uid: string,
  yearMonth: string,
  entryId: string,
  updates: Partial<Omit<Entry, 'id' | 'createdAt'>>,
) {
  await updateDoc(entryDoc(uid, yearMonth, entryId), updates)
}

export async function deleteEntry(uid: string, yearMonth: string, entryId: string) {
  await deleteDoc(entryDoc(uid, yearMonth, entryId))
}

// ─── Instruments ──────────────────────────────────────────────────────────────

export function useInstruments(uid: string) {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    setLoading(true)
    setError(null)
    const q = query(instrumentsCol(uid), orderBy('maturityDate', 'asc'))
    const unsub = onSnapshot(
      q,
      snap => {
        setInstruments(
          snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            startDate: tsToDate(d.data().startDate),
            maturityDate: tsToDate(d.data().maturityDate),
            createdAt: tsToDate(d.data().createdAt),
            kind: d.data().kind ?? 'rd',
            expenseCategory: d.data().expenseCategory ?? 'expense',
          } as Instrument))
        )
        setLoading(false)
        setError(null)
      },
      err => {
        setError(friendlyFirestoreError(err))
        setLoading(false)
      }
    )
    return unsub
  }, [uid])

  return { instruments, loading, error }
}

export async function addInstrument(
  uid: string,
  data: Omit<Instrument, 'id' | 'createdAt'>,
) {
  if (!uid) throw new Error('Not authenticated')
  const ref = await addDoc(instrumentsCol(uid), {
    ...data,
    startDate: Timestamp.fromDate(data.startDate),
    maturityDate: Timestamp.fromDate(data.maturityDate),
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function deleteInstrument(uid: string, id: string) {
  await deleteDoc(instrumentDoc(uid, id))
}

export async function updateInstrument(
  uid: string,
  id: string,
  updates: Partial<Omit<Instrument, 'id' | 'createdAt'>>,
) {
  const payload: any = { ...updates }
  if (updates.startDate) payload.startDate = Timestamp.fromDate(updates.startDate)
  if (updates.maturityDate) payload.maturityDate = Timestamp.fromDate(updates.maturityDate)
  await updateDoc(instrumentDoc(uid, id), payload)
}

// ─── Pool ─────────────────────────────────────────────────────────────────────

export function usePool(uid: string) {
  const [events, setEvents] = useState<PoolEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    setLoading(true)
    setError(null)
    const unsub = onSnapshot(
      poolCol(uid),
      snap => {
        setEvents(
          snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            maturedDate: tsToDate(d.data().maturedDate),
            allocations: d.data().allocations ?? [],
          } as PoolEvent))
        )
        setLoading(false)
        setError(null)
      },
      err => {
        setError(friendlyFirestoreError(err))
        setLoading(false)
      }
    )
    return unsub
  }, [uid])

  return { events, loading, error }
}

export async function addPoolEvent(uid: string, data: Omit<PoolEvent, 'id'>) {
  if (!uid) throw new Error('Not authenticated')
  return addDoc(poolCol(uid), {
    ...data,
    maturedDate: Timestamp.fromDate(data.maturedDate),
  })
}

export async function updatePoolEvent(uid: string, id: string, updates: Partial<PoolEvent>) {
  await updateDoc(poolEventDoc(uid, id), updates)
}

export async function addAllocation(
  uid: string,
  poolId: string,
  allocation: Allocation,
) {
  const snap = await getDoc(poolEventDoc(uid, poolId))
  const existing: Allocation[] = snap.data()?.allocations ?? []
  await updateDoc(poolEventDoc(uid, poolId), {
    allocations: [...existing, allocation],
  })
}

// ─── Planned items ────────────────────────────────────────────────────────────

export interface PlannedItem {
  id: string
  name: string
  estimatedAmount: number
  category: EntryCategory
  status: 'planned' | 'moved'
  createdAt: Date
}

const plannedCol = (uid: string) => collection(db, 'users', uid, 'planned')
const plannedItemDoc = (uid: string, id: string) => doc(db, 'users', uid, 'planned', id)

export function usePlannedItems(uid: string) {
  const [items, setItems] = useState<PlannedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    setLoading(true)
    setError(null)
    const q = query(plannedCol(uid), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(
      q,
      snap => {
        setItems(snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          createdAt: tsToDate(d.data().createdAt),
        } as PlannedItem)))
        setLoading(false)
        setError(null)
      },
      err => {
        setError(friendlyFirestoreError(err))
        setLoading(false)
      }
    )
    return unsub
  }, [uid])

  return { items, loading, error }
}

export async function addPlannedItem(
  uid: string,
  data: Omit<PlannedItem, 'id' | 'createdAt' | 'status'>,
) {
  if (!uid) throw new Error('Not authenticated')
  return addDoc(plannedCol(uid), { ...data, status: 'planned', createdAt: serverTimestamp() })
}

export async function deletePlannedItem(uid: string, id: string) {
  await deleteDoc(plannedItemDoc(uid, id))
}

export async function markPlannedMoved(uid: string, id: string) {
  await updateDoc(plannedItemDoc(uid, id), { status: 'moved' })
}
