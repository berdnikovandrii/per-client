// Book a ride: where, when, how many, which car — with the price right away when the rate card knows it.
// The request goes to dispatch as a lead; the rider gets a push when it is confirmed.
// A guest can fill in everything and see the price; the email code is asked only at "Request this ride".
import { useEffect, useMemo, useState } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AddressInput, { ADDRESS_DOT_Y, QuickPicks } from '../components/address-input';
import { WhenField, WhenPicker } from '../components/when-input';
import Icon from '../components/icon';
import { Card, Field, GoldButton, haptic, Medal, Rise, RouteRail, Segment, Stepper, T, Tap } from '../components/ui';
import { trackBooking } from '../lib/analytics';
import { book, money, PHONE, type Booking, type Me } from '../lib/api';
import { estimate, INCLUDED, isAirportPlace, VEHICLES, type VehicleKey } from '../lib/estimate';
import { CAR_PHOTO } from '../lib/photos';
import { supabase } from '../lib/supabase';
import Login from './login';
import { C, SERIF } from '../theme';

export type Prefill = { pickup?: string; dropoff?: string; tripType?: Booking['trip_type']; stops?: string[]; passengers?: number; vehicle?: VehicleKey; hours?: number };

// Meet & greet at baggage claim is a paid extra, $25; the default airport pickup is curbside (Andrii, 2026-11-25).
// It is offered only when a pickup is at an airport, and its price is part of the price the rider sees.
const GREET = 'Meet & greet at baggage claim (+$25)';
const GREET_FEE = 25;
const EXTRAS = ['Child seat', GREET, 'Extra luggage', 'Pet on board'];

const TRIPS: Booking['trip_type'][] = ['One way', 'Round trip', 'Hourly'];
const isAirport = isAirportPlace;

/** Next full half hour, at least 3 hours from now. */
function defaultWhen() {
  const d = new Date(Date.now() + 3 * 3_600_000);
  d.setMinutes(d.getMinutes() <= 30 ? 30 : 60, 0, 0);
  return d;
}

export default function BookScreen({ me, prefill, first, embedded, onClose, onBooked }: { me: Me; prefill?: Prefill; /** no rides yet: offer the invite-code field */ first?: boolean; /** the form sits in a card on the page (website layout): no Close */ embedded?: boolean; onClose: () => void; onBooked: (id: number) => void }) {
  const [tripType, setTripType] = useState<Booking['trip_type']>(prefill?.tripType || 'One way');
  const [pickup, setPickup] = useState(prefill?.pickup || '');
  const [dropoff, setDropoff] = useState(prefill?.dropoff || '');
  const [stops, setStops] = useState<string[]>(prefill?.stops || []);
  const [when, setWhen] = useState(defaultWhen);
  const [back, setBack] = useState(() => new Date(defaultWhen().getTime() + 3 * 86_400_000));
  const [hours, setHours] = useState(prefill?.hours || 3);
  const [passengers, setPassengers] = useState(prefill?.passengers || 2);
  const [vehicle, setVehicle] = useState<VehicleKey>(prefill?.vehicle || 'SUV');
  const [extras, setExtras] = useState<string[]>([]);
  const [forOther, setForOther] = useState(false);
  const [passengerName, setPassengerName] = useState('');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [refCode, setRefCode] = useState('');
  const [flight, setFlight] = useState('');
  const [note, setNote] = useState('');
  const [name, setName] = useState(me.name || '');
  const [phone, setPhone] = useState(me.phone || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<number | null>(null);
  const [askSignIn, setAskSignIn] = useState(false);
  const insets = useSafeAreaInsets();
  const [picking, setPicking] = useState<'' | 'when' | 'back'>('');
  const [dropY, setDropY] = useState(0); // where the drop-off field starts: the route line ends at its dot
  // while the keyboard is up, the bottom bar shrinks to the price line so the form keeps its room
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setTyping(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setTyping(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const minHours = vehicle === 'Sprinter' ? 4 : 2;
  const shownHours = Math.max(minHours, hours);
  const est = useMemo(
    () => estimate({ pickup, dropoff, stops, tripType, hours: tripType === 'Hourly' ? shownHours : null, vehicle, passengers }),
    [pickup, dropoff, stops, tripType, shownHours, vehicle, passengers]
  );
  const seats = VEHICLES.find((v) => v.key === vehicle)!.seats;
  // The Sprinter Party Bus does not do airport rides (Andrii, 2026-11-22): with an airport anywhere on the route
  // it cannot be picked, and a Sprinter picked earlier goes back to the SUV
  const airportRide = [pickup, dropoff, ...stops].some(isAirport);
  useEffect(() => {
    if (airportRide && vehicle === 'Sprinter') setVehicle('SUV');
  }, [airportRide, vehicle]);

  const greetOffered = isAirport(pickup) || (tripType === 'Round trip' && isAirport(dropoff));
  useEffect(() => {
    if (!greetOffered) setExtras((list) => (list.includes(GREET) ? list.filter((x) => x !== GREET) : list));
  }, [greetOffered]);
  const greetFee = extras.includes(GREET) ? GREET_FEE : 0;
  const total = est?.amount != null ? est.amount + greetFee : null;

  function pickVehicle(key: VehicleKey) {
    if (key === 'Sprinter' && airportRide) return;
    setVehicle(key);
    if (key === 'Sprinter') setTripType('Hourly');
  }

  async function send() {
    Keyboard.dismiss();
    setError('');
    if (!pickup.trim()) return setError('Where should we pick you up?');
    if (tripType !== 'Hourly' && !dropoff.trim()) return setError('Where are you going?');
    if (when.getTime() < Date.now() + 30 * 60_000) return setError(`For a ride this soon please call us at ${PHONE}.`);
    if (tripType === 'Round trip' && back.getTime() <= when.getTime()) return setError('The return must be after the pickup.');
    if (!name.trim()) return setError('Please add your name.');
    if (phone.replace(/\D/g, '').length < 10) return setError('Please add your mobile number, so the chauffeur can reach you.');
    if (forOther && !passengerName.trim()) return setError("Please add the passenger's name.");
    if (forOther && passengerPhone.replace(/\D/g, '').length < 10) return setError("Please add the passenger's mobile number, so the chauffeur can reach them.");
    // a guest signs in here, once everything else is filled in; send() runs again right after the code
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) return setAskSignIn(true);
    setBusy(true);
    try {
      const id = await book({
        name: name.trim(),
        phone: phone.trim(),
        pickup: pickup.trim(),
        dropoff: dropoff.trim(),
        stops: stops.map((s) => s.trim()).filter(Boolean),
        when: when.toISOString(),
        return_when: tripType === 'Round trip' ? back.toISOString() : null,
        trip_type: tripType,
        hours: tripType === 'Hourly' ? shownHours : null,
        vehicle: VEHICLES.find((v) => v.key === vehicle)!.crm,
        passengers,
        flight_number: flight.trim(),
        note: note.trim(),
        estimate: total,
        passenger_name: forOther ? passengerName.trim() : '',
        passenger_phone: forOther ? passengerPhone.trim() : '',
        extras,
        ref: first ? refCode.trim() : '',
      });
      haptic.success();
      trackBooking(total);
      setDone(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (askSignIn) {
    return (
      <Login
        reason="One last step: we email you a 6-digit code, then your request is sent. This is also how you follow the ride and get your receipt."
        onCancel={() => setAskSignIn(false)}
        onDone={() => {
          setAskSignIn(false);
          send();
        }}
      />
    );
  }

  if (done != null) {
    return (
      <View style={styles.doneScreen}>
        <Medal icon="check" pop />
        <Rise delay={150} style={{ alignItems: 'center', alignSelf: 'stretch' }}>
          <Text style={styles.doneTitle}>Request sent</Text>
          <Text style={styles.doneText}>
            We are checking the schedule now and will confirm shortly{total ? ` at ${money(total)}` : ' with your price'}. You will get a
            notification, and the ride appears under My rides.
          </Text>
          <GoldButton label="See my rides" arrow onPress={() => onBooked(done)} style={{ alignSelf: 'stretch', marginTop: 28 }} />
        </Rise>
      </View>
    );
  }

  const airport = isAirport(pickup) || isAirport(dropoff);
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, Platform.OS !== 'ios' && { paddingTop: insets.top + 14 }]}>
        <Text style={[T.title, { fontSize: embedded ? 32 : 38 }]} accessibilityRole="header">Book a ride</Text>
        {embedded ? null : (
          <Tap onPress={onClose} hitSlop={10} style={styles.close} accessibilityRole="button">
            <Text style={styles.closeText}>Close</Text>
          </Tap>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Segment
          items={TRIPS}
          value={tripType}
          onChange={(t) => {
            setTripType(t);
            setPicking('');
            if (t !== 'Hourly' && vehicle === 'Sprinter') setVehicle('SUV');
          }}
        />

        <Rise>
          <Card gold style={styles.route}>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <View style={{ width: 9, paddingTop: ADDRESS_DOT_Y - 4.5 }}>{dropY > 0 ? <RouteRail height={dropY + 9} grow /> : null}</View>
              <View style={{ flex: 1 }}>
                <AddressInput label="Pickup" value={pickup} onChange={setPickup} placeholder="Address, hotel or airport" places={me.places} />
                {stops.map((st, i) => (
                  <View key={i} style={styles.stopRow}>
                    <View style={{ flex: 1 }}>
                      <AddressInput label={`Stop ${i + 1}`} value={st} onChange={(t) => setStops((list) => list.map((x, j) => (j === i ? t : x)))} placeholder="Address of the stop" quick={false} />
                    </View>
                    <Tap onPress={() => setStops((list) => list.filter((_, j) => j !== i))} hitSlop={8} style={{ height: 44, justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel={`Remove stop ${i + 1}`}>
                      <Text style={styles.remove}>Remove</Text>
                    </Tap>
                  </View>
                ))}
                <View onLayout={(e) => setDropY(e.nativeEvent.layout.y)}>
                  <AddressInput
                    label={tripType === 'Hourly' ? 'Drop-off (optional)' : 'Drop-off'}
                    value={dropoff}
                    onChange={setDropoff}
                    placeholder={tripType === 'Hourly' ? 'Where the ride ends' : 'Address, hotel or airport'}
                    quick={false}
                  />
                </View>
              </View>
            </View>
            <View style={{ marginLeft: 23 }}>
              {!dropoff.trim() ? <QuickPicks places={me.places} onPick={setDropoff} /> : null}
              {stops.length < 3 && tripType !== 'Hourly' ? (
                <Tap onPress={() => setStops((list) => [...list, ''])} style={styles.addStop} accessibilityRole="button">
                  <Text style={styles.addStopText}>+ Add a stop</Text>
                </Tap>
              ) : <View style={{ height: 10 }} />}
            </View>
          </Card>
        </Rise>

        <View style={styles.pair}>
          <WhenField label="Pickup time" value={when} onChange={setWhen} min={new Date()} open={picking === 'when'} onToggle={() => setPicking((p) => (p === 'when' ? '' : 'when'))} style={{ flex: 1.55 }} />
          <Stepper
            label="Passengers"
            value={passengers}
            min={1}
            max={14}
            style={{ flex: 1 }}
            onChange={(n) => {
              setPassengers(n);
              if (n > 6 && vehicle === 'SUV' && tripType === 'Hourly' && !airportRide) setVehicle('Sprinter');
            }}
          />
        </View>
        {picking === 'when' ? <WhenPicker value={when} onChange={setWhen} min={new Date()} onDone={() => setPicking('')} /> : null}
        {passengers > seats ? <Text style={styles.over}>More than {seats} for this car: we will send two SUVs{airportRide ? '' : ' or the Sprinter'} and confirm the price.</Text> : null}
        {tripType === 'Round trip' && (
          <>
            <WhenField label="Return" value={back} onChange={setBack} min={when} open={picking === 'back'} onToggle={() => setPicking((p) => (p === 'back' ? '' : 'back'))} />
            {picking === 'back' ? <WhenPicker value={back} onChange={setBack} min={when} onDone={() => setPicking('')} /> : null}
          </>
        )}
        {tripType === 'Hourly' && <Stepper label="Hours" value={shownHours} min={minHours} max={12} onChange={setHours} note={`${minHours} h minimum`} />}

        <View style={{ gap: 8 }}>
          <Text style={T.fieldLabel}>Vehicle</Text>
          <View style={styles.pair}>
            {VEHICLES.map((v) => {
              const on = vehicle === v.key;
              const off = v.key === 'Sprinter' && airportRide;
              const line = off ? 'Not available for airport rides' : v.line;
              return (
                <Tap key={v.key} style={[styles.vehicle, on && styles.vehicleOn, off && { opacity: 0.45 }]} feedback="select" disabled={off} onPress={() => pickVehicle(v.key)} accessibilityRole="button" accessibilityLabel={`${v.name}. ${line}`} accessibilityState={{ selected: on, disabled: off }}>
                  <Image source={CAR_PHOTO[v.key]} style={[styles.vehiclePhoto, !on && { opacity: 0.7 }]} resizeMode="cover" accessibilityIgnoresInvertColors />
                  {on ? (
                    <View style={styles.vehicleCheck}>
                      <Icon name="check" size={12} color={C.onGold} stroke={2.6} />
                    </View>
                  ) : null}
                  <Text style={styles.vehicleName}>{v.name}</Text>
                  <Text style={styles.vehicleLine}>{line}</Text>
                </Tap>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={T.fieldLabel}>Extras</Text>
          <View style={styles.extras}>
            {EXTRAS.filter((x) => x !== GREET || greetOffered).map((x) => {
              const on = extras.includes(x);
              return (
                <Tap key={x} style={[styles.extra, on && styles.extraOn]} feedback="select" onPress={() => setExtras((list) => (on ? list.filter((y) => y !== x) : [...list, x]))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={x}>
                  {on ? <Icon name="check" size={14} color={C.onGold} stroke={2.6} /> : null}
                  <Text style={[styles.extraText, on && styles.extraTextOn]}>{x}</Text>
                </Tap>
              );
            })}
          </View>
        </View>

        {airport ? <Field label="Flight number" value={flight} onChangeText={(t) => setFlight(t.toUpperCase())} placeholder="e.g. UA444 — we track delays" autoCapitalize="characters" autoCorrect={false} /> : null}
        <Field label="Note for the chauffeur" value={note} onChangeText={setNote} placeholder="Luggage, child seat, gate code…" multiline />

        <View style={{ gap: 12, marginTop: 6 }}>
          <Text style={T.h2}>Your details</Text>
          <Field label="Name" value={name} onChangeText={setName} placeholder="First and last name" textContentType="name" />
          <Field label="Mobile" value={phone} onChangeText={setPhone} placeholder="(619) 555-1234" keyboardType="phone-pad" textContentType="telephoneNumber" autoCorrect={false} />
          <Tap style={styles.other} onPress={() => setForOther((v) => !v)} feedback="select" to={0.99} accessibilityRole="checkbox" accessibilityState={{ checked: forOther }}>
            <View style={[styles.check, forOther && styles.checkOn]}>{forOther ? <Icon name="check" size={14} color={C.onGold} stroke={2.6} /> : null}</View>
            <Text style={styles.otherText}>I am booking for someone else</Text>
          </Tap>
          {forOther && (
            <>
              <Field label="Passenger name" value={passengerName} onChangeText={setPassengerName} placeholder="Who is riding" />
              <Field label="Passenger mobile" value={passengerPhone} onChangeText={setPassengerPhone} placeholder="The chauffeur calls this number" keyboardType="phone-pad" autoCorrect={false} />
            </>
          )}
          {first && <Field label="Invite code (optional)" value={refCode} onChangeText={(t) => setRefCode(t.toUpperCase())} placeholder="A friend's code, if you have one" autoCapitalize="characters" autoCorrect={false} />}
        </View>

        <View style={styles.terms}>
          {est ? <Text style={styles.termsLead}>{est.basis}{greetFee && est.amount != null ? ` + $${GREET_FEE} meet & greet` : ''}</Text> : null}
          {est?.amount != null ? <Text style={styles.termsText}>{INCLUDED}</Text> : null}
          <Text style={styles.termsText}>No payment now. We confirm the ride first; you pay by Zelle, Venmo or card after that.</Text>
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: typing ? 12 : Math.max(insets.bottom, 16) }]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(18,18,19,0.82)' }]} />
        <View style={styles.barTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.barTitle} numberOfLines={1}>{est ? est.title : 'Your price'}</Text>
            <Text style={styles.barLine} numberOfLines={2}>
              {est?.amount != null ? 'Fuel and tolls included' : est ? 'We confirm the price, usually within 15 minutes' : 'Add pickup and drop-off to see it'}
            </Text>
          </View>
          {total != null ? <Text style={styles.barPrice}>{money(total)}</Text> : null}
        </View>
        {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
        {typing ? null : <GoldButton label="Request this ride" onPress={send} busy={busy} />}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10 },
  close: { height: 44, justifyContent: 'center', paddingHorizontal: 4 },
  closeText: { fontSize: 16, color: C.goldText },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, gap: 18 },
  route: { paddingTop: 16, paddingBottom: 6, paddingHorizontal: 18 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  remove: { color: C.muted, fontSize: 13 },
  addStop: { height: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  addStopText: { color: C.goldText, fontSize: 14, fontWeight: '600' },
  pair: { flexDirection: 'row', gap: 12 },
  over: { ...T.small, color: C.goldText, marginTop: -8 },
  vehicle: { flex: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, paddingBottom: 12 },
  vehicleOn: { borderColor: C.gold },
  vehiclePhoto: { width: '100%', height: 92, backgroundColor: C.cardHi },
  vehicleCheck: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: C.goldHi, alignItems: 'center', justifyContent: 'center' },
  vehicleName: { fontSize: 15, fontWeight: '600', color: C.ink, paddingHorizontal: 12, marginTop: 10 },
  vehicleLine: { fontSize: 12, lineHeight: 16, color: C.muted, paddingHorizontal: 12, marginTop: 5 },
  extras: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  extra: { height: 44, paddingHorizontal: 16, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineHi },
  extraOn: { backgroundColor: C.goldHi, borderColor: C.goldHi },
  extraText: { fontSize: 14, fontWeight: '500', color: '#E9E5DC' },
  extraTextOn: { color: C.onGold, fontWeight: '600' },
  other: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: C.faint, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: C.goldHi, borderColor: C.goldHi },
  otherText: { fontSize: 15, color: '#E9E5DC' },
  terms: { gap: 6, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineHi },
  termsLead: { fontSize: 13.5, lineHeight: 19, color: C.text },
  termsText: { fontSize: 12, lineHeight: 17, color: C.muted },
  bar: { paddingTop: 14, paddingHorizontal: 20, gap: 12, borderTopWidth: 1, borderTopColor: C.line, overflow: 'hidden' },
  barTop: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 },
  barTitle: { fontSize: 14, fontWeight: '600', color: C.ink },
  barLine: { fontSize: 12.5, lineHeight: 17, color: C.muted, marginTop: 2 },
  barPrice: { ...SERIF, fontSize: 34, lineHeight: 40, color: C.goldHi },
  error: { color: C.red, fontSize: 14, lineHeight: 19 },
  doneScreen: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 28 },
  doneTitle: { ...T.title, marginTop: 22, textAlign: 'center' },
  doneText: { ...T.body, color: C.text, textAlign: 'center', marginTop: 12 },
});
