// My rides: what is coming up, and what is behind — one switch between the two.
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RideCard from '../components/ride-card';
import { GoldButton, Medal, Rise, Segment, T, Tap } from '../components/ui';
import { isUpcoming, paymentDue, type Ride } from '../lib/api';
import { C, TAB_SPACE } from '../theme';

type Props = { rides: Ride[]; refreshing: boolean; onRefresh: () => void; onOpen: (r: Ride) => void; onBook: () => void; /** not signed in: offer to */ onSignIn?: () => void; /** website layout: the ride shown beside the list */ selectedId?: number };

const VIEWS = ['Upcoming', 'Past'] as const;

export default function RidesScreen({ rides, refreshing, onRefresh, onOpen, onBook, onSignIn, selectedId }: Props) {
  const insets = useSafeAreaInsets();
  const t = (r: Ride) => new Date(r.ride_datetime || r.created_at).getTime();
  const upcoming = rides.filter((r) => isUpcoming(r)).sort((a, b) => t(a) - t(b));
  const past = rides.filter((r) => !isUpcoming(r)).sort((a, b) => t(b) - t(a));
  const taken = rides.filter((r) => r.status === 'completed').length;
  // nothing ahead but rides behind: open on the past ones
  const [view, setView] = useState<(typeof VIEWS)[number] | null>(null);
  const shown = view || (upcoming.length === 0 && past.length > 0 ? 'Past' : 'Upcoming');
  const list = shown === 'Upcoming' ? upcoming : past;
  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      data={list}
      extraData={`${shown}:${selectedId}`}
      keyExtractor={(r) => String(r.id)}
      renderItem={({ item, index }) => (
        <Rise key={`${shown}:${item.id}`} delay={Math.min(index, 5) * 70}>
          <RideCard ride={item} lead={selectedId != null ? item.id === selectedId : shown === 'Upcoming' && index === 0} onPress={() => onOpen(item)} />
        </Rise>
      )}
      contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: TAB_SPACE + insets.bottom, flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 16 }}>
          <Text style={T.title} accessibilityRole="header">My rides</Text>
          {taken > 0 ? (
            <Text style={styles.count}>
              {taken} {taken === 1 ? 'ride' : 'rides'} with us{rides.some((r) => paymentDue(r)) ? ' · payment due on one' : ''}
            </Text>
          ) : null}
          {rides.length > 0 ? <Segment items={VIEWS} value={shown} onChange={setView} style={{ marginTop: 16 }} /> : null}
        </View>
      }
      ListEmptyComponent={
        rides.length > 0 ? (
          <View style={styles.none}>
            <Text style={styles.noneText}>{shown === 'Upcoming' ? 'Nothing booked ahead.' : 'No past rides yet.'}</Text>
            {shown === 'Upcoming' ? <GoldButton label="Book a ride" arrow onPress={onBook} style={{ alignSelf: 'stretch', marginTop: 20 }} /> : null}
          </View>
        ) : onSignIn ? (
          <Rise style={styles.empty}>
            <Medal icon="calendar" />
            <Text style={styles.emptyTitle}>Your rides live here</Text>
            <Text style={styles.emptyText}>Sign in with your email to see your bookings, your chauffeur and the car, receipts and flight status. Rides you booked with us before show up too.</Text>
            <GoldButton label="Sign in" onPress={onSignIn} style={{ alignSelf: 'stretch', marginTop: 26 }} />
            <Tap style={styles.second} onPress={onBook} accessibilityRole="button">
              <Text style={styles.secondText}>Book a ride first</Text>
            </Tap>
          </Rise>
        ) : (
          <Rise style={styles.empty}>
            <Medal icon="car" />
            <Text style={styles.emptyTitle}>No rides yet</Text>
            <Text style={styles.emptyText}>Book your first ride and it will show up here with its status, your chauffeur and the car.</Text>
            <GoldButton label="Book a ride" arrow onPress={onBook} style={{ alignSelf: 'stretch', marginTop: 26 }} />
          </Rise>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  count: { fontSize: 14, color: C.muted, marginTop: 4 },
  none: { alignItems: 'center', paddingTop: 36, paddingHorizontal: 8 },
  noneText: { ...T.body, color: C.muted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingBottom: 40 },
  emptyTitle: { ...T.h2, fontSize: 30, lineHeight: 34, marginTop: 20, textAlign: 'center' },
  emptyText: { ...T.body, color: C.muted, textAlign: 'center', marginTop: 10 },
  second: { height: 48, justifyContent: 'center', marginTop: 6 },
  secondText: { color: C.goldText, fontWeight: '600', fontSize: 15 },
});
