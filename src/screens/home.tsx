// Home: the next ride (if there is one) and the shortest way to book another.
import { Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import RideCard from '../components/ride-card';
import { AIRPORTS } from '../components/address-input';
import { isUpcoming, PHONE, PHONE_TEL, type Me, type Ride } from '../lib/api';
import { VEHICLES } from '../lib/estimate';
import { CAR_PHOTO, FLEET_PHOTO } from '../lib/photos';
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
        <View style={styles.heroPhoto}>
          <Image source={FLEET_PHOTO} style={styles.heroPhotoImage} resizeMode="cover" accessibilityLabel="Our fleet by San Diego Bay" />
          <View style={styles.heroShade} />
          <Text style={styles.brand}>PACIFIC ELITE RIDES</Text>
        </View>
        <View style={styles.heroBody}>
          <Text style={styles.hello}>{first ? `Hello, ${first}` : 'Welcome'}</Text>
          <Text style={styles.heroLine}>Black car service in San Diego. Flat rates, no surge.</Text>
          <TouchableOpacity style={styles.book} onPress={() => onBook()} activeOpacity={0.85}>
            <Text style={styles.bookText}>Book a ride</Text>
          </TouchableOpacity>
        </View>
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

      <Text style={styles.section}>Our fleet</Text>
      <View style={styles.grid}>
        {VEHICLES.map((v) => (
          <TouchableOpacity
            key={v.key}
            style={styles.car}
            activeOpacity={0.85}
            onPress={() => onBook(v.key === 'Sprinter' ? { vehicle: 'Sprinter', tripType: 'Hourly' } : { vehicle: 'SUV' })}
          >
            <Image source={CAR_PHOTO[v.key]} style={styles.carPhoto} resizeMode="cover" accessibilityIgnoresInvertColors />
            <View style={styles.carBody}>
              <Text style={styles.tileTitle}>{v.name}</Text>
              <Text style={styles.tileLine}>{v.line}</Text>
            </View>
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
  hero: { backgroundColor: C.black, borderRadius: 22, marginBottom: 6, overflow: 'hidden' },
  heroPhoto: { height: 168, padding: 18, overflow: 'hidden' },
  heroPhotoImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  heroShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,8,8,0.18)' },
  heroBody: { padding: 18, paddingTop: 14 },
  brand: { color: '#F1DFAE', fontSize: 11.5, letterSpacing: 3, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  hello: { color: '#fff', fontSize: 28, fontWeight: '800' },
  car: { width: '48%', flexGrow: 1, backgroundColor: C.card, borderRadius: 16, overflow: 'hidden' },
  carPhoto: { width: '100%', height: 96, backgroundColor: '#1B1B1D' },
  carBody: { padding: 12 },
  heroLine: { color: '#B9B9BE', fontSize: 14.5, marginTop: 6, lineHeight: 20 },
  book: { backgroundColor: C.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
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
