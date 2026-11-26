// Account: name and mobile (what the chauffeur sees), legal links, sign out, delete the account.
import { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import AddressInput, { placesDebug } from '../components/address-input';
import Icon, { type IconName } from '../components/icon';
import { Card, Field, GhostButton, GoldButton, haptic, Label, Medal, Rise, T, Tap } from '../components/ui';
import { deleteAccount, PHONE, PHONE_TEL, savePlaces, saveProfile, SITE, type Me, type Place } from '../lib/api';
import { shareText, webConfirm } from '../lib/layout';
import { supabase } from '../lib/supabase';
import { C, SERIF, TAB_SPACE } from '../theme';

const placeIcon = (label: string): IconName => (/home/i.test(label) ? 'home' : /office|work/i.test(label) ? 'briefcase' : 'pin');

export default function AccountScreen({ me, onSaved, wide }: { me: Me; onSaved: () => void; /** website layout: the profile on the left, help and sign-out on the right */ wide?: boolean }) {
  const [name, setName] = useState(me.name || '');
  const [phone, setPhone] = useState(me.phone || '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const changed = name.trim() !== (me.name || '') || phone.trim() !== (me.phone || '');
  const [places, setPlaces] = useState<Place[]>(me.places);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [adding, setAdding] = useState(false);
  const insets = useSafeAreaInsets();

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
    setAdding(false);
  }

  async function save() {
    setBusy(true);
    setNote('');
    try {
      await saveProfile(name.trim(), phone.trim());
      onSaved();
      haptic.success();
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
    if (Platform.OS === 'web') {
      if (webConfirm('Delete your account? Your sign-in and profile are removed right away. Rides you already took stay in our records, as the law requires for a licensed carrier, without a link to this account.')) void reallyDelete();
      return;
    }
    Alert.alert(
      'Delete your account?',
      'Your sign-in, profile and this phone\'s notifications are removed right away. Rides you already took stay in our records, as the law requires for a licensed carrier, without a link to this account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: reallyDelete },
      ]
    );
  }

  const main = (
    <>
      <Rise style={{ gap: 12 }}>
        <View style={styles.pair}>
          <Field label="Name" value={name} onChangeText={setName} placeholder="First and last name" textContentType="name" style={{ flex: 1 }} />
          <Field label="Mobile" value={phone} onChangeText={setPhone} placeholder="(619) 555-1234" keyboardType="phone-pad" autoCorrect={false} style={{ flex: 1 }} />
        </View>
        {changed ? <GoldButton label="Save" onPress={save} busy={busy} height={50} /> : note ? <Text style={[styles.saved, note !== 'Saved' && { color: C.red }]}>{note === 'Saved' ? '✓ Saved' : note}</Text> : null}
      </Rise>

      <Rise delay={100} style={{ gap: 10 }}>
        <Label>Saved places</Label>
        <Card gold style={{ padding: 0 }}>
          {places.map((pl, i) => (
            <View key={`${pl.label}:${i}`} style={[styles.place, styles.rowLine]}>
              <Icon name={placeIcon(pl.label)} size={22} color={C.goldHi} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.placeLabel}>{pl.label}</Text>
                <Text style={styles.placeAddress} numberOfLines={2}>{pl.address}</Text>
              </View>
              <Tap onPress={() => keepPlaces(places.filter((_, j) => j !== i))} hitSlop={6} style={styles.placeRemove} accessibilityRole="button" accessibilityLabel={`Remove ${pl.label}`}>
                <Text style={styles.placeRemoveText}>Remove</Text>
              </Tap>
            </View>
          ))}
          {places.length < 8 && !adding ? (
            <Tap style={styles.addRow} to={0.99} onPress={() => setAdding(true)} accessibilityRole="button">
              <Icon name="plusCircle" size={22} color={C.goldText} />
              <Text style={styles.addText}>{places.length ? 'Save another place' : 'Save a place'}</Text>
            </Tap>
          ) : null}
          {places.length < 8 && adding ? (
            <View style={styles.addForm}>
              <Field label="Name of the place" value={label} onChangeText={setLabel} placeholder="Home, Office, Hotel…" maxLength={30} />
              <AddressInput bare label="Address" value={address} onChange={setAddress} placeholder="Start typing the address" />
              <View style={styles.pair}>
                <GhostButton label="Cancel" style={{ flex: 1, height: 50, borderRadius: 25 }} onPress={() => setAdding(false)} />
                <GoldButton label="Save this place" height={50} style={{ flex: 1.4, shadowOpacity: 0 }} onPress={addPlace} disabled={!label.trim() || !address.trim()} />
              </View>
            </View>
          ) : null}
        </Card>
        <Text style={T.small}>Saved places appear as one-tap buttons when you book.</Text>
      </Rise>

      {me.referral_offer && me.ref_code ? (
        <Rise delay={160} style={{ gap: 10 }}>
          <Label>Invite a friend</Label>
          <Card gold style={{ gap: 10 }}>
            <Text style={styles.inviteCode}>{me.ref_code}</Text>
            <Text style={styles.inviteText}>{me.referral_offer}</Text>
            {me.referrals > 0 ? <Text style={styles.inviteCount}>{me.referrals} {me.referrals === 1 ? 'friend has' : 'friends have'} used your code</Text> : null}
            <GhostButton
              label="Share my code"
              icon="gift"
              onPress={() => shareText(`I ride with Pacific Elite Rides in San Diego. Use my code ${me.ref_code} when you book your first ride in the app: ${SITE}`).catch(() => {})}
            />
          </Card>
        </Rise>
      ) : null}
    </>
  );
  const side = (
      <Rise delay={200} style={{ gap: 12 }}>
        <Help />
        <Legal />
        <View style={styles.list}>
          <Link text="Sign out" icon="signOut" onPress={() => supabase.auth.signOut()} />
          <Link text="Delete my account" icon="trash" danger last onPress={askDelete} />
        </View>
        <Version />
      </Rise>
  );

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={[styles.body, { paddingTop: insets.top + 14, paddingBottom: wide ? 48 : TAB_SPACE + insets.bottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View>
        <Text style={T.title} accessibilityRole="header">Account</Text>
        <Text style={styles.email}>{me.email}</Text>
      </View>

      {wide ? (
        <View style={styles.wideRow}>
          <View style={styles.wideMain}>{main}</View>
          <View style={styles.wideSide}>{side}</View>
        </View>
      ) : (
        <>
          {main}
          {side}
        </>
      )}
    </ScrollView>
  );
}

/** The Account tab before signing in: what an account is for, the way in, and everything that needs no account. */
export function GuestAccount({ onSignIn }: { onSignIn: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={[styles.body, { paddingTop: insets.top + 14, paddingBottom: TAB_SPACE + insets.bottom }]} showsVerticalScrollIndicator={false}>
      <View>
        <Text style={T.title} accessibilityRole="header">Account</Text>
        <Text style={styles.email}>You are browsing as a guest</Text>
      </View>
      <Rise>
        <Card gold style={{ alignItems: 'center', paddingVertical: 26 }}>
          <Medal icon="mail" />
          <Text style={styles.guestTitle}>Sign in with your email</Text>
          <Text style={styles.guestText}>No password: we email you a 6-digit code. With an account you can follow your rides, save your addresses, pay by card and keep your receipts.</Text>
          <GoldButton label="Sign in" onPress={onSignIn} style={{ alignSelf: 'stretch', marginTop: 20 }} />
        </Card>
      </Rise>
      <Rise delay={100} style={{ gap: 12 }}>
        <Help />
        <Legal />
        <Version />
      </Rise>
    </ScrollView>
  );
}

function Help() {
  return (
    <View style={styles.list}>
      <Link text={`Call dispatch · ${PHONE}`} icon="phone" onPress={() => Linking.openURL(`tel:${PHONE_TEL}`)} />
      <Link text="Text us" icon="message" onPress={() => Linking.openURL(`sms:${PHONE_TEL}`)} />
      <Link text="Rates and services" icon="receipt" last onPress={() => Linking.openURL(`${SITE}/services.html`)} />
    </View>
  );
}

function Legal() {
  return (
    <View style={styles.list}>
      <Link text="Privacy Policy" icon="lock" onPress={() => Linking.openURL(`${SITE}/privacy.html`)} />
      <Link text="Terms of Service" icon="info" last onPress={() => Linking.openURL(`${SITE}/terms.html`)} />
    </View>
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

function Link({ text, onPress, danger, icon, last }: { text: string; onPress: () => void; danger?: boolean; icon: IconName; last?: boolean }) {
  return (
    <Tap style={[styles.link, !last && styles.rowLine]} to={0.99} onPress={onPress} accessibilityRole="button" accessibilityLabel={text}>
      <Icon name={icon} size={20} color={danger ? C.red : C.goldText} />
      <Text style={[styles.linkText, danger && { color: C.red }]}>{text}</Text>
      {danger ? null : <Icon name="chevron" size={16} color="#7D7A73" stroke={2} />}
    </Tap>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, gap: 22 },
  wideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 40 },
  wideMain: { flex: 1, gap: 22 },
  wideSide: { width: 380 },
  email: { fontSize: 15, color: C.muted, marginTop: 4 },
  pair: { flexDirection: 'row', gap: 12 },
  saved: { fontSize: 14, fontWeight: '600', color: C.green, textAlign: 'center' },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineHi },
  place: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 6, paddingVertical: 10 },
  placeLabel: { fontSize: 15, fontWeight: '600', color: C.ink },
  placeAddress: { fontSize: 12.5, lineHeight: 17, color: '#B9B3A6' },
  placeRemove: { height: 44, justifyContent: 'center', paddingHorizontal: 10 },
  placeRemoveText: { fontSize: 13, color: '#B9B3A6' },
  addRow: { height: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  addText: { fontSize: 15, fontWeight: '600', color: C.goldText },
  addForm: { padding: 16, gap: 14 },
  inviteCode: { ...SERIF, fontSize: 34, lineHeight: 38, letterSpacing: 3, color: C.goldHi },
  inviteText: { fontSize: 14.5, lineHeight: 20, color: C.text },
  inviteCount: { fontSize: 13, color: C.goldText, fontWeight: '600' },
  list: { borderRadius: 22, backgroundColor: C.cardLo, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16 },
  link: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 14 },
  linkText: { flex: 1, fontSize: 15, color: C.ink },
  guestTitle: { ...T.h2, fontSize: 28, lineHeight: 32, marginTop: 16, textAlign: 'center' },
  guestText: { ...T.body, color: C.muted, textAlign: 'center', marginTop: 8 },
  version: { textAlign: 'center', color: C.faint, fontSize: 12.5, marginTop: 4 },
});
