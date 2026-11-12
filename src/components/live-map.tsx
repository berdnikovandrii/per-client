// The chauffeur's car on a map (2026-11-11). Apple Maps through react-native-maps: no key, no location
// permission — the app shows the car's position, it never reads the rider's own.
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

type Props = { lat: number; lng: number; label?: string };

export default function LiveMap({ lat, lng, label }: Props) {
  const map = useRef<MapView>(null);
  const first = useRef(true);

  // follow the car; the first position is already the initial region
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    map.current?.animateCamera({ center: { latitude: lat, longitude: lng } }, { duration: 900 });
  }, [lat, lng]);

  return (
    <View style={styles.frame}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.035, longitudeDelta: 0.035 }}
        showsCompass={false}
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled={false}
      >
        <Marker coordinate={{ latitude: lat, longitude: lng }} title={label || 'Your chauffeur'} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.halo}>
            <View style={styles.dot} />
          </View>
        </Marker>
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 210, borderRadius: 12, overflow: 'hidden', marginTop: 10, backgroundColor: '#E9E9EE' },
  halo: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(200,168,95,0.35)', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#080808', borderWidth: 3, borderColor: '#C8A85F' },
});
