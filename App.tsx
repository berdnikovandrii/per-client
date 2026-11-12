// Pacific Elite Rides — the client app (Andrii, 2026-11-11).
// Sign in with an email code, book a ride with the price up front, follow it (status, chauffeur, car, flight),
// pay the Square invoice, get a push when it is confirmed or the chauffeur is on the way. Same database as
// PER CRM and PER Driver, reached only through the client_* functions (supabase/client_app.sql in the CRM repo).
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
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
import AccountScreen from './src/screens/account';
import { C } from './src/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

type Tab = 'home' | 'rides' | 'account';
const TABS: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Book' },
  { key: 'rides', label: 'My rides' },
  { key: 'account', label: 'Account' },
];

function Main({ session }: { session: Session }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = loading
  const [rides, setRides] = useState<Ride[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [open, setOpen] = useState<Ride | null>(null);
  const [booking, setBooking] = useState<Prefill | null>(null);
  const pushDone = useRef(false);

  const refresh = useCallback(async () => {
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
    try {
      setMe(await loadMe());
    } catch (e) {
      console.log('ME ERROR', e instanceof Error ? e.message : String(e));
      setMe(null);
    }
  }, []);

  useEffect(() => {
    reloadMe().then(() => refresh());
  }, [session.user.id, reloadMe, refresh]);

  // Push token → database, so "confirmed" and "chauffeur on the way" reach this phone.
  // Asked after the first booking exists, when the reason is obvious to the rider.
  useEffect(() => {
    if (!me || pushDone.current || Platform.OS === 'web' || rides.length === 0) return;
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
  }, [me, rides.length]);

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
      {tab === 'rides' && <RidesScreen rides={rides} refreshing={refreshing} onRefresh={refresh} onOpen={setOpen} onBook={() => setBooking({})} />}
      {tab === 'account' && <AccountScreen me={me} onSaved={reloadMe} />}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>
              {t.label}
              {t.key === 'rides' && upcoming > 0 ? ` · ${upcoming}` : ''}
            </Text>
            <View style={[styles.tabDot, tab === t.key && styles.tabDotOn]} />
          </TouchableOpacity>
        ))}
      </View>
      <Modal visible={!!booking} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBooking(null)}>
        {booking && (
          <BookScreen
            me={me}
            prefill={booking}
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
        {open && <RideScreen ride={open} onClose={() => setOpen(null)} onChanged={refresh} />}
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
      <StatusBar style={session ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1, backgroundColor: session ? C.bg : C.black }} edges={['top', 'bottom']}>
        {session === undefined ? (
          <View style={[styles.center, { backgroundColor: C.black }]}>
            <ActivityIndicator color={C.gold} />
          </View>
        ) : session ? (
          <Main session={session} />
        ) : (
          <Login />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  tabs: { flexDirection: 'row', backgroundColor: C.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  tab: { flex: 1, alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  tabText: { fontSize: 14.5, fontWeight: '600', color: C.muted },
  tabTextOn: { color: C.ink, fontWeight: '800' },
  tabDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent', marginTop: 4 },
  tabDotOn: { backgroundColor: C.gold },
  lostTitle: { fontSize: 20, fontWeight: '800', color: C.ink, textAlign: 'center' },
  lostText: { fontSize: 15, color: C.muted, textAlign: 'center', marginTop: 10, lineHeight: 22 },
  retry: { marginTop: 24, backgroundColor: C.black, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 13 },
  retryText: { color: C.gold, fontWeight: '800', fontSize: 15 },
});
