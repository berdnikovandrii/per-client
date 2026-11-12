// Account: name and mobile (what the chauffeur sees), legal links, sign out, delete the account.
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import AddressInput, { placesDebug } from '../components/address-input';
import { deleteAccount, PHONE, PHONE_TEL, savePlaces, saveProfile, SITE, type Me, type Place } from '../lib/api';
import { supabase } from '../lib/supabase';
import { C } from '../theme';

export default function AccountScreen({ me, onSaved }: { me: Me; onSaved: () => void }) {
  const [name, setName] = useState(me.name || '');
  const [phone, setPhone] = useState(me.phone || '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const changed = name.trim() !== (me.name || '') || phone.trim() !== (me.phone || '');
  const [places, setPlaces] = useState<Place[]>(me.places);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');

  async function keepPlaces(next: Place[]) {
    setPlaces(next);
    try {
      await savePlaces(next);
      onSaved();
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  }
  function addPlace() {
    if (!label.trim() || !address.trim()) return;
    keepPlaces([...places, { label: label.trim(), address: address.trim() }].slice(0, 8));
    setLabel('');
    setAddress('');
  }

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

      <Text style={styles.section}>Saved places</Text>
      <View style={styles.card}>
        {places.map((pl, i) => (
          <View key={`${pl.label}:${i}`} style={styles.place}>
            <View style={{ flex: 1 }}>
              <Text style={styles.placeLabel}>{pl.label}</Text>
              <Text style={styles.placeAddress} numberOfLines={2}>{pl.address}</Text>
            </View>
            <TouchableOpacity onPress={() => keepPlaces(places.filter((_, j) => j !== i))} hitSlop={10} accessibilityLabel={`Remove ${pl.label}`}>
              <Text style={styles.placeRemove}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
        {places.length < 8 && (
          <View style={{ paddingVertical: 8 }}>
            <Text style={styles.label}>Name of the place</Text>
            <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Home, Office, Hotel…" placeholderTextColor="#A1A1A6" maxLength={30} />
            <View style={[styles.divider, { marginBottom: 8 }]} />
            <AddressInput bare label="Address" value={address} onChange={setAddress} placeholder="Start typing the address" />
            <TouchableOpacity style={[styles.add, (!label.trim() || !address.trim()) && { opacity: 0.4 }]} onPress={addPlace} disabled={!label.trim() || !address.trim()}>
              <Text style={styles.addText}>Save this place</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <Text style={styles.small}>Saved places appear as one-tap buttons when you book.</Text>

      {me.referral_offer && me.ref_code ? (
        <>
          <Text style={styles.section}>Invite a friend</Text>
          <View style={[styles.card, styles.invite]}>
            <Text style={styles.inviteCode}>{me.ref_code}</Text>
            <Text style={styles.inviteText}>{me.referral_offer}</Text>
            {me.referrals > 0 ? <Text style={styles.inviteCount}>{me.referrals} {me.referrals === 1 ? 'friend has' : 'friends have'} used your code</Text> : null}
            <TouchableOpacity
              style={styles.add}
              onPress={() =>
                Share.share({ message: `I ride with Pacific Elite Rides in San Diego. Use my code ${me.ref_code} when you book your first ride in the app: ${SITE}` }).catch(() => {})
              }
            >
              <Text style={styles.addText}>Share my code</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

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
      <Version />
    </ScrollView>
  );
}

/** The Account tab before signing in: what an account is for, the way in, and everything that needs no account. */
export function GuestAccount({ onSignIn }: { onSignIn: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.email}>You are browsing as a guest</Text>
      <View style={[styles.card, { paddingVertical: 16 }]}>
        <Text style={styles.guestTitle}>Sign in with your email</Text>
        <Text style={styles.guestText}>No password: we email you a 6-digit code. With an account you can follow your rides, save your addresses, pay by card and keep your receipts.</Text>
        <TouchableOpacity style={[styles.save, { marginTop: 14, marginBottom: 0 }]} onPress={onSignIn}>
          <Text style={styles.saveText}>Sign in</Text>
        </TouchableOpacity>
      </View>
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
      <Version />
    </ScrollView>
  );
}

/** The version line. A long press shows what support needs to know: the update this phone runs and what the
 *  address lookup last answered. No secrets: only whether a Places key is present. */
function Version() {
  const details = () => {
    const lines = [
      `Version ${Constants.expoConfig?.version || '?'} · ${Platform.OS}`,
      `Update: ${Updates.updateId ? Updates.updateId.slice(0, 8) : 'built-in'} · channel ${Updates.channel || '—'} · runtime ${Updates.runtimeVersion || '—'}`,
      `Address key: ${placesDebug.hasKey ? `yes (${placesDebug.keyLength} characters)` : 'NO'}`,
      `Address lookups: ${placesDebug.calls}`,
      `Last answer: ${placesDebug.last}`,
    ];
    if (Platform.OS === 'web') console.log(lines.join('\n'));
    else Alert.alert('App details', lines.join('\n\n'));
  };
  return (
    <Text style={styles.version} onLongPress={details} suppressHighlighting>
      Pacific Elite Rides {Constants.expoConfig?.version || ''} · TCP 35857B
    </Text>
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
  section: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 6, marginBottom: 8, marginLeft: 4 },
  small: { fontSize: 12.5, color: C.muted, marginTop: -6, marginBottom: 14, marginLeft: 4 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  placeLabel: { fontSize: 16, fontWeight: '800', color: C.ink },
  placeAddress: { fontSize: 13.5, color: C.muted, marginTop: 2 },
  placeRemove: { color: C.red, fontSize: 13, fontWeight: '700' },
  add: { backgroundColor: C.black, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 10, marginBottom: 6 },
  addText: { color: C.gold, fontSize: 15, fontWeight: '800' },
  invite: { backgroundColor: C.goldSoft, borderWidth: 1, borderColor: '#E8D9A8', paddingVertical: 14 },
  inviteCode: { fontSize: 26, fontWeight: '800', color: C.ink, letterSpacing: 2 },
  inviteText: { fontSize: 14.5, color: '#5E4B14', marginTop: 6, lineHeight: 20 },
  inviteCount: { fontSize: 13, color: C.goldText, fontWeight: '700', marginTop: 6 },
  guestTitle: { fontSize: 18, fontWeight: '800', color: C.ink },
  guestText: { fontSize: 14.5, color: C.text, lineHeight: 21, marginTop: 6 },
  version: { textAlign: 'center', color: C.muted, fontSize: 12.5, marginTop: 8 },
});
