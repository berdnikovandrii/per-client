// Pacific Elite Rides — the client app (Andrii, 2026-11-11).
// It opens without an account: a guest can look around, fill in a booking and see the price; the email code is
// asked only when the request is sent (or from the Account tab).
// Sign in with an email code, book a ride with the price up front, follow it (status, chauffeur, car, flight),
// pay the Square invoice, get a push when it is confirmed or the chauffeur is on the way. Same database as
// PER CRM and PER Driver, reached only through the client_* functions (supabase/client_app.sql in the CRM repo).
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, View, type ImageSourcePropType } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { C } from './src/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

type Tab = 'home' | 'rides' | 'account';
const TABS: { key: Tab; label: string; icon: ImageSourcePropType; iconOn: ImageSourcePropType }[] = [
  { key: 'home', label: 'Book', icon: require('./assets/tab-car-sport-outline.png'), iconOn: require('./assets/tab-car-sport.png') },
  { key: 'rides', label: 'My rides', icon: require('./assets/tab-calendar-outline.png'), iconOn: require('./assets/tab-calendar.png') },
  { key: 'account', label: 'Account', icon: require('./assets/tab-person-circle-outline.png'), iconOn: require('./assets/tab-person-circle.png') },
];

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
        <Text style={styles.lostTitle}>We could not load your account</Text>
        <Text style={styles.lostText}>Check your connection and try again, or sign in once more.</Text>
        <TouchableOpacity style={styles.retry} onPress={reloadMe}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 16 }} onPress={() => supabase.auth.signOut()}>
          <Text style={{ color: C.muted, fontWeight: '600' }}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const upcoming = rides.filter((r) => isUpcoming(r)).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {tab === 'home' && <HomeScreen me={me} rides={rides} refreshing={refreshing} onRefresh={refresh} onBook={(p) => setBooking(p || {})} onOpen={setOpen} />}
      {tab === 'rides' && <RidesScreen rides={rides} refreshing={refreshing} onRefresh={refresh} onOpen={setOpen} onBook={() => setBooking({})} onSignIn={userId ? undefined : () => setSignIn(true)} />}
      {tab === 'account' && (userId && me.id ? <AccountScreen key={me.id} me={me} onSaved={reloadMe} /> : <GuestAccount onSignIn={() => setSignIn(true)} />)}
      <View style={[styles.tabs, { paddingBottom: Math.max(insets.bottom, 6) }]}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={styles.tab} onPress={() => setTab(t.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <View>
                <Image source={on ? t.iconOn : t.icon} style={[styles.tabIcon, { tintColor: on ? C.ink : '#8E8E93' }]} />
                {t.key === 'rides' && upcoming > 0 ? (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{upcoming}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Modal visible={signIn && !userId} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSignIn(false)}>
        <Login onCancel={() => setSignIn(false)} onDone={() => setSignIn(false)} />
      </Modal>
      <Modal visible={!!booking} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBooking(null)}>
        {booking && (
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
        )}
      </Modal>
      <Modal visible={!!open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(null)}>
        {open && (
          <RideScreen
            ride={open}
            onClose={() => setOpen(null)}
            onChanged={refresh}
            onBookAgain={(r) => {
              setOpen(null);
              setBooking({
                pickup: r.pickup || '',
                dropoff: r.dropoff || '',
                stops: r.stops,
                tripType: r.trip_type === 'Hourly' ? 'Hourly' : 'One way',
                passengers: parseInt(r.passengers || '', 10) || undefined,
                vehicle: /sprinter/i.test(r.vehicle || '') ? 'Sprinter' : 'SUV',
                hours: r.hours || undefined,
              });
            }}
          />
        )}
      </Modal>
    </View>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style={session === undefined ? 'light' : 'dark'} />
      {/* the bottom inset belongs to the tab bar, so its white runs to the edge of the screen */}
      <SafeAreaView style={{ flex: 1, backgroundColor: session === undefined ? C.black : C.bg }} edges={['top']}>
        {session === undefined ? (
          <View style={[styles.center, { backgroundColor: C.black }]}>
            <ActivityIndicator color={C.gold} />
          </View>
        ) : (
          <Main session={session} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  tabs: { flexDirection: 'row', backgroundColor: C.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  tab: { flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 2 },
  tabIcon: { width: 26, height: 26 },
  tabText: { fontSize: 11.5, fontWeight: '600', color: '#8E8E93', marginTop: 3 },
  tabTextOn: { color: C.ink, fontWeight: '800' },
  tabBadge: { position: 'absolute', top: -4, right: -10, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { fontSize: 10.5, fontWeight: '800', color: C.black },
  lostTitle: { fontSize: 20, fontWeight: '800', color: C.ink, textAlign: 'center' },
  lostText: { fontSize: 15, color: C.muted, textAlign: 'center', marginTop: 10, lineHeight: 22 },
  retry: { marginTop: 24, backgroundColor: C.black, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 13 },
  retryText: { color: C.gold, fontWeight: '800', fontSize: 15 },
});
