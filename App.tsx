// Pacific Elite Rides — the client app (Andrii, 2026-11-11).
// It opens without an account: a guest can look around, fill in a booking and see the price; the email code is
// asked only when the request is sent (or from the Account tab).
// Sign in with an email code, book a ride with the price up front, follow it (status, chauffeur, car, flight),
// pay the Square invoice, get a push when it is confirmed or the chauffeur is on the way. Same database as
// PER CRM and PER Driver, reached only through the client_* functions (supabase/client_app.sql in the CRM repo).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, AppState, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { CormorantGaramond_600SemiBold, useFonts } from '@expo-google-fonts/cormorant-garamond';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import { me as loadMe, registerPush, rides as loadRides, isUpcoming, type Me, type Ride } from './src/lib/api';
import Login from './src/screens/login';
import HomeScreen from './src/screens/home';
import RidesScreen from './src/screens/rides';
import RideScreen from './src/screens/ride';
import BookScreen, { type Prefill } from './src/screens/book';
import AccountScreen, { GuestAccount } from './src/screens/account';
import Icon, { type IconName } from './src/components/icon';
import { GoldButton, Medal, NATIVE, reduceMotion, T, Tap } from './src/components/ui';
import { C } from './src/theme';
import { Column, Dialog, useDesktop } from './src/lib/layout';
import { Backdrop, DesktopAccount, DesktopHome, DesktopRides, TopNav } from './src/screens/desktop';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

type Tab = 'home' | 'rides' | 'account';
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'home', label: 'Book', icon: 'car' },
  { key: 'rides', label: 'My rides', icon: 'calendar' },
  { key: 'account', label: 'Account', icon: 'user' },
];

/** A tab's screen fades in when it is chosen. */
function Fade({ children }: { children: ReactNode }) {
  const v = useRef(new Animated.Value(reduceMotion() ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 220, useNativeDriver: NATIVE }).start();
  }, [v]);
  return <Animated.View style={{ flex: 1, opacity: v }}>{children}</Animated.View>;
}

/** Nobody is signed in: the app still works, with empty lists and a sign-in step when a request is sent. */
const GUEST: Me = { id: 0, email: '', name: null, phone: null, places: [], ref_code: null, referrals: 0, referral_offer: null, demo: false };

function Main({ session }: { session: Session | null }) {
  const insets = useSafeAreaInsets();
  const userId = session?.user.id || null;
  const signedIn = useRef(!!userId);
  signedIn.current = !!userId;
  const [signIn, setSignIn] = useState(false);
  const [me, setMe] = useState<Me | null | undefined>(userId ? undefined : GUEST); // undefined = loading
  const [rides, setRides] = useState<Ride[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [open, setOpen] = useState<Ride | null>(null);
  const [booking, setBooking] = useState<Prefill | null>(null);
  const pushDone = useRef(false);
  // The website layout (a computer's browser): the booking form lives on the first page instead of a sheet,
  // and a ride opens beside the list on My rides. `form.key` restarts the form with a new prefill.
  const desktop = useDesktop();
  const [form, setForm] = useState<{ key: number; prefill: Prefill }>({ key: 0, prefill: {} });
  const pageY = useRef(new Animated.Value(0)).current;
  const startBooking = (p?: Prefill) => {
    if (!desktop) return setBooking(p || {});
    if (p && Object.keys(p).length) setForm((f) => ({ key: f.key + 1, prefill: p }));
    setTab('home');
  };
  const showRide = (r: Ride) => {
    if (desktop) setTab('rides');
    setOpen(r);
  };

  const refresh = useCallback(async () => {
    if (!signedIn.current) return [] as Ride[];
    setRefreshing(true);
    try {
      const list = await loadRides();
      setRides(list);
      setOpen((cur) => (cur ? list.find((r) => r.id === cur.id) || cur : cur));
      return list;
    } catch (e) {
      console.log('RIDES ERROR', e instanceof Error ? e.message : String(e));
      return [] as Ride[];
    } finally {
      setRefreshing(false);
    }
  }, []);

  const reloadMe = useCallback(async () => {
    if (!signedIn.current) return;
    try {
      setMe(await loadMe());
    } catch (e) {
      console.log('ME ERROR', e instanceof Error ? e.message : String(e));
      setMe(null);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      // signed out (or never signed in): back to the guest view
      setMe(GUEST);
      setRides([]);
      setOpen(null);
      pushDone.current = false;
      return;
    }
    reloadMe().then(() => refresh());
  }, [userId, reloadMe, refresh]);

  // Push token → database, so "confirmed" and "chauffeur on the way" reach this phone.
  // Asked after the first booking exists, when the reason is obvious to the rider.
  useEffect(() => {
    if (!me || !userId || pushDone.current || Platform.OS === 'web' || rides.length === 0) return;
    pushDone.current = true;
    (async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') return;
        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
        const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
        await registerPush(token.data);
      } catch (e) {
        console.log('PUSH ERROR', e instanceof Error ? e.message : String(e));
      }
    })();
  }, [me, userId, rides.length]);

  // Tapping a push opens that ride; coming back to the app refreshes
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const openFromPush = (resp: Notifications.NotificationResponse | null) => {
      const id = Number((resp?.notification.request.content.data as { rideId?: string } | undefined)?.rideId);
      if (!id) return;
      refresh().then((list) => {
        const r = list.find((x) => x.id === id);
        if (r) {
          setTab('rides');
          setOpen(r);
        }
      });
    };
    Notifications.getLastNotificationResponseAsync().then(openFromPush).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(openFromPush);
    const received = Notifications.addNotificationReceivedListener(() => refresh());
    const app = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      sub.remove();
      received.remove();
      app.remove();
    };
  }, [refresh]);

  // website layout: My rides always shows a ride beside the list — the next one, or the latest
  useEffect(() => {
    if (!desktop || tab !== 'rides' || open || rides.length === 0) return;
    const t = (r: Ride) => new Date(r.ride_datetime || r.created_at).getTime();
    const ahead = rides.filter((r) => isUpcoming(r)).sort((a, b) => t(a) - t(b));
    setOpen(ahead[0] || [...rides].sort((a, b) => t(b) - t(a))[0]);
  }, [desktop, tab, open, rides]);

  if (me === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.gold} size="large" />
      </View>
    );
  }
  if (me === null) {
    return (
      <View style={[styles.center, { padding: 28 }]}>
        <Medal icon="info" />
        <Text style={styles.lostTitle}>We could not load your account</Text>
        <Text style={styles.lostText}>Check your connection and try again, or sign in once more.</Text>
        <GoldButton label="Try again" onPress={reloadMe} style={{ alignSelf: 'stretch', marginTop: 26 }} />
        <Tap style={{ marginTop: 8, height: 44, justifyContent: 'center' }} onPress={() => supabase.auth.signOut()} accessibilityRole="button">
          <Text style={{ color: C.goldText, fontWeight: '600', fontSize: 15 }}>Sign out</Text>
        </Tap>
      </View>
    );
  }

  const upcoming = rides.filter((r) => isUpcoming(r)).length;
  const bookAgain = (r: Ride): Prefill => ({
    pickup: r.pickup || '',
    dropoff: r.dropoff || '',
    stops: r.stops,
    tripType: r.trip_type === 'Hourly' ? 'Hourly' : 'One way',
    passengers: parseInt(r.passengers || '', 10) || undefined,
    vehicle: /sprinter/i.test(r.vehicle || '') ? 'Sprinter' : 'SUV',
    hours: r.hours || undefined,
  });
  const loginSheet = (
    <Modal visible={signIn && !userId} transparent={desktop} animationType={desktop ? 'fade' : 'slide'} presentationStyle={desktop ? undefined : 'pageSheet'} onRequestClose={() => setSignIn(false)}>
      <Dialog>
        <Login onCancel={() => setSignIn(false)} onDone={() => setSignIn(false)} />
      </Dialog>
    </Modal>
  );

  if (desktop) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Backdrop hidden={tab !== 'home'} y={pageY} />
        <TopNav tab={tab} onTab={setTab} upcoming={upcoming} onBook={() => startBooking()} />
        {/* the first page stays mounted, so a half-filled booking form survives a look at My rides */}
        <DesktopHome
          me={me}
          rides={rides}
          hidden={tab !== 'home'}
          y={pageY}
          onOpen={showRide}
          onPrefill={startBooking}
          form={
            <BookScreen
              embedded
              key={form.key}
              me={me}
              prefill={form.prefill}
              first={rides.length === 0}
              onClose={() => {}}
              onBooked={(id) => {
                setForm((f) => ({ key: f.key + 1, prefill: {} }));
                setTab('rides');
                reloadMe();
                refresh().then((list) => {
                  const r = list.find((x) => x.id === id);
                  if (r) setOpen(r);
                });
              }}
            />
          }
        />
        {tab === 'rides' && (
          <Fade>
            <DesktopRides
              empty={rides.length === 0}
              list={<RidesScreen rides={rides} refreshing={refreshing} onRefresh={refresh} onOpen={setOpen} onBook={() => startBooking()} onSignIn={userId ? undefined : () => setSignIn(true)} selectedId={open?.id} />}
              detail={open ? <RideScreen embedded key={open.id} ride={open} onClose={() => setOpen(null)} onChanged={refresh} onBookAgain={(r) => startBooking(bookAgain(r))} /> : null}
            />
          </Fade>
        )}
        {tab === 'account' && (
          <Fade>
            <DesktopAccount narrow={!(userId && me.id)}>
              {userId && me.id ? <AccountScreen key={me.id} me={me} onSaved={reloadMe} wide /> : <GuestAccount onSignIn={() => setSignIn(true)} />}
            </DesktopAccount>
          </Fade>
        )}
        {loginSheet}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Fade key={tab}>
        {tab === 'home' && <HomeScreen me={me} rides={rides} refreshing={refreshing} onRefresh={refresh} onBook={(p) => setBooking(p || {})} onOpen={setOpen} />}
        {tab === 'rides' && <RidesScreen rides={rides} refreshing={refreshing} onRefresh={refresh} onOpen={setOpen} onBook={() => setBooking({})} onSignIn={userId ? undefined : () => setSignIn(true)} />}
        {tab === 'account' && (userId && me.id ? <AccountScreen key={me.id} me={me} onSaved={reloadMe} /> : <GuestAccount onSignIn={() => setSignIn(true)} />)}
      </Fade>
      {/* the tab bar floats over the content: a glass pill */}
      <View style={[styles.tabs, { bottom: Math.max(insets.bottom - 8, 14) }]} accessibilityRole="tablist">
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bar }]} />
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <Tap key={t.key} style={styles.tab} to={0.9} feedback={on ? null : 'select'} onPress={() => setTab(t.key)} accessibilityRole="tab" accessibilityLabel={t.key === 'rides' && upcoming > 0 ? `${t.label}, ${upcoming} upcoming` : t.label} accessibilityState={{ selected: on }}>
              <View>
                <Icon name={t.icon} color={on ? C.goldHi : C.muted} />
                {t.key === 'rides' && upcoming > 0 ? (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{upcoming}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
            </Tap>
          );
        })}
      </View>
      {loginSheet}
      <Modal visible={!!booking} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBooking(null)}>
        {booking && (
          <Column>
          <BookScreen
            me={me}
            prefill={booking}
            first={rides.length === 0}
            onClose={() => setBooking(null)}
            onBooked={() => {
              setBooking(null);
              setTab('rides');
              reloadMe();
              refresh();
            }}
          />
          </Column>
        )}
      </Modal>
      <Modal visible={!!open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(null)}>
        {open && (
          <Column>
          <RideScreen
            ride={open}
            onClose={() => setOpen(null)}
            onChanged={refresh}
            onBookAgain={(r) => {
              setOpen(null);
              setBooking(bookAgain(r));
            }}
          />
          </Column>
        )}
      </Modal>
    </View>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // the heading font ships inside the app; if it ever fails to load, headings fall back to the system font
  const [fontsReady, fontsError] = useFonts({ CormorantGaramond_600SemiBold });
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  const ready = session !== undefined && (fontsReady || !!fontsError);
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {/* each screen keeps clear of the status bar itself: the home photo runs under it */}
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {ready ? (
          <Column>
            <Main session={session!} />
          </Column>
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color={C.gold} />
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  tabs: { position: 'absolute', left: 24, right: 24, height: 64, borderRadius: 32, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderWidth: 1, borderColor: C.lineHi },
  tab: { minWidth: 88, height: 52, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabText: { fontSize: 11, fontWeight: '500', color: C.muted },
  tabTextOn: { color: C.goldHi, fontWeight: '600' },
  tabBadge: { position: 'absolute', top: -5, right: -14, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.goldHi, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  tabBadgeText: { fontSize: 11, fontWeight: '700', color: C.onGold },
  lostTitle: { ...T.h2, textAlign: 'center', marginTop: 18 },
  lostText: { ...T.body, color: C.muted, textAlign: 'center', marginTop: 10 },
});
