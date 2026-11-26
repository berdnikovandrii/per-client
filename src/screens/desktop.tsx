// The website layout of the client account (Andrii, 2026-11-25): what a browser window on a computer shows
// instead of the phone screens. A menu across the top; the first page is the fleet photo with the booking form
// right on it; My rides is a list with the chosen ride beside it; Account is two columns.
// The phone screens themselves are reused inside these frames, so there is one booking form, one ride screen
// and one account screen for the iPhone and the web.
import type { ReactNode } from 'react';
import { Animated, Image, Linking, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import RideCard from '../components/ride-card';
import Icon from '../components/icon';
import { GhostButton, GoldButton, Label, Medal, Rise, T, Tap } from '../components/ui';
import { isUpcoming, paymentDue, PHONE, PHONE_TEL, SITE, type Me, type Ride } from '../lib/api';
import { VEHICLES } from '../lib/estimate';
import { APP_STORE, PanelWidthProvider } from '../lib/layout';
import { CAR_PHOTO } from '../lib/photos';
import { FLEET_WIDE } from '../lib/photo-wide';
import { C, SERIF } from '../theme';
import type { Prefill } from './book';
import { PROMISES, SHORTCUTS } from './home';

export type Tab = 'home' | 'rides' | 'account';
const TABS: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Book' },
  { key: 'rides', label: 'My rides' },
  { key: 'account', label: 'Account' },
];
/** The page is never wider than this; on a larger monitor it stays in the middle. */
const PAGE = 1240;
const NAV = 68;
/** The booking card on the first page. */
const FORM = 440;

const open = (url: string) => Linking.openURL(url).catch(() => {});

/** How tall the fleet photo is behind the top of the first page. */
const photoHeight = (width: number) => Math.max(540, Math.min(820, Math.round(width * 0.5)));

/** The fleet photo behind the top of the first page; it dims as the page scrolls. The other pages are plain. */
export function Backdrop({ hidden, y }: { hidden: boolean; y: Animated.Value }) {
  const { width } = useWindowDimensions();
  if (hidden) return null;
  const height = photoHeight(width);
  const opacity = y.interpolate({ inputRange: [0, 380], outputRange: [1, 0.28], extrapolate: 'clamp' });
  return (
    <Animated.View style={[styles.backdrop, { height, opacity }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={FLEET_WIDE} resizeMode="cover" style={{ width: '100%', height }} />
      <LinearGradient colors={['rgba(11,11,12,0.74)', 'rgba(11,11,12,0.2)', 'rgba(11,11,12,0.32)', C.bg]} locations={[0, 0.36, 0.7, 1]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(11,11,12,0.62)', 'rgba(11,11,12,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 0.72, y: 0.5 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

export function TopNav({ tab, onTab, upcoming, onBook }: { tab: Tab; onTab: (t: Tab) => void; upcoming: number; onBook: () => void }) {
  return (
    <View style={styles.nav}>
      <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,11,12,0.6)' }]} />
      <View style={styles.navInner}>
        <Tap onPress={() => onTab('home')} to={0.98} feedback={null} accessibilityRole="link" accessibilityLabel="Pacific Elite Rides, first page">
          <Text style={styles.brand}>PACIFIC ELITE RIDES</Text>
        </Tap>
        <View style={styles.tabs} accessibilityRole="tablist">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <Tap key={t.key} style={styles.tab} to={0.97} feedback={null} onPress={() => onTab(t.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.key === 'rides' && upcoming > 0 ? `${t.label}, ${upcoming} upcoming` : t.label}>
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
                {t.key === 'rides' && upcoming > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{upcoming}</Text>
                  </View>
                ) : null}
                {on ? <View style={styles.tabLine} /> : null}
              </Tap>
            );
          })}
        </View>
        <View style={{ flex: 1 }} />
        <Tap style={styles.navLink} to={0.97} feedback={null} onPress={() => open(SITE)} accessibilityRole="link">
          <Text style={styles.navLinkText}>Main site</Text>
        </Tap>
        <Tap style={[styles.navLink, { flexDirection: 'row', gap: 7 }]} to={0.97} feedback={null} onPress={() => open(`tel:${PHONE_TEL}`)} accessibilityRole="link" accessibilityLabel={`Call ${PHONE}`}>
          <Icon name="phone" size={16} color={C.goldHi} />
          <Text style={[styles.navLinkText, { color: C.ink, fontWeight: '600' }]}>{PHONE}</Text>
        </Tap>
        <Tap style={styles.navPill} to={0.97} feedback={null} onPress={() => open(APP_STORE)} accessibilityRole="link">
          <Text style={styles.navPillText}>Get the iPhone app</Text>
        </Tap>
        <GoldButton label="Book a ride" height={42} onPress={onBook} style={{ shadowOpacity: 0 }} />
      </View>
    </View>
  );
}

type HomeProps = { me: Me; rides: Ride[]; onOpen: (r: Ride) => void; /** a shortcut fills the form */ onPrefill: (p: Prefill) => void; /** the booking form itself */ form: ReactNode; y: Animated.Value; hidden?: boolean };

/** First page: greeting and the next ride on the photo, the booking form in a card on the right, the rest below. */
export function DesktopHome({ me, rides, onOpen, onPrefill, form, y, hidden }: HomeProps) {
  const next = rides
    .filter((r) => isUpcoming(r) && r.ride_datetime)
    .sort((a, b) => new Date(a.ride_datetime!).getTime() - new Date(b.ride_datetime!).getTime())[0];
  const due = rides.filter((r) => paymentDue(r) && r.id !== next?.id);
  const first = (me.name || '').trim().split(/\s+/)[0];
  // with nothing booked the photo is the first thing on the page: the shortcuts start below the cars,
  // but never so low that their first row falls off the window
  const win = useWindowDimensions();
  const heroGap = Math.max(56, Math.min(photoHeight(win.width) - 357, win.height - 462));
  return (
    <View style={[styles.page, styles.row, hidden && { display: 'none' }]}>
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.homeLeft}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: false })}
      >
        <Rise>
          <Text style={styles.h1} accessibilityRole="header">{first ? `Hello, ${first}` : 'Welcome'}</Text>
          <Text style={styles.lead}>Black car service in San Diego. Flat rates, no surge.</Text>
        </Rise>

        {next ? (
          <Rise delay={100} style={styles.block}>
            <Label style={styles.label}>Your next ride</Label>
            <RideCard ride={next} lead route onPress={() => onOpen(next)} />
          </Rise>
        ) : null}
        {due.length ? (
          <Rise delay={140} style={next ? { marginTop: 0 } : styles.block}>
            {!next ? <Label style={styles.label}>Payment due</Label> : null}
            {due.map((r) => (
              <RideCard key={r.id} ride={r} onPress={() => onOpen(r)} />
            ))}
          </Rise>
        ) : null}

        <Rise delay={200} style={[styles.block, !next && !due.length && { marginTop: heroGap }]}>
          <Label style={styles.label}>Popular</Label>
          <View style={styles.tiles}>
            {SHORTCUTS.map((s) => (
              <Tap key={s.title} style={styles.tile} onPress={() => onPrefill(s.prefill)} accessibilityRole="button" accessibilityLabel={`${s.title}. ${s.line}`}>
                <Text style={styles.tileTitle}>{s.title}</Text>
                <Text style={styles.tileLine}>{s.line}</Text>
              </Tap>
            ))}
          </View>
        </Rise>

        <Rise delay={280} style={styles.block}>
          <Label style={styles.label}>Our fleet</Label>
          <View style={styles.cars}>
            {VEHICLES.map((v) => (
              <Tap key={v.key} style={styles.car} onPress={() => onPrefill(v.key === 'Sprinter' ? { vehicle: 'Sprinter', tripType: 'Hourly' } : { vehicle: 'SUV' })} accessibilityRole="button" accessibilityLabel={`${v.name}. ${v.line}`}>
                <Image source={CAR_PHOTO[v.key]} style={styles.carPhoto} resizeMode="cover" />
                <View style={styles.carBody}>
                  <Text style={styles.tileTitle}>{v.name}</Text>
                  <Text style={styles.tileLine}>{v.line}</Text>
                </View>
              </Tap>
            ))}
          </View>
        </Rise>

        <Rise delay={340} style={styles.block}>
          <View style={styles.promise}>
            {PROMISES.map((p, i) => (
              <View key={p.icon} style={[styles.promiseRow, i > 0 && styles.promiseLine]}>
                <Icon name={p.icon} size={20} color={C.goldHi} />
                <Text style={styles.promiseText}>{p.text}</Text>
              </View>
            ))}
          </View>
        </Rise>

        <View style={styles.foot}>
          <View style={{ flex: 1 }}>
            <Text style={styles.footTitle}>Need a car right now?</Text>
            <Text style={T.small}>Call or text dispatch, any hour.</Text>
          </View>
          <GhostButton label={`Call ${PHONE}`} icon="phone" onPress={() => open(`tel:${PHONE_TEL}`)} style={{ height: 50, borderRadius: 25, paddingHorizontal: 22 }} />
        </View>
        <Text style={styles.legal}>
          Pacific Elite Rides LLC · TCP 35857B ·{' '}
          <Text style={styles.legalLink} onPress={() => open(`${SITE}/privacy.html`)}>Privacy</Text> ·{' '}
          <Text style={styles.legalLink} onPress={() => open(`${SITE}/terms.html`)}>Terms</Text>
        </Text>
      </Animated.ScrollView>

      <View style={styles.formSide}>
        <PanelWidthProvider value={FORM - 2}>
          <View style={styles.panel}>{form}</View>
        </PanelWidthProvider>
      </View>
    </View>
  );
}

/** My rides: the list on the left, the chosen ride on the right. With no rides at all, the list's own empty screen. */
export function DesktopRides({ empty, list, detail }: { empty: boolean; list: ReactNode; detail: ReactNode | null }) {
  if (empty) {
    return (
      <View style={[styles.page, styles.narrow]}>
        <View style={styles.panel}>{list}</View>
      </View>
    );
  }
  return (
    <View style={[styles.page, styles.row, { justifyContent: 'center' }]}>
      <View style={styles.ridesList}>{list}</View>
      <View style={styles.ridesDetail}>
        {detail ? (
          <View style={styles.panel}>{detail}</View>
        ) : (
          <View style={[styles.panel, { alignItems: 'center', justifyContent: 'center', gap: 16 }]}>
            <Medal icon="calendar" />
            <Text style={[T.body, { color: C.muted }]}>Choose a ride to see its details.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** Account: one centered page; `narrow` is the guest's sign-in card. */
export function DesktopAccount({ narrow, children }: { narrow?: boolean; children: ReactNode }) {
  return (
    <View style={[styles.page, narrow ? styles.narrow : { alignItems: 'center', paddingTop: 18 }]}>
      {narrow ? <View style={styles.panel}>{children}</View> : <View style={{ flex: 1, width: '100%', maxWidth: 1000 }}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', backgroundColor: C.bg },
  nav: { height: NAV, borderBottomWidth: 1, borderBottomColor: C.line, zIndex: 5 },
  navInner: { flex: 1, width: '100%', maxWidth: PAGE, alignSelf: 'center', paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', gap: 22 },
  brand: { fontSize: 12, fontWeight: '700', letterSpacing: 3, color: C.goldText },
  tabs: { flexDirection: 'row', alignSelf: 'stretch', gap: 4, marginLeft: 14 },
  tab: { paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  tabText: { fontSize: 14.5, fontWeight: '500', color: C.muted },
  tabTextOn: { color: C.ink, fontWeight: '600' },
  tabLine: { position: 'absolute', left: 14, right: 14, bottom: 0, height: 2, borderRadius: 1, backgroundColor: C.goldHi },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: C.goldHi, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, fontWeight: '700', color: C.onGold },
  navLink: { height: 42, alignItems: 'center', justifyContent: 'center' },
  navLinkText: { fontSize: 14, color: C.text },
  navPill: { height: 42, paddingHorizontal: 16, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.lineHi, backgroundColor: 'rgba(255,255,255,0.05)' },
  navPillText: { fontSize: 14, fontWeight: '600', color: C.ink },

  page: { flex: 1, width: '100%', maxWidth: PAGE, alignSelf: 'center', paddingHorizontal: 32 },
  row: { flexDirection: 'row', gap: 44 },
  panel: { flex: 1, borderRadius: 28, overflow: 'hidden', backgroundColor: C.bg, borderWidth: 1, borderColor: C.lineHi, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 40, shadowOffset: { width: 0, height: 20 } },

  homeLeft: { paddingTop: 56, paddingBottom: 40 },
  h1: { ...SERIF, fontSize: 68, lineHeight: 72, letterSpacing: -0.6, color: '#FFFFFF' },
  lead: { fontSize: 18, lineHeight: 26, color: '#D6D2C9', marginTop: 10 },
  block: { marginTop: 34 },
  label: { marginBottom: 12 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexGrow: 1, flexBasis: 250, minHeight: 86, padding: 16, borderRadius: 18, backgroundColor: 'rgba(22,22,23,0.9)', borderWidth: 1, borderColor: C.line, justifyContent: 'space-between', gap: 10 },
  tileTitle: { fontSize: 16, fontWeight: '600', color: C.ink },
  tileLine: { fontSize: 13, lineHeight: 18, color: C.muted },
  cars: { flexDirection: 'row', gap: 12 },
  car: { flex: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  carPhoto: { width: '100%', height: 150, backgroundColor: C.cardHi },
  carBody: { padding: 14, gap: 5 },
  promise: { borderRadius: 22, paddingHorizontal: 18, backgroundColor: C.cardLo, borderWidth: 1, borderColor: C.line },
  promiseRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
  promiseLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineHi },
  promiseText: { flex: 1, fontSize: 14.5, lineHeight: 20, color: C.text },
  foot: { marginTop: 34, flexDirection: 'row', alignItems: 'center', gap: 20 },
  footTitle: { ...SERIF, fontSize: 26, lineHeight: 30, color: C.ink },
  legal: { marginTop: 36, fontSize: 12.5, color: C.faint },
  legalLink: { color: C.goldText },
  formSide: { width: FORM, paddingTop: 28, paddingBottom: 24 },

  ridesList: { width: 440, paddingTop: 18 },
  narrow: { maxWidth: 520 + 64, paddingTop: 28, paddingBottom: 24 },
  ridesDetail: { flex: 1, maxWidth: 680, paddingTop: 28, paddingBottom: 24 },
});
