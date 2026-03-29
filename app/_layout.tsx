import { Slot } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { AuthProvider } from '@/context/auth'
import { UIProvider } from '@/context/ui'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#080d1c' }}>
      <BottomSheetModalProvider>
        <AuthProvider>
          <UIProvider>
            <Slot />
          </UIProvider>
        </AuthProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  )
}
