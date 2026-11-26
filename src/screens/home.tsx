// Home: the fleet photo, a greeting, the one gold button, the next ride (if there is one) and the shortest ways to book another.
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RideCard from '../components/ride-card';
import Icon, { type IconName } from '../components/icon';
import { GhostButton, GoldButton, Label, NATIVE, reduceMotion, Rise, T, Tap } from '../components/ui';
import { AIRPORTS } from '../components/address-input';
import { isUpcoming, paymentDue, PHONE, PHONE_TEL, type Me, type Ride } from '../lib/api';
import { VEHICLES } from '../lib/estimate';
import { CAR_PHOTO, FLEET_PHOTO } from '../lib/photos';
import type { Prefill } from './book';
import { C, SERIF, TAB_SPACE } from '../theme';
import { useAppWidth } from '../lib/layout';

type Props = { me: Me; rides: Ride[]; refreshing: boolean; onRefresh: () => void; onBook: (prefill?: Prefill) => void; onOpen: (r: Ride) => void };

const SAN = AIRPORTS[0].value;
const LAX = AIRPORTS[1].value;
const SHORTCUTS: { title: string; line: string; prefill: Prefill }[] = [
  { title: 'To SAN Airport', line: 'Flat rates from $60', prefill: { dropoff: SAN } },
  { title: 'From SAN Airport', line: 'Flight tracked · 60 min free waiting', prefill: { pickup: SAN } },
  { title: 'San Diego ↔ LAX', line: '$375 one way · $700 round trip', prefill: { dropoff: LAX } },
  { title: 'By the hour', line: 'SUV $95/h · Sprinter $180/h', prefill: { tripType: 'Hourly' } },
];
const PROMISES: { icon: IconName; text: string }[] = [
  { icon: 'receipt', text: 'The price you see is the price you pay: fuel and tolls included' },
  { icon: 'clock', text: 'Airport pickups: 60 minutes of free waiting, 90 for international' },
  { icon: 'shield', text: 'Licensed and insured · TCP 35857B' },
];

export default function HomeScreen({ me, rides, refreshing, onRefresh, onBook, onOpen }: Props) {
  const insets = useSafeAreaInsets();
  const width = useAppWidth();
  const hero = 283 + insets.top;
  const next = rides
    .filter((r) => isUpcoming(r) && r.ride_datetime)
    .sort((a, b) => new Date(a.ride_datetime!).getTime() - new Date(b.ride_datetime!).getTime())[0];
  const first = (me.name || '').trim().split(/\s+/)[0];
  const due = rides.filter((r) => paymentDue(r) && r.id !== next?.id);

  // the photo drifts very slowly, moves at half speed under the scroll, and stretches when the page is pulled down
  const y = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 14000, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(drift, { toValue: 0, duration: 14000, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  return (
    <Animated.ScrollView
      style={{ backgroundColor: C.bg }}
      contentContainerStyle={{ paddingBottom: TAB_SPACE + insets.bottom }}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: NATIVE })}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} progressViewOffset={insets.top} />}
    >
      <Animated.View
        style={[styles.photoBox, { width, height: hero, transform: [
          { translateY: y.interpolate({ inputRange: [-300, 0, 600], outputRange: [-150, 0, 300] }) },
          { scale: y.interpolate({ inputRange: [-300, 0], outputRange: [1.6, 1], extrapolateRight: 'clamp' }) },
        ] }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.Image
          source={FLEET_PHOTO}
          resizeMode="cover"
          style={{ width, height: hero, transform: [
            { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1.12] }) },
            { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
          ] }}
        />
        <LinearGradient colors={['rgba(11,11,12,0.6)', 'rgba(11,11,12,0.12)', C.bg]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <View style={[styles.brandRow, { marginTop: insets.top + 11 }]}>
        <Text style={styles.brand}>PACIFIC ELITE RIDES</Text>
        <Tap style={styles.callRound} onPress={() => Linking.openURL(`tel:${PHONE_TEL}`)} accessibilityRole="button" accessibilityLabel={`Call ${PHONE}`}>
          <Icon name="phone" size={20} />
        </Tap>
      </View>

      <Rise style={styles.hello}>
        <Text style={styles.h1} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{first ? `Hello, ${first}` : 'Welcome'}</Text>
        <Text style={styles.lead}>Black car service in San Diego. Flat rates, no surge.</Text>
        <GoldButton label="Book a ride" arrow onPress={() => onBook()} style={{ marginTop: 28 }} />
      </Rise>

      {next ? (
        <Rise delay={120} style={styles.block}>
          <Label style={styles.label}>Your next ride</Label>
          <RideCard ride={next} lead route onPress={() => onOpen(next)} />
        </Rise>
      ) : null}
      {due.length ? (
        <Rise delay={160} style={[styles.block, { marginTop: next ? 4 : 26 }]}>
          {!next ? <Label style={styles.label}>Payment due</Label> : null}
          {due.map((r) => (
            <RideCard key={r.id} ride={r} onPress={() => onOpen(r)} />
          ))}
        </Rise>
      ) : null}

      <Rise delay={240} style={{ marginTop: next || due.length ? 14 : 26 }}>
        <Label style={[styles.label, { marginLeft: 24 }]}>Popular</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles} decelerationRate="fast" snapToInterval={178}>
          {SHORTCUTS.map((s) => (
            <Tap key={s.title} style={styles.tile} onPress={() => onBook(s.prefill)} accessibilityRole="button" accessibilityLabel={`${s.title}. ${s.line}`}>
              <Text style={styles.tileTitle}>{s.title}</Text>
              <Text style={styles.tileLine} numberOfLines={1}>{s.line}</Text>
            </Tap>
          ))}
        </ScrollView>
      </Rise>

      <Rise delay={320} style={styles.block}>
        <Label style={styles.label}>Our fleet</Label>
        <View style={styles.cars}>
          {VEHICLES.map((v) => (
            <Tap
              key={v.key}
              style={styles.car}
              onPress={() => onBook(v.key === 'Sprinter' ? { vehicle: 'Sprinter', tripType: 'Hourly' } : { vehicle: 'SUV' })}
              accessibilityRole="button"
              accessibilityLabel={`${v.name}. ${v.line}`}
            >
              <Image source={CAR_PHOTO[v.key]} style={styles.carPhoto} resizeMode="cover" accessibilityIgnoresInvertColors />
              <View style={styles.carBody}>
                <Text style={styles.tileTitle}>{v.name}</Text>
                <Text style={styles.carLine}>{v.line}</Text>
              </View>
            </Tap>
          ))}
        </View>

        <View style={styles.promise}>
          {PROMISES.map((p, i) => (
            <View key={p.icon} style={[styles.promiseRow, i > 0 && styles.promiseLine]}>
              <Icon name={p.icon} size={20} color={C.goldHi} />
              <Text style={styles.promiseText}>{p.text}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.now}>Need a car right now?</Text>
        <GhostButton label={`Call ${PHONE}`} icon="phone" onPress={() => Linking.openURL(`tel:${PHONE_TEL}`)} style={{ height: 52, borderRadius: 26 }} />
      </Rise>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  photoBox: { position: 'absolute', top: 0, left: 0, overflow: 'hidden', backgroundColor: C.cardHi },
  brandRow: { height: 44, marginHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 11, fontWeight: '600', letterSpacing: 3.2, color: C.goldText },
  callRound: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,20,22,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  hello: { marginTop: 94, marginHorizontal: 24 },
  h1: { ...SERIF, fontSize: 44, lineHeight: 48, letterSpacing: -0.3, color: C.ink },
  lead: { ...T.body, color: '#C9C5BC', marginTop: 6 },
  block: { marginTop: 26, marginHorizontal: 24 },
  label: { marginBottom: 12 },
  tiles: { paddingHorizontal: 24, gap: 10 },
  tile: { width: 168, height: 84, padding: 14, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, justifyContent: 'space-between' },
  tileTitle: { fontSize: 15, fontWeight: '600', color: C.ink },
  tileLine: { fontSize: 12, color: C.muted },
  cars: { flexDirection: 'row', gap: 12 },
  car: { flex: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  carPhoto: { width: '100%', height: 96, backgroundColor: C.cardHi },
  carBody: { padding: 12, gap: 5 },
  carLine: { fontSize: 12, lineHeight: 16, color: C.muted },
  promise: { marginTop: 14, borderRadius: 22, paddingHorizontal: 18, backgroundColor: C.cardLo, borderWidth: 1, borderColor: C.line },
  promiseRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
  promiseLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineHi },
  promiseText: { flex: 1, fontSize: 14, lineHeight: 20, color: C.text },
  now: { ...T.small, textAlign: 'center', marginTop: 24, marginBottom: 10 },
});
