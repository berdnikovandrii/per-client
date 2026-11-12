// Sign in with an email and the 6-digit code we send to it (Andrii, 2026-11-11): no password, no SMS.
// The same address later finds the rider's earlier bookings.
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { PHONE, PHONE_TEL, SITE, sendCode, verifyCode } from '../lib/api';
import { C } from '../theme';

const say = (title: string, message: string) => (Platform.OS === 'web' ? console.log(title, message) : Alert.alert(title, message));

export default function Login() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
        // on success the auth listener in App.tsx takes over
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
      <View style={styles.brand}>
        <Image source={require('../../assets/splash-icon.png')} style={styles.brandMark} resizeMode="contain" accessibilityLabel="Pacific Elite Rides" />
        <Text style={styles.brandTitle}>PACIFIC ELITE RIDES</Text>
        <Text style={styles.brandSub}>Black car service · San Diego</Text>
      </View>
      <View style={styles.card}>
        {step === 'email' ? (
          <>
            <Text style={styles.title}>Sign in or create your account</Text>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={next}
              returnKeyType="next"
            />
            <Text style={styles.hint}>We email you a 6-digit code. No password to remember.</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.sent}>We sent a code to {email.trim()}.</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="••••••"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              autoFocus
              onSubmitEditing={next}
            />
            <View style={styles.links}>
              <TouchableOpacity onPress={again} disabled={busy} hitSlop={8}>
                <Text style={styles.link}>Send a new code</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setError('');
                }}
                hitSlop={8}
              >
                <Text style={styles.link}>Change email</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity style={[styles.button, busy && { opacity: 0.7 }]} onPress={next} disabled={busy}>
          {busy ? <ActivityIndicator color={C.gold} /> : <Text style={styles.buttonText}>{step === 'email' ? 'Email me a code' : 'Sign in'}</Text>}
        </TouchableOpacity>
      </View>
      <View style={styles.footer}>
        <TouchableOpacity onPress={() => Linking.openURL(`tel:${PHONE_TEL}`)} hitSlop={8}>
          <Text style={styles.footerText}>Prefer to call? {PHONE}</Text>
        </TouchableOpacity>
        <Text style={styles.legal}>
          By continuing you agree to our{' '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(`${SITE}/terms.html`)}>Terms</Text> and{' '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(`${SITE}/privacy.html`)}>Privacy Policy</Text>.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.black, justifyContent: 'center', padding: 24 },
  brand: { alignItems: 'center', marginBottom: 26 },
  brandMark: { width: 84, height: 84 },
  brandTitle: { color: C.gold, fontSize: 15, letterSpacing: 4, fontWeight: '700', marginTop: 6 },
  brandSub: { color: '#B9B9BE', fontSize: 14, marginTop: 6 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 20 },
  title: { fontSize: 20, fontWeight: '800', color: C.ink, marginBottom: 14 },
  sent: { fontSize: 15, color: C.text, marginBottom: 14, lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 18, color: C.ink, backgroundColor: '#fff' },
  codeInput: { letterSpacing: 8, textAlign: 'center', fontSize: 26, fontWeight: '700' },
  hint: { fontSize: 13, color: C.muted, marginTop: 10, lineHeight: 18 },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  link: { color: C.goldText, fontSize: 14, fontWeight: '700' },
  error: { color: C.red, fontSize: 14, marginTop: 12, lineHeight: 19 },
  button: { backgroundColor: C.black, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  buttonText: { color: C.gold, fontSize: 16, fontWeight: '800' },
  footer: { alignItems: 'center', marginTop: 22, gap: 12 },
  footerText: { color: '#E6E6EA', fontSize: 15, fontWeight: '600' },
  legal: { color: '#8E8E93', fontSize: 12, textAlign: 'center', lineHeight: 17 },
  legalLink: { color: '#C9C9CE', textDecorationLine: 'underline' },
});
