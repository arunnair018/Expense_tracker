/**
 * Global UI feedback system — themed toast notifications + confirm dialogs.
 * Replaces all native Alert.alert calls app-wide.
 *
 * Usage:
 *   const { toast, confirm } = useUI()
 *   toast('success', 'Entry saved')
 *   confirm({ title: 'Delete?', body: '...', confirmLabel: 'Delete', destructive: true, onConfirm: () => {} })
 */

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ConfirmOptions {
  title: string
  body?: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
}

interface UIContextType {
  toast: (type: ToastType, message: string) => void
  confirm: (opts: ConfirmOptions) => void
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TOAST_META: Record<ToastType, { color: string; icon: string; border: string }> = {
  success: { color: '#1D9E75', icon: 'checkmark-circle',   border: 'rgba(29,158,117,0.35)'  },
  error:   { color: '#ef4444', icon: 'alert-circle',       border: 'rgba(239,68,68,0.35)'   },
  info:    { color: '#4f8ef7', icon: 'information-circle', border: 'rgba(79,142,247,0.35)'  },
  warning: { color: '#BA7517', icon: 'warning',            border: 'rgba(186,117,23,0.35)'  },
}

// ─── Context ──────────────────────────────────────────────────────────────────

const UIContext = createContext<UIContextType>({ toast: () => {}, confirm: () => {} })
export const useUI = () => useContext(UIContext)

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ToastItem {
  id: number
  type: ToastType
  message: string
  anim: Animated.Value
}

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts]         = useState<ToastItem[]>([])
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null)
  const nextId = useRef(0)

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++nextId.current
    const anim = new Animated.Value(0)
    setToasts(prev => [...prev, { id, type, message, anim }])
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToasts(prev => prev.filter(t => t.id !== id)))
  }, [])

  const confirm = useCallback((opts: ConfirmOptions) => {
    setConfirmOpts(opts)
  }, [])

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}

      {/* ── Toast stack (bottom, above tab bar) ── */}
      <View style={styles.toastStack} pointerEvents="none">
        {toasts.map(t => {
          const meta = TOAST_META[t.type]
          return (
            <Animated.View
              key={t.id}
              style={[
                styles.toastPill,
                {
                  borderColor: meta.border,
                  opacity: t.anim,
                  transform: [{
                    translateY: t.anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  }],
                },
              ]}
            >
              <Ionicons name={meta.icon as any} size={17} color={meta.color} />
              <Text style={[styles.toastText, { color: meta.color }]}>{t.message}</Text>
            </Animated.View>
          )
        })}
      </View>

      {/* ── Confirm modal ── */}
      <Modal
        visible={!!confirmOpts}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setConfirmOpts(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setConfirmOpts(null)}>
          <Pressable style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>{confirmOpts?.title}</Text>
            {!!confirmOpts?.body && (
              <Text style={styles.confirmBody}>{confirmOpts.body}</Text>
            )}
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setConfirmOpts(null)}
                activeOpacity={0.75}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  confirmOpts?.destructive && styles.confirmBtnDestructive,
                ]}
                onPress={() => {
                  confirmOpts?.onConfirm()
                  setConfirmOpts(null)
                }}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.confirmBtnText,
                  confirmOpts?.destructive && { color: '#ef4444' },
                ]}>
                  {confirmOpts?.confirmLabel ?? 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </UIContext.Provider>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Toast
  toastStack: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    alignItems: 'center',
    gap: 8,
    zIndex: 9999,
  },
  toastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    maxWidth: 380,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    flexShrink: 1,
  },

  // Confirm
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  confirmBox: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#f0f4ff',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  confirmBody: {
    fontSize: 14,
    color: '#8899b0',
    lineHeight: 20,
    marginBottom: 22,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: 'rgba(99,130,220,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.18)',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8899b0',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: 'rgba(79,142,247,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(79,142,247,0.3)',
    alignItems: 'center',
  },
  confirmBtnDestructive: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4f8ef7',
  },
})
