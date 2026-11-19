// One ride in a list: when, route, status and price at a glance.
// `lead` is the ride that matters most on the screen (gold hairline); `route` draws pickup and drop-off on a rail.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { dayLabel, money, shortAddress, STATUS, timeLabel, type Ride, type RideStatus } from '../lib/api';
import { Card, Pill, RouteRail, Tap, type Tone } from './ui';
import { C, SERIF } from '../theme';

export const STATUS_TONE: Record<RideStatus, Tone> = { requested: 'gold', confirmed: 'green', on_the_way: 'blue', on_board: 'blue', completed: 'neutral', cancelled: 'red' };

export default function RideCard({ ride, onPress, lead, route }: { ride: Ride; onPress: () => void; lead?: boolean; route?: boolean }) {
  const s = STATUS[ride.status];
  const [railHeight, setRailHeight] = useState(0);
  const from = shortAddress(ride.pickup);
  const to = ride.dropoff ? shortAddress(ride.dropoff) : '';
  const when = `${dayLabel(ride.ride_datetime)}${ride.ride_datetime ? ` · ${timeLabel(ride.ride_datetime)}` : ''}`;
  const price = ride.price != null ? `${ride.price_final ? '' : '~'}${money(ride.price)}` : '';
  return (
    <Tap onPress={onPress} style={styles.tap} accessibilityRole="button" accessibilityLabel={`${when}. ${from}${to ? ` to ${to}` : ''}. ${s.label}${price ? `. ${price}` : ''}`}>
      <Card gold={lead} style={styles.card}>
        <View style={styles.top}>
          <Text style={[styles.when, lead && route && { fontSize: 26, lineHeight: 30 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{when}</Text>
          {price ? <Text style={styles.price}>{price}</Text> : null}
        </View>
        {route && to ? (
          <View style={styles.route}>
            <View style={{ paddingTop: 5 }}>{railHeight > 0 ? <RouteRail height={railHeight - 10} /> : null}</View>
            <View style={{ flex: 1, gap: 10 }} onLayout={(e) => setRailHeight(e.nativeEvent.layout.height)}>
              <Text style={styles.place} numberOfLines={1}>{from}</Text>
              <Text style={styles.place} numberOfLines={1}>{to}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.line} numberOfLines={2}>{from}{to ? ` → ${to}` : ''}</Text>
        )}
        <View style={styles.tags}>
          <Pill label={s.label} tone={STATUS_TONE[ride.status]} live={ride.status === 'confirmed' || ride.status === 'on_the_way' || ride.status === 'on_board'} />
          {ride.paid ? (
            <Pill label="Paid" tone="green" />
          ) : ride.pay_url ? (
            <Pill label={ride.pay_kind === 'deposit' ? 'Deposit due' : 'Payment due'} tone="red" />
          ) : ride.can_pay && ride.status === 'completed' ? (
            <Pill label="Payment due" tone="red" />
          ) : null}
          {ride.card?.needed ? <Pill label="Add a card" tone="gold" /> : null}
          {ride.status === 'completed' && !ride.rating ? <Pill label="Rate your ride" tone="gold" icon="star" /> : null}
          {ride.flight_line || ride.flight_number ? <Pill label={ride.flight_line || ride.flight_number || ''} icon="plane" /> : null}
        </View>
      </Card>
    </Tap>
  );
}

const styles = StyleSheet.create({
  tap: { marginBottom: 12 },
  card: { paddingVertical: 16, gap: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  when: { ...SERIF, fontSize: 24, lineHeight: 28, color: C.ink, flex: 1 },
  price: { fontSize: 17, fontWeight: '600', color: C.goldHi },
  route: { flexDirection: 'row', gap: 12 },
  place: { fontSize: 15, lineHeight: 19, color: C.ink },
  line: { fontSize: 14, lineHeight: 20, color: C.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
