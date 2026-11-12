// One ride: where it stands, who is driving, the flight, the price and how to pay.
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { cancelRequest, money, PHONE, PHONE_TEL, STATUS, timeLabel, whenLabel, type Ride, type RideStatus } from '../lib/api';
import { C } from '../theme';

const STEPS: { key: RideStatus; label: string }[] = [
  { key: 'requested', label: 'Requested' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'on_the_way', label: 'On the way' },
  { key: 'on_board', label: 'On board' },
  { key: 'completed', label: 'Done' },
];

export default function RideScreen({ ride, onClose, onChanged }: { ride: Ride; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const s = STATUS[ride.status];
  const at = STEPS.findIndex((x) => x.key === ride.status);
  const chauffeurLine = [ride.car, ride.plate].filter(Boolean).join(' · ');

  async function doCancel() {
    setBusy(true);
    setError('');
    try {
      await cancelRequest(ride.id);
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  function cancel() {
    if (Platform.OS === 'web') return void doCancel();
    Alert.alert('Cancel this request?', 'It has not been confirmed yet, so there is no charge.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel request', style: 'destructive', onPress: doCancel },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.when}>{whenLabel(ride.ride_datetime)}</Text>
          <Text style={[styles.status, { color: s.color }]}>{s.label}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <Text style={styles.close}>Done</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {ride.status !== 'cancelled' && (
          <View style={styles.card}>
            <View style={styles.steps}>
              {STEPS.map((step, i) => (
                <View key={step.key} style={styles.step}>
                  <View style={[styles.stepLine, i === 0 && { opacity: 0 }, i <= at && styles.stepLineOn]} />
                  <View style={[styles.stepDot, i <= at && styles.stepDotOn]} />
                  <Text style={[styles.stepLabel, i === at && styles.stepLabelOn]} numberOfLines={1}>{step.label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.note}>{s.note}</Text>
          </View>
        )}
        {ride.status === 'cancelled' && (
          <View style={[styles.card, { backgroundColor: C.redSoft }]}>
            <Text style={[styles.note, { color: C.red, marginTop: 0 }]}>{s.note} Need it after all? Call us at {PHONE}.</Text>
          </View>
        )}

        <View style={styles.card}>
          <Row dot="black" label="Pickup" value={ride.pickup || '—'} />
          {ride.stops.map((stop, i) => (
            <Row key={i} dot="none" label={`Stop ${i + 1}`} value={stop} />
          ))}
          {ride.dropoff ? <Row dot="gold" label="Drop-off" value={ride.dropoff} /> : null}
          {ride.trip_type === 'Round trip' && ride.return_datetime ? <Row dot="none" label="Return" value={whenLabel(ride.return_datetime)} /> : null}
          {ride.trip_type === 'Hourly' && ride.hours ? <Row dot="none" label="Booked for" value={`${ride.hours} hours`} /> : null}
        </View>

        {(ride.chauffeur || chauffeurLine) && ride.status !== 'cancelled' ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Your chauffeur</Text>
            <Text style={styles.big}>{ride.chauffeur || 'Assigned soon'}</Text>
            {chauffeurLine ? <Text style={styles.sub}>{chauffeurLine}</Text> : null}
            {ride.chauffeur_phone ? (
              <View style={styles.actions}>
                <TouchableOpacity style={styles.action} onPress={() => Linking.openURL(`tel:${ride.chauffeur_phone!.replace(/[^\d+]/g, '')}`)}>
                  <Text style={styles.actionText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.action} onPress={() => Linking.openURL(`sms:${ride.chauffeur_phone!.replace(/[^\d+]/g, '')}`)}>
                  <Text style={styles.actionText}>Text</Text>
                </TouchableOpacity>
              </View>
            ) : ride.status === 'confirmed' ? (
              <Text style={styles.hint}>Call and text buttons appear here a day before the pickup.</Text>
            ) : null}
          </View>
        ) : null}

        {ride.flight_number ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Flight</Text>
            <Text style={styles.big}>{ride.flight_line || ride.flight_number}</Text>
            <Text style={styles.sub}>We track it and adjust the pickup if it is early or late.</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{ride.price_final ? 'Price' : 'Estimated price'}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{ride.price != null ? money(ride.price) : 'We will send it shortly'}</Text>
            {ride.paid ? <Text style={styles.paid}>Paid</Text> : null}
          </View>
          <Text style={styles.sub}>
            {[ride.vehicle, ride.passengers ? `${ride.passengers} passenger${ride.passengers === '1' ? '' : 's'}` : null].filter(Boolean).join(' · ')}
          </Text>
          {ride.pay_url && !ride.paid ? (
            <>
              <TouchableOpacity style={styles.pay} onPress={() => Linking.openURL(ride.pay_url!)}>
                <Text style={styles.payText}>{ride.pay_kind === 'deposit' ? 'Pay the deposit' : 'Pay by card'}</Text>
              </TouchableOpacity>
              <Text style={styles.hint}>Opens our secure Square invoice. Card payments include a 3.5% fee; Zelle and Venmo have none.</Text>
            </>
          ) : !ride.paid && ride.status !== 'cancelled' && ride.status !== 'requested' ? (
            <Text style={styles.hint}>Pay by Zelle or Venmo, or ask us for a card invoice and it will appear here.</Text>
          ) : null}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.action, styles.actionDark]} onPress={() => Linking.openURL(`tel:${PHONE_TEL}`)}>
            <Text style={[styles.actionText, { color: C.gold }]}>Call dispatch</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={() => Linking.openURL(`sms:${PHONE_TEL}`)}>
            <Text style={styles.actionText}>Text us</Text>
          </TouchableOpacity>
        </View>
        {ride.status === 'requested' && ride.booked_in_app ? (
          <TouchableOpacity style={styles.cancel} onPress={cancel} disabled={busy}>
            {busy ? <ActivityIndicator color={C.red} /> : <Text style={styles.cancelText}>Cancel this request</Text>}
          </TouchableOpacity>
        ) : ride.status === 'confirmed' ? (
          <Text style={styles.footNote}>To change or cancel a confirmed ride, call or text us. Pickup {timeLabel(ride.ride_datetime)}.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Row({ dot, label, value }: { dot: 'black' | 'gold' | 'none'; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, dot === 'gold' && { backgroundColor: C.gold }, dot === 'none' && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#C7C7CC' }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', padding: 18, paddingBottom: 12, backgroundColor: C.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  when: { fontSize: 22, fontWeight: '800', color: C.ink },
  status: { fontSize: 14, fontWeight: '800', marginTop: 3 },
  close: { fontSize: 16, fontWeight: '700', color: C.ink, paddingTop: 4 },
  body: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardLabel: { fontSize: 11.5, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.7 },
  big: { fontSize: 20, fontWeight: '800', color: C.ink, marginTop: 4 },
  sub: { fontSize: 14, color: C.muted, marginTop: 3, lineHeight: 19 },
  hint: { fontSize: 12.5, color: C.muted, marginTop: 10, lineHeight: 18 },
  note: { fontSize: 14.5, color: C.text, marginTop: 14, lineHeight: 20 },
  steps: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center' },
  stepLine: { position: 'absolute', top: 6, right: '50%', left: '-50%', height: 2, backgroundColor: '#E0E0E5' },
  stepLineOn: { backgroundColor: C.gold },
  stepDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#E0E0E5', borderWidth: 2, borderColor: '#fff' },
  stepDotOn: { backgroundColor: C.gold },
  stepLabel: { fontSize: 10.5, color: C.muted, marginTop: 6, fontWeight: '600' },
  stepLabelOn: { color: C.ink, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.ink, marginTop: 5 },
  rowLabel: { fontSize: 11.5, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  rowValue: { fontSize: 16, color: C.ink, fontWeight: '600', marginTop: 2, lineHeight: 21 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  price: { fontSize: 24, fontWeight: '800', color: C.ink },
  paid: { fontSize: 12.5, fontWeight: '800', color: C.green, backgroundColor: C.greenSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  pay: { backgroundColor: C.black, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 14 },
  payText: { color: C.gold, fontSize: 16, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  action: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  actionDark: { backgroundColor: C.black, borderColor: C.black },
  actionText: { fontSize: 15.5, fontWeight: '800', color: C.ink },
  cancel: { alignItems: 'center', paddingVertical: 18 },
  cancelText: { color: C.red, fontSize: 15, fontWeight: '700' },
  footNote: { fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 16, lineHeight: 19 },
  error: { color: C.red, fontSize: 14, marginBottom: 4, lineHeight: 19, fontWeight: '600' },
});
