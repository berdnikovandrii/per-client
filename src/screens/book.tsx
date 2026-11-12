// Book a ride: where, when, how many, which car — with the price right away when the rate card knows it.
// The request goes to dispatch as a lead; the rider gets a push when it is confirmed.
import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AddressInput from '../components/address-input';
import WhenInput from '../components/when-input';
import { book, money, PHONE, type Booking, type Me } from '../lib/api';
import { estimate, INCLUDED, VEHICLES, type VehicleKey } from '../lib/estimate';
import { C } from '../theme';

export type Prefill = { pickup?: string; dropoff?: string; tripType?: Booking['trip_type'] };

const TRIPS: Booking['trip_type'][] = ['One way', 'Round trip', 'Hourly'];
const isAirport = (t: string) => /airport|\(san\)|\(lax\)|\bcbx\b/i.test(t);

/** Next full half hour, at least 3 hours from now. */
function defaultWhen() {
  const d = new Date(Date.now() + 3 * 3_600_000);
  d.setMinutes(d.getMinutes() <= 30 ? 30 : 60, 0, 0);
  return d;
}

export default function BookScreen({ me, prefill, onClose, onBooked }: { me: Me; prefill?: Prefill; onClose: () => void; onBooked: (id: number) => void }) {
  const [tripType, setTripType] = useState<Booking['trip_type']>(prefill?.tripType || 'One way');
  const [pickup, setPickup] = useState(prefill?.pickup || '');
  const [dropoff, setDropoff] = useState(prefill?.dropoff || '');
  const [stops, setStops] = useState<string[]>([]);
  const [when, setWhen] = useState(defaultWhen);
  const [back, setBack] = useState(() => new Date(defaultWhen().getTime() + 3 * 86_400_000));
  const [hours, setHours] = useState(3);
  const [passengers, setPassengers] = useState(2);
  const [vehicle, setVehicle] = useState<VehicleKey>('SUV');
  const [flight, setFlight] = useState('');
  const [note, setNote] = useState('');
  const [name, setName] = useState(me.name || '');
  const [phone, setPhone] = useState(me.phone || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<number | null>(null);

  const minHours = vehicle === 'Sprinter' ? 4 : 2;
  const shownHours = Math.max(minHours, hours);
  const est = useMemo(
    () => estimate({ pickup, dropoff, stops, tripType, hours: tripType === 'Hourly' ? shownHours : null, vehicle, passengers }),
    [pickup, dropoff, stops, tripType, shownHours, vehicle, passengers]
  );
  const seats = VEHICLES.find((v) => v.key === vehicle)!.seats;

  function pickVehicle(key: VehicleKey) {
    setVehicle(key);
    if (key === 'Sprinter') setTripType('Hourly');
  }

  async function send() {
    setError('');
    if (!pickup.trim()) return setError('Where should we pick you up?');
    if (tripType !== 'Hourly' && !dropoff.trim()) return setError('Where are you going?');
    if (when.getTime() < Date.now() + 30 * 60_000) return setError(`For a ride this soon please call us at ${PHONE}.`);
    if (tripType === 'Round trip' && back.getTime() <= when.getTime()) return setError('The return must be after the pickup.');
    if (!name.trim()) return setError('Please add your name.');
    if (phone.replace(/\D/g, '').length < 10) return setError('Please add your mobile number, so the chauffeur can reach you.');
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
        estimate: est?.amount ?? null,
      });
      setDone(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (done != null) {
    return (
      <View style={styles.doneScreen}>
        <Text style={styles.doneMark}>✓</Text>
        <Text style={styles.doneTitle}>Request sent</Text>
        <Text style={styles.doneText}>
          We are checking the schedule now and will confirm shortly{est?.amount ? ` at ${money(est.amount)}` : ' with your price'}. You will get a
          notification, and the ride appears under My rides.
        </Text>
        <TouchableOpacity style={styles.primary} onPress={() => onBooked(done)}>
          <Text style={styles.primaryText}>See my rides</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Book a ride</Text>
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <Text style={styles.headerClose}>Close</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.segment}>
          {TRIPS.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.segmentItem, tripType === t && styles.segmentOn]}
              onPress={() => {
                setTripType(t);
                if (t !== 'Hourly' && vehicle === 'Sprinter') setVehicle('SUV');
              }}
            >
              <Text style={[styles.segmentText, tripType === t && styles.segmentTextOn]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <AddressInput label="Pickup" value={pickup} onChange={setPickup} placeholder="Address, hotel or airport" />
          {stops.map((s, i) => (
            <View key={i} style={styles.stopRow}>
              <View style={{ flex: 1 }}>
                <AddressInput label={`Stop ${i + 1}`} value={s} onChange={(t) => setStops((list) => list.map((x, j) => (j === i ? t : x)))} placeholder="Address of the stop" />
              </View>
              <TouchableOpacity onPress={() => setStops((list) => list.filter((_, j) => j !== i))} hitSlop={8}>
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.divider} />
          <AddressInput
            label={tripType === 'Hourly' ? 'Drop-off (optional)' : 'Drop-off'}
            value={dropoff}
            onChange={setDropoff}
            placeholder={tripType === 'Hourly' ? 'Where the ride ends' : 'Address, hotel or airport'}
            dot="gold"
          />
          {stops.length < 3 && tripType !== 'Hourly' && (
            <TouchableOpacity onPress={() => setStops((list) => [...list, ''])} style={{ marginLeft: 22, marginTop: 2 }}>
              <Text style={styles.addStop}>+ Add a stop</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <WhenInput label="Pickup time" value={when} onChange={setWhen} min={new Date()} />
          {tripType === 'Round trip' && (
            <>
              <View style={styles.divider} />
              <WhenInput label="Return" value={back} onChange={setBack} min={when} />
            </>
          )}
          {tripType === 'Hourly' && (
            <>
              <View style={styles.divider} />
              <Stepper label="Hours" value={shownHours} min={minHours} max={12} onChange={setHours} note={`${minHours} h minimum`} />
            </>
          )}
          <View style={styles.divider} />
          <Stepper label="Passengers" value={passengers} min={1} max={14} onChange={(n) => {
            setPassengers(n);
            if (n > 6 && vehicle === 'SUV' && tripType === 'Hourly') setVehicle('Sprinter');
          }} note={passengers > seats ? `over ${seats} for this car` : undefined} />
        </View>

        <Text style={styles.section}>Vehicle</Text>
        <View style={styles.vehicles}>
          {VEHICLES.map((v) => {
            const on = vehicle === v.key;
            return (
              <TouchableOpacity key={v.key} style={[styles.vehicle, on && styles.vehicleOn]} onPress={() => pickVehicle(v.key)} activeOpacity={0.8}>
                <Text style={[styles.vehicleName, on && styles.vehicleNameOn]}>{v.name}</Text>
                <Text style={[styles.vehicleLine, on && { color: '#D8D8DC' }]}>{v.line}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          {(isAirport(pickup) || isAirport(dropoff)) && (
            <>
              <Field label="Flight number" value={flight} onChange={(t) => setFlight(t.toUpperCase())} placeholder="e.g. UA444 — we track delays" caps />
              <View style={styles.divider} />
            </>
          )}
          <Field label="Note for the chauffeur" value={note} onChange={setNote} placeholder="Luggage, child seat, gate code…" multiline />
        </View>

        <Text style={styles.section}>Your details</Text>
        <View style={styles.card}>
          <Field label="Name" value={name} onChange={setName} placeholder="First and last name" />
          <View style={styles.divider} />
          <Field label="Mobile" value={phone} onChange={setPhone} placeholder="(619) 555-1234" phone />
        </View>

        {est && (
          <View style={[styles.estimate, est.amount == null && styles.estimateCustom]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.estimateTitle}>{est.title}</Text>
              <Text style={styles.estimateBasis}>{est.basis}</Text>
              {est.amount != null && <Text style={styles.estimateIncl}>{INCLUDED}</Text>}
            </View>
            {est.amount != null && <Text style={styles.estimateAmount}>{money(est.amount)}</Text>}
          </View>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity style={[styles.primary, busy && { opacity: 0.7 }]} onPress={send} disabled={busy}>
          {busy ? <ActivityIndicator color={C.gold} /> : <Text style={styles.primaryText}>Request this ride</Text>}
        </TouchableOpacity>
        <Text style={styles.small}>No payment now. We confirm the ride first; you pay by Zelle, Venmo or card after that.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Stepper({ label, value, min, max, onChange, note }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; note?: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepLabel}>{label}</Text>
        {note ? <Text style={styles.stepNote}>{note}</Text> : null}
      </View>
      <TouchableOpacity style={[styles.stepBtn, value <= min && styles.stepBtnOff]} onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min} accessibilityLabel={`Fewer ${label}`}>
        <Text style={styles.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepValue}>{value}</Text>
      <TouchableOpacity style={[styles.stepBtn, value >= max && styles.stepBtnOff]} onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max} accessibilityLabel={`More ${label}`}>
        <Text style={styles.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, multiline, phone, caps }: { label: string; value: string; onChange: (t: string) => void; placeholder: string; multiline?: boolean; phone?: boolean; caps?: boolean }) {
  return (
    <View style={{ paddingVertical: 10 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && { minHeight: 44 }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#A1A1A6"
        multiline={multiline}
        keyboardType={phone ? 'phone-pad' : 'default'}
        textContentType={phone ? 'telephoneNumber' : undefined}
        autoCapitalize={caps ? 'characters' : phone ? 'none' : 'sentences'}
        autoCorrect={!caps && !phone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12, backgroundColor: C.bg },
  headerTitle: { fontSize: 26, fontWeight: '800', color: C.ink },
  headerClose: { fontSize: 16, fontWeight: '700', color: C.muted },
  body: { padding: 16, paddingBottom: 48 },
  segment: { flexDirection: 'row', backgroundColor: '#E9E9EC', borderRadius: 12, padding: 3, marginBottom: 12 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  segmentOn: { backgroundColor: '#fff' },
  segmentText: { fontSize: 14.5, fontWeight: '600', color: C.muted },
  segmentTextOn: { color: C.ink, fontWeight: '800' },
  card: { backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  remove: { color: C.red, fontSize: 13, fontWeight: '700' },
  addStop: { color: C.goldText, fontSize: 14, fontWeight: '700', paddingVertical: 10 },
  section: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 6, marginBottom: 8, marginLeft: 4 },
  vehicles: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  vehicle: { flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: 'transparent' },
  vehicleOn: { backgroundColor: C.ink, borderColor: C.gold },
  vehicleName: { fontSize: 16, fontWeight: '800', color: C.ink },
  vehicleNameOn: { color: C.gold },
  vehicleLine: { fontSize: 12.5, color: C.muted, marginTop: 4, lineHeight: 17 },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  stepLabel: { fontSize: 16, fontWeight: '600', color: C.ink },
  stepNote: { fontSize: 12, color: C.muted, marginTop: 2 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F0F2', alignItems: 'center', justifyContent: 'center' },
  stepBtnOff: { opacity: 0.4 },
  stepBtnText: { fontSize: 20, fontWeight: '700', color: C.ink, marginTop: -2 },
  stepValue: { fontSize: 18, fontWeight: '800', color: C.ink, minWidth: 24, textAlign: 'center' },
  fieldLabel: { fontSize: 11.5, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  fieldInput: { fontSize: 17, color: C.ink, paddingVertical: 6, fontWeight: '600' },
  estimate: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.goldSoft, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E8D9A8', marginTop: 4 },
  estimateCustom: { backgroundColor: '#fff', borderColor: C.line },
  estimateTitle: { fontSize: 12, fontWeight: '800', color: C.goldText, textTransform: 'uppercase', letterSpacing: 1 },
  estimateBasis: { fontSize: 14, color: C.text, marginTop: 4, lineHeight: 19 },
  estimateIncl: { fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 16 },
  estimateAmount: { fontSize: 30, fontWeight: '800', color: C.ink },
  error: { color: C.red, fontSize: 14.5, marginTop: 12, lineHeight: 20, fontWeight: '600' },
  primary: { backgroundColor: C.black, borderRadius: 14, paddingVertical: 17, alignItems: 'center', marginTop: 14 },
  primaryText: { color: C.gold, fontSize: 17, fontWeight: '800' },
  small: { fontSize: 12.5, color: C.muted, textAlign: 'center', marginTop: 10, lineHeight: 18 },
  doneScreen: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 28 },
  doneMark: { fontSize: 44, color: C.green, fontWeight: '800' },
  doneTitle: { fontSize: 26, fontWeight: '800', color: C.ink, marginTop: 8 },
  doneText: { fontSize: 15.5, color: C.text, textAlign: 'center', lineHeight: 23, marginTop: 10, marginBottom: 10 },
});
