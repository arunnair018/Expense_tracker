import { Redirect, Slot } from 'expo-router'
import { ActivityIndicator, View, Text } from 'react-native'
import { useAuth } from '@/context/auth'

export default function ProtectedLayout() {
  const { user, loading } = useAuth()

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#080d1c', gap: 20 }}>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#f0f4ff', letterSpacing: -0.5 }}>
          Accountant
        </Text>
        <Text style={{ fontSize: 13, color: '#4a6090', fontWeight: '500', letterSpacing: 0.3 }}>
          Personal Finance
        </Text>
      </View>
      <ActivityIndicator color="#2563eb" size="large" />
    </View>
  )

  if (!user) return <Redirect href="/login" />

  // Slot renders whichever child route is active — the (tabs) group takes over from here
  return <Slot />
}
