// My rides: what is coming up, then what is behind.
import { RefreshControl, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import RideCard from '../components/ride-card';
import { isUpcoming, type Ride } from '../lib/api';
import { C } from '../theme';

type Props = { rides: Ride[]; refreshing: boolean; onRefresh: () => void; onOpen: (r: Ride) => void; onBook: () => void };

export default function RidesScreen({ rides, refreshing, onRefresh, onOpen, onBook }: Props) {
  const t = (r: Ride) => new Date(r.ride_datetime || r.created_at).getTime();
  const upcoming = rides.filter((r) => isUpcoming(r)).sort((a, b) => t(a) - t(b));
  const past = rides.filter((r) => !isUpcoming(r)).sort((a, b) => t(b) - t(a));
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
      ListHeaderComponent={<Text style={styles.title}>My rides</Text>}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No rides yet</Text>
          <Text style={styles.emptyText}>Book your first ride and it will show up here with its status, your chauffeur and the car.</Text>
          <TouchableOpacity style={styles.button} onPress={onBook}>
            <Text style={styles.buttonText}>Book a ride</Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 30, fontWeight: '800', color: C.ink, marginBottom: 6 },
  section: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 14, marginBottom: 8, marginLeft: 4 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: C.ink },
  emptyText: { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22, marginTop: 8 },
  button: { backgroundColor: C.black, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 14, marginTop: 18 },
  buttonText: { color: C.gold, fontWeight: '800', fontSize: 16 },
});
