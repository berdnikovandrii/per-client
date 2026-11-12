// Browser preview: no native map here, so a plain box stands in for it.
import { StyleSheet, Text, View } from 'react-native';

type Props = { lat: number; lng: number; label?: string };

export default function LiveMap({ lat, lng, label }: Props) {
  return (
    <View style={styles.frame}>
      <View style={styles.halo}>
        <View style={styles.dot} />
      </View>
      <Text style={styles.text}>{label || 'Your chauffeur'} · {lat.toFixed(4)}, {lng.toFixed(4)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 210, borderRadius: 12, marginTop: 10, backgroundColor: '#E4ECE4', alignItems: 'center', justifyContent: 'center' },
  halo: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(200,168,95,0.35)', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#080808', borderWidth: 3, borderColor: '#C8A85F' },
  text: { fontSize: 12, color: '#555', marginTop: 8 },
});
