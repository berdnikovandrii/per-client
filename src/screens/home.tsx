// Home: the next ride (if there is one) and the shortest way to book another.
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import RideCard from '../components/ride-card';
import { AIRPORTS } from '../components/address-input';
import { isUpcoming, PHONE, PHONE_TEL, type Me, type Ride } from '../lib/api';
import type { Prefill } from './book';
import { C } from '../theme';

type Props = { me: Me; rides: Ride[]; refreshing: boolean; onRefresh: () => void; onBook: (prefill?: Prefill) => void; onOpen: (r: Ride) => void };

const SAN = AIRPORTS[0].value;
const LAX = AIRPORTS[1].value;
const SHORTCUTS: { title: string; line: string; prefill: Prefill }[] = [
  { title: 'To SAN Airport', line: 'Flat rates from $60', prefill: { dropoff: SAN } },
  { title: 'From SAN Airport', line: 'Flight tracked · meet & greet', prefill: { pickup: SAN } },
  { title: 'San Diego ↔ LAX', line: '$375 one way · $700 round trip', prefill: { dropoff: LAX } },
  { title: 'By the hour', line: 'SUV $95/h · Sprinter $180/h', prefill: { tripType: 'Hourly' } },
];

export default function HomeScreen({ me, rides, refreshing, onRefresh, onBook, onOpen }: Props) {
  const next = rides
    .filter((r) => isUpcoming(r) && r.ride_datetime)
    .sort((a, b) => new Date(a.ride_datetime!).getTime() - new Date(b.ride_datetime!).getTime())[0];
  const first = (me.name || '').trim().split(/\s+/)[0];
  const due = rides.filter((r) => r.pay_url && !r.paid && r.status !== 'cancelled');

  return (
    <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}>
      <View style={styles.hero}>
        <Text style={styles.brand}>PACIFIC ELITE RIDES</Text>
        <Text style={styles.hello}>{first ? `Hello, ${first}` : 'Welcome'}</Text>
        <Text style={styles.heroLine}>Black car service in San Diego. Flat rates, no surge.</Text>
        <TouchableOpacity style={styles.book} onPress={() => onBook()} activeOpacity={0.85}>
          <Text style={styles.bookText}>Book a ride</Text>
        </TouchableOpacity>
      </View>

      {next && (
        <>
          <Text style={styles.section}>Your next ride</Text>
          <RideCard ride={next} onPress={() => onOpen(next)} />
        </>
      )}
      {due.filter((r) => r.id !== next?.id).map((r) => (
        <RideCard key={r.id} ride={r} onPress={() => onOpen(r)} />
      ))}

      <Text style={styles.section}>Popular</Text>
      <View style={styles.grid}>
        {SHORTCUTS.map((s) => (
          <TouchableOpacity key={s.title} style={styles.tile} onPress={() => onBook(s.prefill)} activeOpacity={0.8}>
            <Text style={styles.tileTitle}>{s.title}</Text>
            <Text style={styles.tileLine}>{s.line}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.promise}>
        <Text style={styles.promiseItem}>• The price you see is the price you pay: fuel and tolls included</Text>
        <Text style={styles.promiseItem}>• Airport pickups: 60 minutes of free waiting, 90 for international</Text>
        <Text style={styles.promiseItem}>• Licensed and insured · TCP 35857B</Text>
      </View>

      <TouchableOpacity style={styles.call} onPress={() => Linking.openURL(`tel:${PHONE_TEL}`)}>
        <Text style={styles.callText}>Need it right now? Call {PHONE}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 32 },
  hero: { backgroundColor: C.black, borderRadius: 20, padding: 20, marginBottom: 6 },
  brand: { color: C.gold, fontSize: 11.5, letterSpacing: 3, fontWeight: '800' },
  hello: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 10 },
  heroLine: { color: '#B9B9BE', fontSize: 14.5, marginTop: 6, lineHeight: 20 },
  book: { backgroundColor: C.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  bookText: { color: C.black, fontSize: 17, fontWeight: '800' },
  section: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 18, marginBottom: 8, marginLeft: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', flexGrow: 1, backgroundColor: C.card, borderRadius: 16, padding: 14, minHeight: 84 },
  tileTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
  tileLine: { fontSize: 12.5, color: C.muted, marginTop: 5, lineHeight: 17 },
  promise: { backgroundColor: C.goldSoft, borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#E8D9A8', gap: 6 },
  promiseItem: { fontSize: 13.5, color: '#5E4B14', lineHeight: 19 },
  call: { alignItems: 'center', paddingVertical: 18 },
  callText: { fontSize: 15, fontWeight: '700', color: C.ink },
});
