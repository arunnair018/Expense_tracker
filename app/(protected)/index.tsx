import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/context/auth'

export default function HomeScreen() {
  const { user } = useAuth()
  const email = user?.email ?? ''
  const rawName = email.split('@')[0] ?? 'User'
  const displayName = rawName
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
  const firstName = displayName || 'User'

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Dashboard</Text>
        <Text style={styles.title}>Welcome, {firstName}</Text>
        <Text style={styles.subtitle}>You signed in successfully.</Text>

        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={() => signOut(auth)}>
          <Text style={styles.buttonText}>Sign out</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.footer}>The name above is derived from the part before `@` in your email.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#08101f',
  },
  card: {
    backgroundColor: '#101a30',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.15)',
  },
  eyebrow: {
    fontSize: 12,
    color: '#7dd3fc',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontWeight: '700',
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    marginBottom: 28,
  },
  infoBlock: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  infoLabel: {
    fontSize: 12,
    color: '#7dd3fc',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
    fontWeight: '700',
  },
  email: {
    fontSize: 16,
    color: '#e2e8f0',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#eff6ff',
  },
  footer: {
    marginTop: 18,
    textAlign: 'center',
    color: '#64748b',
    fontSize: 12,
  },
})
