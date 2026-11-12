// One ride: where it stands, the flight, who is driving, the price, paying by card, the receipt,
// and — after the ride — a rating and "Book again".
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import FlightCard from '../components/flight-card';
import {
  cancelRequest, isAirportText, money, money2, PHONE, PHONE_TEL, payUrl, rate, receipt, receiptText, REVIEW_URL, rideText,
  STATUS, timeLabel, whenLabel, type Ride, type RideStatus,
} from '../lib/api';
import { addRideToCalendar, calendarAvailable } from '../lib/calendar';
import { C } from '../theme';

const STEPS: { key: RideStatus; label: string }[] = [
  { key: 'requested', label: 'Requested' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'on_the_way', label: 'On the way' },
  { key: 'on_board', label: 'On board' },
  { key: 'completed', label: 'Done' },
];

type Props = { ride: Ride; onClose: () => void; onChanged: () => void; onBookAgain: (r: Ride) => void };

export default function RideScreen({ ride, onClose, onChanged, onBookAgain }: Props) {
  const [busy, setBusy] = useState<'' | 'cancel' | 'pay' | 'rate'>('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [stars, setStars] = useState(ride.rating || 0);
  const [comment, setComment] = useState('');
  const [rated, setRated] = useState(!!ride.rating);
  const s = STATUS[ride.status];
  const at = STEPS.findIndex((x) => x.key === ride.status);
  const chauffeurLine = [ride.car, ride.plate].filter(Boolean).join(' · ');
  const live = ride.status !== 'cancelled' && ride.status !== 'completed';
  const airportPickup = isAirportText(ride.pickup);
  const rc = receipt(ride);

  async function doCancel() {
    setBusy('cancel');
    setError('');
    try {
      await cancelRequest(ride.id);
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }
  function cancel() {
    if (Platform.OS === 'web') return void doCancel();
    Alert.alert('Cancel this request?', 'It has not been confirmed yet, so there is no charge.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel request', style: 'destructive', onPress: doCancel },
    ]);
  }

  /** Card payment inside the app: the open Square invoice, or a new one made right now. */
  async function pay() {
    setBusy('pay');
    setError('');
    try {
      const url = ride.pay_url || (await payUrl(ride.id));
      if (Platform.OS === 'web') await Linking.openURL(url);
      else await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
      onChanged(); // back from the payment page: Square reports the payment within a minute
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  async function sendRating() {
    if (!stars) return;
    setBusy('rate');
    setError('');
    try {
      await rate(ride.id, stars, comment.trim());
      setRated(true);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
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
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {ride.status !== 'cancelled' ? (
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
        ) : (
          <View style={[styles.card, { backgroundColor: C.redSoft }]}>
            <Text style={[styles.note, { color: C.red, marginTop: 0 }]}>{s.note} Need it after all? Call us at {PHONE}.</Text>
          </View>
        )}

        {/* rating first on a finished ride: that is what we want the rider to do next */}
        {ride.status === 'completed' && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{rated ? 'Your rating' : 'How was your ride?'}</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => !rated && setStars(n)} disabled={rated} hitSlop={6} accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}>
                  <Text style={[styles.star, n <= stars && styles.starOn]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            {!rated && stars > 0 && (
              <>
                <TextInput
                  style={styles.comment}
                  value={comment}
                  onChangeText={setComment}
                  placeholder={stars >= 4 ? 'Anything we should tell your chauffeur? (optional)' : 'What should we do better?'}
                  placeholderTextColor="#A1A1A6"
                  multiline
                />
                <TouchableOpacity style={styles.dark} onPress={sendRating} disabled={busy === 'rate'}>
                  {busy === 'rate' ? <ActivityIndicator color={C.gold} /> : <Text style={styles.darkText}>Send</Text>}
                </TouchableOpacity>
              </>
            )}
            {rated && stars === 5 && (
              <>
                <Text style={styles.hint}>Thank you! A public review helps a small local company more than anything.</Text>
                <TouchableOpacity style={styles.dark} onPress={() => Linking.openURL(REVIEW_URL)}>
                  <Text style={styles.darkText}>Leave a Google review</Text>
                </TouchableOpacity>
              </>
            )}
            {rated && stars > 0 && stars < 5 && <Text style={styles.hint}>Thank you. Andrii reads every rating personally.</Text>}
          </View>
        )}

        {ride.flight_number && (ride.flight || live) ? (
          <View style={{ marginBottom: 12 }}>
            {ride.flight ? (
              <FlightCard flight={ride.flight} flightNumber={ride.flight_number} pickupAt={ride.ride_datetime} />
            ) : (
              <View style={[styles.card, { marginBottom: 0 }]}>
                <Text style={styles.cardLabel}>Flight</Text>
                <Text style={styles.big}>{ride.flight_number}</Text>
                <Text style={styles.sub}>Live status appears here the day before the flight. We adjust the pickup if it is early or late.</Text>
              </View>
            )}
          </View>
        ) : null}

        <View style={styles.card}>
          {ride.passenger ? <Row dot="none" label="Passenger" value={ride.passenger} /> : null}
          <Row dot="black" label="Pickup" value={ride.pickup || '—'} />
          {ride.stops.map((stop, i) => (
            <Row key={i} dot="none" label={`Stop ${i + 1}`} value={stop} />
          ))}
          {ride.dropoff ? <Row dot="gold" label="Drop-off" value={ride.dropoff} /> : null}
          {ride.trip_type === 'Round trip' && ride.return_datetime ? <Row dot="none" label="Return" value={whenLabel(ride.return_datetime)} /> : null}
          {ride.trip_type === 'Hourly' && ride.hours ? <Row dot="none" label="Booked for" value={`${ride.hours} hours`} /> : null}
          {live && (
            <View style={styles.actions}>
              {calendarAvailable && ride.ride_datetime ? (
                <TouchableOpacity style={styles.action} onPress={() => addRideToCalendar(ride).then(setNote).catch((e) => setNote(e instanceof Error ? e.message : String(e)))}>
                  <Text style={styles.actionText}>Add to Calendar</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.action} onPress={() => Share.share({ message: rideText(ride) }).catch(() => {})}>
                <Text style={styles.actionText}>Share ride</Text>
              </TouchableOpacity>
            </View>
          )}
          {!!note && <Text style={styles.hint}>{note}</Text>}
        </View>

        {live && airportPickup && (
          <View style={[styles.card, styles.meet]}>
            <Text style={[styles.cardLabel, { color: C.goldText }]}>Where we meet</Text>
            <Text style={styles.meetLine}>1. After you land, switch your phone on. Your chauffeur's name and number are on this screen.</Text>
            <Text style={styles.meetLine}>2. Collect your bags. There is no rush: 60 minutes of waiting are free, 90 on international flights.</Text>
            <Text style={styles.meetLine}>3. Text or call your chauffeur when you have your bags. He tells you the exact pickup spot at your terminal and is there in a few minutes.</Text>
          </View>
        )}

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

        {/* price → pay → receipt */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{ride.paid ? 'Receipt' : ride.price_final ? 'Price' : 'Estimated price'}</Text>
          {ride.paid ? (
            <>
              {rc.lines.map((l) => (
                <View key={l.label} style={styles.rcRow}>
                  <Text style={styles.rcLabel}>{l.label}</Text>
                  <Text style={styles.rcAmount}>{money2(l.amount)}</Text>
                </View>
              ))}
              <View style={[styles.rcRow, styles.rcTotal]}>
                <Text style={styles.rcTotalLabel}>Total paid</Text>
                <Text style={styles.rcTotalAmount}>{money2(rc.total)}</Text>
              </View>
              <Text style={styles.sub}>
                {[
                  ride.paid_at ? `Paid ${new Date(ride.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Paid',
                  ride.payment_method,
                  `Ride #${ride.id}`,
                ].filter(Boolean).join(' · ')}
              </Text>
              <TouchableOpacity style={styles.wide} onPress={() => Share.share({ message: receiptText(ride) }).catch(() => {})}>
                <Text style={styles.actionText}>Share or save receipt</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{ride.price != null ? money(ride.price) : 'We will send it shortly'}</Text>
              </View>
              <Text style={styles.sub}>
                {[ride.vehicle, ride.passengers ? `${ride.passengers} passenger${ride.passengers === '1' ? '' : 's'}` : null, ride.deposit_paid ? `deposit ${money(ride.deposit_paid)} paid` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {(ride.pay_url || ride.can_pay) && ride.status !== 'cancelled' ? (
                <>
                  <TouchableOpacity style={styles.dark} onPress={pay} disabled={busy === 'pay'}>
                    {busy === 'pay' ? (
                      <ActivityIndicator color={C.gold} />
                    ) : (
                      <Text style={styles.darkText}>
                        {ride.pay_kind === 'deposit' ? 'Pay the deposit' : ride.price != null ? `Pay by card · ${money2(Math.round(ride.price * 1.035 * 100) / 100)}` : 'Pay by card'}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.hint}>
                    Secure payment by Square, with Apple Pay. The card price includes a 3.5% processing fee; you can add a gratuity there. Zelle and Venmo have no fee: text us and we send the details.
                  </Text>
                </>
              ) : ride.status === 'requested' ? (
                <Text style={styles.hint}>No payment now. You can pay here as soon as we confirm the ride.</Text>
              ) : null}
            </>
          )}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
        {!live && (
          <TouchableOpacity style={[styles.dark, { marginTop: 0, marginBottom: 12 }]} onPress={() => onBookAgain(ride)}>
            <Text style={styles.darkText}>Book this ride again</Text>
          </TouchableOpacity>
        )}
        <View style={[styles.actions, { marginTop: 0 }]}>
          <TouchableOpacity style={styles.action} onPress={() => Linking.openURL(`tel:${PHONE_TEL}`)}>
            <Text style={styles.actionText}>Call dispatch</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={() => Linking.openURL(`sms:${PHONE_TEL}`)}>
            <Text style={styles.actionText}>Text us</Text>
          </TouchableOpacity>
        </View>
        {ride.status === 'requested' && ride.booked_in_app ? (
          <TouchableOpacity style={styles.cancel} onPress={cancel} disabled={busy === 'cancel'}>
            {busy === 'cancel' ? <ActivityIndicator color={C.red} /> : <Text style={styles.cancelText}>Cancel this request</Text>}
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
  meet: { backgroundColor: C.goldSoft, borderWidth: 1, borderColor: '#E8D9A8' },
  meetLine: { fontSize: 14, color: '#5E4B14', lineHeight: 20, marginTop: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  price: { fontSize: 24, fontWeight: '800', color: C.ink },
  rcRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, gap: 12 },
  rcLabel: { fontSize: 15, color: C.text, flex: 1 },
  rcAmount: { fontSize: 15, color: C.ink, fontWeight: '600', fontVariant: ['tabular-nums'] },
  rcTotal: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, marginTop: 4, paddingTop: 10 },
  rcTotalLabel: { fontSize: 16, fontWeight: '800', color: C.ink, flex: 1 },
  rcTotalAmount: { fontSize: 20, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] },
  stars: { flexDirection: 'row', gap: 6, marginTop: 8 },
  star: { fontSize: 38, color: '#DADADF' },
  starOn: { color: C.gold },
  comment: { borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, fontSize: 15, color: C.ink, minHeight: 64, marginTop: 10, textAlignVertical: 'top' },
  dark: { backgroundColor: C.black, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 14 },
  darkText: { color: C.gold, fontSize: 16, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  action: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 12, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  actionText: { fontSize: 15, fontWeight: '800', color: C.ink },
  wide: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.line, marginTop: 12 },
  cancel: { alignItems: 'center', paddingVertical: 18 },
  cancelText: { color: C.red, fontSize: 15, fontWeight: '700' },
  footNote: { fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 16, lineHeight: 19 },
  error: { color: C.red, fontSize: 14, marginBottom: 10, lineHeight: 19, fontWeight: '600' },
});
