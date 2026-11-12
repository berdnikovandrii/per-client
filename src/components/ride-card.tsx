// One ride in a list: when, route, status and price at a glance.
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { dayLabel, money, shortAddress, STATUS, timeLabel, type Ride } from '../lib/api';
import { C } from '../theme';

export default function RideCard({ ride, onPress }: { ride: Ride; onPress: () => void }) {
  const s = STATUS[ride.status];
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.stripe, { backgroundColor: s.color }]} />
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={styles.when}>
            {dayLabel(ride.ride_datetime)}
            {ride.ride_datetime ? ` · ${timeLabel(ride.ride_datetime)}` : ''}
          </Text>
          {ride.price != null && (
            <Text style={styles.price}>
              {ride.price_final ? '' : '~'}
              {money(ride.price)}
            </Text>
          )}
        </View>
        <Text style={styles.route} numberOfLines={2}>
          {shortAddress(ride.pickup)}
          {ride.dropoff ? ` → ${shortAddress(ride.dropoff)}` : ''}
        </Text>
        <View style={styles.tags}>
          <Text style={[styles.tag, { color: s.color, backgroundColor: s.soft }]}>{s.label}</Text>
          {ride.paid ? <Text style={[styles.tag, styles.paid]}>Paid</Text> : ride.pay_url ? <Text style={[styles.tag, styles.due]}>{ride.pay_kind === 'deposit' ? 'Deposit due' : 'Payment due'}</Text> : null}
          {ride.flight_line ? <Text style={styles.tag}>✈ {ride.flight_line}</Text> : ride.flight_number ? <Text style={styles.tag}>✈ {ride.flight_number}</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 16, overflow: 'hidden', marginBottom: 10 },
  stripe: { width: 4 },
  body: { flex: 1, padding: 14 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  when: { fontSize: 16.5, fontWeight: '800', color: C.ink, flex: 1 },
  price: { fontSize: 16.5, fontWeight: '800', color: C.ink },
  route: { fontSize: 15, color: C.text, marginTop: 4, lineHeight: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { fontSize: 12, fontWeight: '700', color: '#4A4A50', backgroundColor: '#F0F0F2', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  paid: { color: C.green, backgroundColor: C.greenSoft },
  due: { color: C.red, backgroundColor: C.redSoft },
});
