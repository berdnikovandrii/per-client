// Flight card for airport pickups (2026-11-05): airline + status badge, a departure → arrival line with the
// plane where it is now, the times (plan vs actual / expected), terminal · gate · bags and "Check now".
// Plain React Native + Animated — the same file runs on the iPhone and on the web.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { checkedAgo, FLIGHT_TONES, flightBadge, flightProgress, flightTime, isInAir, isLanded, normalizeFlight } from '../lib/flight';
import type { FlightStatus } from '../lib/flight';
import Icon from './icon';
import { PulseDot } from './ui';
import { C, SERIF } from '../theme';

type Props = {
  flight: FlightStatus | null | undefined;
  flightNumber?: string | null;
  pickupAt?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
};

/** "UA1068" / "AC 1582 (arr 3:55 PM)" → "UA 1068" / "AC 1582"; text with no flight number stays as typed. */
function spacedNumber(n?: string | null) {
  const code = normalizeFlight(n);
  const m = code?.match(/^([A-Z0-9]{2}[A-Z]?)(\d{1,4})$/);
  return m ? `${m[1]} ${m[2]}` : (n || '').trim() || 'Flight';
}

/** "2" / "T2" → "T2" (short) or "Terminal 2"; a lettered one ("M" at YVR, "B" at LAX) → "Terminal M". */
function terminalLabel(raw: string | null | undefined, short: boolean) {
  const t = (raw || '').trim().replace(/^terminal\s*/i, '');
  if (!t) return '';
  const core = /^T\d/i.test(t) ? t.slice(1) : t;
  return short && /^\d+[A-Z]?$/i.test(core) ? `T${core}` : `Terminal ${core}`;
}

/** Plan time + the real one; the plan is struck through when they differ. */
function Times({ label, planned, actual, align }: { label: string; planned?: string | null; actual?: string | null; align: 'left' | 'right' }) {
  const p = flightTime(planned);
  const a = flightTime(actual);
  const changed = !!p && !!a && p !== a;
  return (
    <View style={{ alignItems: align === 'left' ? 'flex-start' : 'flex-end', flexShrink: 1 }}>
      <Text style={styles.timeLabel}>{label}</Text>
      <Text style={styles.time}>{a || p || '—'}</Text>
      {changed ? <Text style={styles.timeStruck}>{p}</Text> : null}
    </View>
  );
}

function CheckButton({ onRefresh, refreshing }: Pick<Props, 'onRefresh' | 'refreshing'>) {
  if (!onRefresh) return null;
  return (
    <TouchableOpacity
      style={[styles.checkBtn, refreshing && styles.checkBtnBusy]}
      onPress={onRefresh}
      disabled={!!refreshing}
      accessibilityRole="button"
      accessibilityLabel="Check flight status now"
    >
      {refreshing ? <ActivityIndicator size="small" color={C.goldText} /> : <Text style={styles.checkText}>Check now</Text>}
    </TouchableOpacity>
  );
}

export default function FlightCard({ flight, flightNumber, pickupAt, onRefresh, refreshing }: Props) {
  // Re-render every 30 s so the plane moves and "checked N min ago" stays true
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const inAir = !!flight && isInAir(flight);
  // Soft drift while airborne
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!inAir) {
      drift.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(drift, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [inAir, drift]);

  const pickup = flightTime(pickupAt);

  if (!flight) {
    if (!flightNumber) return null;
    return (
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={[styles.title, { marginTop: 0, flexShrink: 1 }]} numberOfLines={1}>
            {spacedNumber(flightNumber)}
          </Text>
          <View style={[styles.badge, { backgroundColor: FLIGHT_TONES.grey.background }]}>
            <Text style={[styles.badgeText, { color: FLIGHT_TONES.grey.color }]}>Not checked yet</Text>
          </View>
        </View>
        <Text style={styles.note}>
          The server starts checking 24 h before the pickup{pickup ? ` (${pickup})` : ''}. Tap Check now to look it up.
        </Text>
        <View style={styles.foot}>
          <View style={{ flex: 1 }} />
          <CheckButton onRefresh={onRefresh} refreshing={refreshing} />
        </View>
      </View>
    );
  }

  const badge = flightBadge(flight);
  const tone = FLIGHT_TONES[badge.tone];
  const progress = flightProgress(flight, now);
  const landed = isLanded(flight);
  const departed = !!flight.actualDeparture;
  const depPlace = [terminalLabel(flight.departureTerminal, true), flight.departureGate && `Gate ${flight.departureGate}`]
    .filter(Boolean)
    .join(' · ');
  const details = [
    terminalLabel(flight.terminal, false),
    flight.gate && `Gate ${flight.gate}`,
    flight.baggage && `Bags ${flight.baggage}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const shift = drift.interpolate({ inputRange: [0, 1], outputRange: [-2, 2] });

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.label}>FLIGHT</Text>
        <View style={[styles.badge, { backgroundColor: tone.background }]}>
          {inAir ? <PulseDot color={tone.color} /> : null}
          <Text style={[styles.badgeText, { color: tone.color }]}>{badge.label}</Text>
        </View>
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {spacedNumber(flight.number || flightNumber)}
        {flight.airline ? <Text style={styles.airline}> · {flight.airline}</Text> : null}
      </Text>

      <View style={styles.lineRow}>
        <Text style={styles.code}>{flight.from || '···'}</Text>
        <View style={styles.trackWrap}>
          <View style={styles.track}>
            <View style={[styles.trackDone, { width: `${progress * 100}%` }]} />
            <Animated.View
              style={[styles.plane, { left: `${progress * 100}%`, transform: [{ translateX: shift }] }]}
              accessibilityLabel={`Flight progress ${Math.round(progress * 100)} percent`}
            >
              <Icon name="plane" size={20} color={progress > 0 ? C.goldHi : C.faint} />
            </Animated.View>
          </View>
        </View>
        <Text style={styles.code}>{flight.to || '···'}</Text>
      </View>

      <View style={styles.timesRow}>
        <View style={{ flexShrink: 1 }}>
          <Times label={departed ? 'Departed' : 'Departs'} planned={flight.scheduledDeparture} actual={flight.actualDeparture} align="left" />
          {depPlace ? <Text style={styles.small}>{depPlace}</Text> : null}
        </View>
        {pickup ? <Text style={styles.pickup} numberOfLines={1}>Pickup {pickup}</Text> : null}
        <Times
          label={landed ? 'Landed' : 'Arrives'}
          planned={flight.scheduledArrival}
          actual={landed ? flight.landedAt : flight.estimatedArrival}
          align="right"
        />
      </View>

      {flight.error ? <Text style={styles.note}>Last check failed — showing the previous status.</Text> : null}

      <View style={styles.foot}>
        <View style={{ flex: 1 }}>
          {details ? <Text style={styles.details}>{details}</Text> : null}
          <Text style={styles.small}>{checkedAgo(flight.checkedAt, now)}</Text>
        </View>
        <CheckButton onRefresh={onRefresh} refreshing={refreshing} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 22, padding: 18, backgroundColor: C.cardLo },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 2.4, color: C.muted },
  title: { fontSize: 15, fontWeight: '600', color: C.ink, marginTop: 12 },
  airline: { fontWeight: '400', color: C.text },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 26, borderRadius: 13, paddingHorizontal: 11 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  lineRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 },
  code: { ...SERIF, fontSize: 34, lineHeight: 38, color: C.ink, minWidth: 62, textAlign: 'center' },
  // padding keeps the plane inside the line at 0 % and 100 %
  trackWrap: { flex: 1, paddingHorizontal: 10, height: 24, justifyContent: 'center' },
  track: { height: 2, borderRadius: 1, backgroundColor: C.track, justifyContent: 'center' },
  trackDone: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 1, backgroundColor: C.gold },
  plane: { position: 'absolute', width: 20, height: 20, marginLeft: -10, top: -9, alignItems: 'center', justifyContent: 'center' },
  timesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 10, gap: 8 },
  timeLabel: { fontSize: 12, color: C.muted },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  time: { fontSize: 15, fontWeight: '600', color: C.ink, marginTop: 2 },
  timeStruck: { fontSize: 12, color: C.faint, textDecorationLine: 'line-through', marginTop: 1 },
  pickup: { fontSize: 12, color: C.goldText, fontWeight: '600', marginTop: 16 },
  foot: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 12, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineHi },
  details: { fontSize: 13, color: '#E9E5DC' },
  small: { fontSize: 12, color: C.muted, marginTop: 2 },
  note: { fontSize: 12.5, lineHeight: 18, color: C.muted, marginTop: 10 },
  checkBtn: { height: 36, borderRadius: 18, paddingHorizontal: 14, minWidth: 96, alignItems: 'center', justifyContent: 'center', backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldLine },
  checkBtnBusy: { opacity: 0.6 },
  checkText: { fontSize: 13, fontWeight: '600', color: C.goldHi },
});
