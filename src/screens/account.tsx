// Account: name and mobile (what the chauffeur sees), legal links, sign out, delete the account.
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import { deleteAccount, PHONE, PHONE_TEL, saveProfile, SITE, type Me } from '../lib/api';
import { supabase } from '../lib/supabase';
import { C } from '../theme';

export default function AccountScreen({ me, onSaved }: { me: Me; onSaved: () => void }) {
  const [name, setName] = useState(me.name || '');
  const [phone, setPhone] = useState(me.phone || '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const changed = name.trim() !== (me.name || '') || phone.trim() !== (me.phone || '');

  async function save() {
    setBusy(true);
    setNote('');
    try {
      await saveProfile(name.trim(), phone.trim());
      onSaved();
      setNote('Saved');
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function reallyDelete() {
    setBusy(true);
    try {
      await deleteAccount();
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }
  function askDelete() {
    if (Platform.OS === 'web') return void reallyDelete();
    Alert.alert(
      'Delete your account?',
      'Your sign-in, profile and this phone\'s notifications are removed right away. Rides you already took stay in our records, as the law requires for a licensed carrier, without a link to this account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: reallyDelete },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Account</Text>
      <Text style={styles.email}>{me.email}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="First and last name" placeholderTextColor="#A1A1A6" />
        <View style={styles.divider} />
        <Text style={[styles.label, { marginTop: 10 }]}>Mobile</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="(619) 555-1234" placeholderTextColor="#A1A1A6" keyboardType="phone-pad" />
      </View>
      {(changed || !!note) && (
        <TouchableOpacity style={[styles.save, !changed && { backgroundColor: 'transparent' }]} onPress={save} disabled={busy || !changed}>
          {busy ? <ActivityIndicator color={C.gold} /> : <Text style={[styles.saveText, !changed && { color: C.green }]}>{changed ? 'Save' : note}</Text>}
        </TouchableOpacity>
      )}

      <View style={styles.card}>
        <Link text={`Call dispatch · ${PHONE}`} onPress={() => Linking.openURL(`tel:${PHONE_TEL}`)} />
        <View style={styles.divider} />
        <Link text="Text us" onPress={() => Linking.openURL(`sms:${PHONE_TEL}`)} />
        <View style={styles.divider} />
        <Link text="Rates and services" onPress={() => Linking.openURL(`${SITE}/services.html`)} />
      </View>
      <View style={styles.card}>
        <Link text="Privacy Policy" onPress={() => Linking.openURL(`${SITE}/privacy.html`)} />
        <View style={styles.divider} />
        <Link text="Terms of Service" onPress={() => Linking.openURL(`${SITE}/terms.html`)} />
      </View>
      <View style={styles.card}>
        <Link text="Sign out" onPress={() => supabase.auth.signOut()} />
        <View style={styles.divider} />
        <Link text="Delete my account" danger onPress={askDelete} />
      </View>
      <Text style={styles.version}>Pacific Elite Rides {Constants.expoConfig?.version || ''} · TCP 35857B</Text>
    </ScrollView>
  );
}

function Link({ text, onPress, danger }: { text: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={styles.link} onPress={onPress}>
      <Text style={[styles.linkText, danger && { color: C.red }]}>{text}</Text>
      <Text style={styles.chev}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 30, fontWeight: '800', color: C.ink },
  email: { fontSize: 15, color: C.muted, marginTop: 4, marginBottom: 14 },
  card: { backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 12 },
  label: { fontSize: 11.5, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8 },
  input: { fontSize: 17, color: C.ink, paddingVertical: 8, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },
  save: { backgroundColor: C.black, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  saveText: { color: C.gold, fontSize: 16, fontWeight: '800' },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  linkText: { fontSize: 16, fontWeight: '600', color: C.ink },
  chev: { fontSize: 20, color: '#C7C7CC' },
  version: { textAlign: 'center', color: C.muted, fontSize: 12.5, marginTop: 8 },
});
