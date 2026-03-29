import { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/context/auth'

const { width, height } = Dimensions.get('window')

export default function LoginScreen() {
  const { user } = useAuth()
  const [stage, setStage] = useState<'landing' | 'auth'>('landing')
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)

  // Animations
  const logoScale = useRef(new Animated.Value(0.6)).current
  const logoOpacity = useRef(new Animated.Value(0)).current
  const taglineOpacity = useRef(new Animated.Value(0)).current
  const taglineY = useRef(new Animated.Value(20)).current
  const buttonOpacity = useRef(new Animated.Value(0)).current
  const buttonY = useRef(new Animated.Value(30)).current

  const formOpacity = useRef(new Animated.Value(0)).current
  const formY = useRef(new Animated.Value(40)).current
  const landingOpacity = useRef(new Animated.Value(1)).current

  const orb1Y = useRef(new Animated.Value(0)).current
  const orb2Y = useRef(new Animated.Value(0)).current
  const orb3Y = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(taglineY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(buttonOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(buttonY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start()

    const floatOrb = (anim: Animated.Value, distance: number, duration: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: -distance, duration, useNativeDriver: true }),
          Animated.timing(anim, { toValue: distance, duration, useNativeDriver: true }),
        ])
      ).start()
    }
    floatOrb(orb1Y, 18, 3200)
    floatOrb(orb2Y, 12, 2600)
    floatOrb(orb3Y, 22, 4000)
  }, [])

  useEffect(() => {
    if (user) router.replace('/(protected)')
  }, [user])

  function goToAuth(loginMode: boolean) {
    setIsLogin(loginMode)
    resetAuthForm()
    setStage('auth')
    Animated.parallel([
      Animated.timing(landingOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(formOpacity, { toValue: 1, duration: 400, delay: 200, useNativeDriver: true }),
      Animated.timing(formY, { toValue: 0, duration: 400, delay: 200, useNativeDriver: true }),
    ]).start()
  }

  function goBack() {
    Animated.parallel([
      Animated.timing(landingOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(formOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(formY, { toValue: 40, duration: 200, useNativeDriver: true }),
    ]).start(() => setStage('landing'))
  }

  function resetAuthForm() {
    setEmail('')
    setPassword('')
    setEmailError('')
    setPasswordError('')
    setFormError('')
    setFormSuccess('')
    setEmailTouched(false)
    setPasswordTouched(false)
    setShowPassword(false)
  }

  function validateForm() {
    setEmailTouched(true)
    setPasswordTouched(true)
    const nextEmailError = getEmailError(email)
    const nextPasswordError = getPasswordError(password, isLogin)
    setEmailError(nextEmailError)
    setPasswordError(nextPasswordError)
    setFormError('')
    return !(nextEmailError || nextPasswordError)
  }

  function getEmailError(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return 'Email is required.'
    if (!/\S+@\S+\.\S+/.test(trimmed)) return 'Enter a valid email address.'
    return ''
  }

  function getPasswordError(value: string, loginMode = false) {
    if (!value) return 'Password is required.'
    if (loginMode) return ''
    if (value.length < 8) return 'Password must be at least 8 characters.'
    if (!/[A-Z]/.test(value)) return 'Include at least one uppercase letter.'
    if (!/[a-z]/.test(value)) return 'Include at least one lowercase letter.'
    if (!/\d/.test(value)) return 'Include at least one number.'
    if (!/[!@#$%^&*(),.?":{}|<>_\-\\[\]/`~+=;']/.test(value)) return 'Include at least one special character.'
    return ''
  }

  async function handleAuth() {
    if (!validateForm()) return
    setLoading(true)
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password)
      }
    } catch (error: any) {
      const msg =
        error.code === 'auth/user-not-found' ? 'No account found with this email.' :
        error.code === 'auth/wrong-password' ? 'Incorrect password. Try again.' :
        error.code === 'auth/email-already-in-use' ? 'This email is already registered.' :
        error.code === 'auth/invalid-email' ? 'Please enter a valid email.' :
        error.code === 'auth/invalid-credential' ? 'Email or password is incorrect.' :
        error.message
      setFormError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    const err = getEmailError(email)
    if (err) {
      setEmailTouched(true)
      setEmailError(err)
      return
    }
    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setFormSuccess('Reset link sent — check your inbox.')
      setFormError('')
    } catch {
      setFormError('Could not send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <StatusBar barStyle="light-content" />

      {/* Background */}
      <View style={styles.background}>
        <View style={styles.bgGradientTop} />
        <View style={styles.bgGradientBottom} />
      </View>

      {/* Floating orbs */}
      <Animated.View style={[styles.orb, styles.orb1, { transform: [{ translateY: orb1Y }] }]} />
      <Animated.View style={[styles.orb, styles.orb2, { transform: [{ translateY: orb2Y }] }]} />
      <Animated.View style={[styles.orb, styles.orb3, { transform: [{ translateY: orb3Y }] }]} />

      {/* Grid lines */}
      <View style={styles.gridLines} pointerEvents="none">
        {[...Array(6)].map((_, i) => (
          <View key={i} style={[styles.gridLine, { left: `${(i + 1) * 14}%` }]} />
        ))}
      </View>

      {/* LANDING STAGE */}
      <Animated.View
        style={[styles.landing, { opacity: landingOpacity, pointerEvents: stage === 'landing' ? 'auto' : 'none' }]}
      >
        <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoIconText}>A</Text>
          </View>
          <Text style={styles.logoText}>Accountant</Text>
        </Animated.View>

        <Animated.View style={{ opacity: taglineOpacity, transform: [{ translateY: taglineY }] }}>
          <Text style={styles.tagline}>Your money.{'\n'}Finally makes sense.</Text>
          <Text style={styles.subTagline}>Track. Budget. Own it.</Text>
        </Animated.View>

        <Animated.View style={[styles.buttonGroup, { opacity: buttonOpacity, transform: [{ translateY: buttonY }] }]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => goToAuth(false)} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Get Started</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => goToAuth(true)} activeOpacity={0.7}>
            <Text style={styles.ghostBtnText}>I already have an account</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* AUTH STAGE */}
      <Animated.View
        style={[
          styles.authSheet,
          {
            opacity: formOpacity,
            transform: [{ translateY: formY }],
            pointerEvents: stage === 'auth' ? 'auto' : 'none',
          },
        ]}
      >
        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={18} color="#8aabf7" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.authTitle}>{isLogin ? 'Welcome back' : 'Create account'}</Text>
        <Text style={styles.authSubtitle}>
          {isLogin ? 'Sign in to your account' : 'Start your financial clarity journey'}
        </Text>

        {/* Email */}
        <View style={styles.inputWrap}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={[styles.input, emailTouched && emailError ? styles.inputError : null]}
            placeholder="you@example.com"
            placeholderTextColor="#4a5470"
            value={email}
            onChangeText={(v) => {
              setEmail(v)
              if (emailError || formError || formSuccess) {
                setEmailError('')
                setFormError('')
                setFormSuccess('')
              }
            }}
            onFocus={() => setEmailTouched(true)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            onBlur={() => {
              setEmailTouched(true)
              setEmailError(getEmailError(email))
            }}
          />
          {emailTouched && emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
        </View>

        {/* Password */}
        <View style={styles.inputWrap}>
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.inputPassword, passwordTouched && passwordError ? styles.inputError : null]}
              placeholder={isLogin ? '••••••••' : 'Create a strong password'}
              placeholderTextColor="#4a5470"
              value={password}
              onChangeText={(v) => {
                setPassword(v)
                if (passwordError || formError || formSuccess) {
                  setPasswordError('')
                  setFormError('')
                  setFormSuccess('')
                }
              }}
              onFocus={() => setPasswordTouched(true)}
              secureTextEntry={!showPassword}
              onBlur={() => {
                setPasswordTouched(true)
                setPasswordError(getPasswordError(password, isLogin))
              }}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(p => !p)} activeOpacity={0.7}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#5b7dd8" />
            </TouchableOpacity>
          </View>

          {!isLogin ? (
            <Text style={styles.helperText}>8+ chars · uppercase · lowercase · number · special character</Text>
          ) : (
            <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotBtn} activeOpacity={0.7}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}
          {passwordTouched && passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
        </View>

        {formError ? <Text style={styles.formErrorText}>{formError}</Text> : null}
        {formSuccess ? <Text style={styles.formSuccessText}>{formSuccess}</Text> : null}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleAuth}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#0a0f1e" />
            : <Text style={styles.submitBtnText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
          }
        </TouchableOpacity>

        {/* Toggle */}
        <TouchableOpacity
          onPress={() => { setIsLogin(p => !p); resetAuthForm() }}
          style={styles.toggleWrap}
        >
          <Text style={styles.toggleText}>
            {isLogin ? 'New here?  ' : 'Already have an account?  '}
            <Text style={styles.toggleLink}>{isLogin ? 'Sign up' : 'Sign in'}</Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  bgGradientTop: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: width * 1.2,
    height: height * 0.6,
    backgroundColor: '#0d1533',
    borderRadius: 999,
    opacity: 0.8,
  },
  bgGradientBottom: {
    position: 'absolute',
    bottom: -150,
    right: -80,
    width: width,
    height: height * 0.5,
    backgroundColor: '#060c1a',
    borderRadius: 999,
  },
  gridLines: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(99,120,200,0.06)',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orb1: {
    width: 280,
    height: 280,
    top: -60,
    right: -80,
    backgroundColor: '#1a3a8f',
    opacity: 0.25,
  },
  orb2: {
    width: 180,
    height: 180,
    top: height * 0.3,
    left: -60,
    backgroundColor: '#0e4d8a',
    opacity: 0.2,
  },
  orb3: {
    width: 120,
    height: 120,
    bottom: 100,
    right: 40,
    backgroundColor: '#2a5298',
    opacity: 0.18,
  },
  landing: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 52,
  },
  logoIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#2563eb',
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  logoIconText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 40,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 48,
    letterSpacing: -1.5,
    marginBottom: 16,
  },
  subTagline: {
    fontSize: 13,
    color: '#5b7dd8',
    fontWeight: '600',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 60,
  },
  buttonGroup: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  ghostBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.25)',
    backgroundColor: 'rgba(37,99,235,0.08)',
  },
  ghostBtnText: {
    color: '#8aabf7',
    fontSize: 15,
    fontWeight: '500',
  },
  authSheet: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  backBtn: {
    position: 'absolute',
    top: 60,
    left: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 4,
  },
  backBtnText: {
    color: '#8aabf7',
    fontSize: 15,
    fontWeight: '500',
  },
  authTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 15,
    color: '#5b7dd8',
    marginBottom: 36,
    fontWeight: '400',
  },
  inputWrap: {
    marginBottom: 18,
  },
  inputLabel: {
    color: '#6b84b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.18)',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#fff',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputPassword: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(99,130,220,0.18)',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#fff',
    paddingRight: 52,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    padding: 4,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  forgotBtn: {
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  forgotText: {
    color: '#8aabf7',
    fontSize: 13,
    fontWeight: '500',
  },
  helperText: {
    marginTop: 8,
    color: '#4a5a80',
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    marginTop: 7,
    color: '#f87171',
    fontSize: 12,
    fontWeight: '500',
  },
  formErrorText: {
    color: '#f87171',
    fontSize: 13,
    marginTop: -4,
    marginBottom: 12,
    fontWeight: '500',
  },
  formSuccessText: {
    color: '#34d399',
    fontSize: 13,
    marginTop: -4,
    marginBottom: 12,
    fontWeight: '500',
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2563eb',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  toggleWrap: {
    marginTop: 24,
    alignItems: 'center',
  },
  toggleText: {
    color: '#4a5a80',
    fontSize: 14,
  },
  toggleLink: {
    color: '#8aabf7',
    fontWeight: '700',
  },
})
