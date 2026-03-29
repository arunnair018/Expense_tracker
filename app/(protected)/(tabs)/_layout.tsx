import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function TabsLayout() {
  const insets = useSafeAreaInsets()

  // Tab bar height = icon+label area (56) + system bottom inset (gesture bar / home bar)
  const tabBarHeight = 56 + insets.bottom

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0d1320',
          borderTopColor: 'rgba(99,130,220,0.15)',
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        },
        tabBarActiveTintColor: '#4f8ef7',
        tabBarInactiveTintColor: '#3a4d70',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="instruments"
        options={{
          title: 'Instruments',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'trending-up' : 'trending-up-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pool"
        options={{
          title: 'Corpus',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="planned"
        options={{
          title: 'Planned',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'list-circle' : 'list-circle-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
