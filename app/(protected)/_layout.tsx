import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@/context/auth'
import { ActivityIndicator, View } from 'react-native'

export default function ProtectedLayout() {
  const { user, loading } = useAuth()

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator />
    </View>
  )

  if (!user) return <Redirect href="/login" />

  return <Stack screenOptions={{ headerShown: false }} />
}
