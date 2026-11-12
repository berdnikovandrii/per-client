// My rides: what is coming up, then what is behind.
import { RefreshControl, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import RideCard from '../components/ride-card';
import { isUpcoming, type Ride } from '../lib/api';
import { C } from '../theme';

type Props = { rides: Ride[]; refreshing: boolean; onRefresh: () => void; onOpen: (r: Ride) => void; onBook: () => void; /** not signed in: offer to */ onSignIn?: () => void };

export default function RidesScreen({ rides, refreshing, onRefresh, onOpen, onBook, onSignIn }: Props) {
  const t = (r: Ride) => new Date(r.ride_datetime || r.created_at).getTime();
  const upcoming = rides.filter((r) => isUpcoming(r)).sort((a, b) => t(a) - t(b));
  const past = rides.filter((r) => !isUpcoming(r)).sort((a, b) => t(b) - t(a));
  const taken = rides.filter((r) => r.status === 'completed').length;
  const sections = [
    ...(upcoming.length ? [{ title: 'Upcoming', data: upcoming }] : []),
    ...(past.length ? [{ title: 'Past', data: past }] : []),
  ];
  return (
    <SectionList
      sections={sections}
      keyExtractor={(r) => String(r.id)}
      renderItem={({ item }) => <RideCard ride={item} onPress={() => onOpen(item)} />}
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>My rides</Text>
          {taken > 0 ? <Text style={styles.count}>{taken} {taken === 1 ? 'ride' : 'rides'} with us{rides.some((r) => r.pay_url || (r.can_pay && !r.paid)) ? ' · payment due on one' : ''}</Text> : null}
        </View>
      }
      ListEmptyComponent={
        onSignIn ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Your rides live here</Text>
            <Text style={styles.emptyText}>Sign in with your email to see your bookings, your chauffeur and the car, receipts and flight status. Rides you booked with us before show up too.</Text>
            <TouchableOpacity style={styles.button} onPress={onSignIn}>
              <Text style={styles.buttonText}>Sign in</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.second} onPress={onBook}>
              <Text style={styles.secondText}>Book a ride first</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No rides yet</Text>
            <Text style={styles.emptyText}>Book your first ride and it will show up here with its status, your chauffeur and the car.</Text>
            <TouchableOpacity style={styles.button} onPress={onBook}>
              <Text style={styles.buttonText}>Book a ride</Text>
            </TouchableOpacity>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 30, fontWeight: '800', color: C.ink, marginBottom: 6 },
  count: { fontSize: 14, color: C.muted, marginBottom: 4 },
  section: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 14, marginBottom: 8, marginLeft: 4 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: C.ink },
  emptyText: { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22, marginTop: 8 },
  button: { backgroundColor: C.black, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 14, marginTop: 18 },
  buttonText: { color: C.gold, fontWeight: '800', fontSize: 16 },
  second: { paddingVertical: 14 },
  secondText: { color: C.goldText, fontWeight: '700', fontSize: 15 },
});
