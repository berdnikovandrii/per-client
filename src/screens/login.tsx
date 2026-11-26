// Sign in with an email and the 6-digit code we send to it (Andrii, 2026-11-11): no password, no SMS.
// The same address later finds the rider's earlier bookings.
// The app opens without an account (guest); this screen appears when the rider sends a request or taps Sign in.
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/icon';
import { GoldButton, NATIVE, reduceMotion, Rise, T, Tap } from '../components/ui';
import { PHONE, PHONE_TEL, SITE, sendCode, verifyCode } from '../lib/api';
import { FLEET_PHOTO } from '../lib/photos';
import { C, SERIF } from '../theme';
import { useAppWidth } from '../lib/layout';

const say = (title: string, message: string) => (Platform.OS === 'web' ? console.log(title, message) : Alert.alert(title, message));

type Props = {
  /** shown above the card, e.g. why we ask now */
  reason?: string;
  /** signed in */
  onDone?: () => void;
  /** the way back to the app without signing in */
  onCancel?: () => void;
};

export default function Login({ reason, onDone, onCancel }: Props) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [focus, setFocus] = useState(false);
  const { height } = useWindowDimensions();
  const width = useAppWidth();
  const photo = Math.max(PHOTO, Math.round(height * 0.46));
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'ios' ? 14 : insets.top + 6; // a page sheet on iPhone, full screen elsewhere
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 14000, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(drift, { toValue: 0, duration: 14000, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  async function next() {
    setError('');
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(address)) {
      setError('Enter your email address, e.g. name@example.com.');
      return;
    }
    setBusy(true);
    try {
      if (step === 'email') {
        await sendCode(address);
        setStep('code');
      } else {
        if (code.replace(/\D/g, '').length !== 6) {
          setError('Enter the 6-digit code from the email.');
          return;
        }
        await verifyCode(address, code);
        // the auth listener in App.tsx picks the session up; the caller continues what the rider was doing
        onDone?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function again() {
    setError('');
    setCode('');
    setBusy(true);
    try {
      await sendCode(email.trim().toLowerCase());
      say('Code sent', `We sent a new code to ${email.trim()}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.photoBox, { width, height: photo }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.Image
          source={FLEET_PHOTO}
          resizeMode="cover"
          style={{ width, height: photo, transform: [{ scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1.12] }) }, { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }}
        />
        <LinearGradient colors={['rgba(11,11,12,0.6)', 'rgba(11,11,12,0.1)', C.bg]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      </View>
      {onCancel ? (
        <Tap style={[styles.back, { top }]} onPress={onCancel} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="back" size={18} stroke={1.8} />
          <Text style={styles.backText}>Back</Text>
        </Tap>
      ) : null}
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 20 + insets.bottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
        <Rise style={{ gap: 22 }}>
          <View style={{ gap: 10 }}>
            <Text style={styles.brand}>PACIFIC ELITE RIDES</Text>
            <Text style={styles.title} accessibilityRole="header">{step === 'code' ? 'Check your email' : reason ? 'Your email' : 'Sign in or create your account'}</Text>
            <Text style={styles.sub}>{step === 'code' ? `We sent a 6-digit code to ${email.trim()}.` : reason || 'Black car service · San Diego'}</Text>
          </View>

          {step === 'email' ? (
            <View style={{ gap: 8 }}>
              <Text style={T.fieldLabel}>Email</Text>
              <TextInput
                style={[styles.input, focus && { borderColor: C.gold }]}
                placeholder="name@example.com"
                placeholderTextColor={C.faint}
                keyboardType="email-address"
                keyboardAppearance="dark"
                selectionColor={C.gold}
                textContentType="emailAddress"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={next}
                onFocus={() => setFocus(true)}
                onBlur={() => setFocus(false)}
                returnKeyType="next"
                accessibilityLabel="Email"
              />
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={T.fieldLabel}>Code</Text>
              <TextInput
                style={[styles.input, styles.codeInput, { borderColor: C.gold }]}
                placeholder="••••••"
                placeholderTextColor={C.faint}
                keyboardType="number-pad"
                keyboardAppearance="dark"
                selectionColor={C.gold}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                autoFocus
                onSubmitEditing={next}
                accessibilityLabel="6-digit code"
              />
            </View>
          )}

          {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
          <GoldButton label={step === 'email' ? 'Email me a code' : 'Sign in'} onPress={next} busy={busy} />

          {step === 'email' ? (
            <Text style={styles.hint}>We email you a 6-digit code. No password to remember.</Text>
          ) : (
            <View style={styles.links}>
              <Tap onPress={again} disabled={busy} style={styles.linkTap} accessibilityRole="button">
                <Text style={styles.link}>Send a new code</Text>
              </Tap>
              <Tap
                style={styles.linkTap}
                accessibilityRole="button"
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setError('');
                }}
              >
                <Text style={styles.link}>Change email</Text>
              </Tap>
            </View>
          )}
        </Rise>

        <View style={styles.footer}>
          <Tap onPress={() => Linking.openURL(`tel:${PHONE_TEL}`)} style={styles.linkTap} accessibilityRole="button">
            <Text style={styles.footerText}>Prefer to call? {PHONE}</Text>
          </Tap>
          <Text style={styles.legal}>
            By continuing you agree to our{' '}
            <Text style={styles.legalLink} onPress={() => Linking.openURL(`${SITE}/terms.html`)}>Terms</Text> and{' '}
            <Text style={styles.legalLink} onPress={() => Linking.openURL(`${SITE}/privacy.html`)}>Privacy Policy</Text>.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const PHOTO = 360;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  photoBox: { position: 'absolute', top: 0, left: 0, height: PHOTO, overflow: 'hidden', backgroundColor: C.cardHi },
  back: { position: 'absolute', left: 12, zIndex: 2, height: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: C.ink, fontSize: 16 },
  scroll: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingTop: 200, paddingBottom: 28 },
  brand: { fontSize: 11, fontWeight: '600', letterSpacing: 3.2, color: C.goldText },
  title: { ...SERIF, fontSize: 38, lineHeight: 42, letterSpacing: -0.3, color: C.ink },
  sub: { fontSize: 15, lineHeight: 21, color: '#C9C5BC' },
  input: { height: 56, paddingHorizontal: 18, borderRadius: 16, fontSize: 17, color: C.ink, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineHi },
  codeInput: { letterSpacing: 10, textAlign: 'center', fontSize: 26, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 19, color: C.muted, textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  linkTap: { minHeight: 44, justifyContent: 'center' },
  link: { color: C.goldText, fontSize: 14, fontWeight: '600' },
  error: { color: C.red, fontSize: 14, lineHeight: 19 },
  footer: { alignItems: 'center', marginTop: 26, gap: 4 },
  footerText: { color: C.text, fontSize: 14, fontWeight: '500' },
  legal: { color: C.faint, fontSize: 12, textAlign: 'center', lineHeight: 17 },
  legalLink: { color: C.goldText },
});
