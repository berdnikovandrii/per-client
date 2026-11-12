// Address field with Google suggestions (Southern California first) and one-tap airports.
// Without a Places key (web preview, or before the key allows this bundle id) it is a plain text field —
// zone prices still work because they match on the text ("La Jolla", "92037", "SAN").
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { C } from '../theme';

const KEY = Platform.OS === 'web' ? '' : process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';
const BUNDLE_ID = 'com.pacificeliterides.app';

/** What Google last answered, for the hidden diagnostics on the Account tab (long-press the version line).
 *  Never holds the key itself, only whether there is one and how long it is. */
export const placesDebug = { hasKey: !!KEY, keyLength: KEY.length, calls: 0, last: KEY ? 'no lookup yet' : 'no key in this build' };

export const AIRPORTS = [
  { label: 'SAN Airport', value: 'San Diego International Airport (SAN)' },
  { label: 'LAX', value: 'Los Angeles International Airport (LAX)' },
  { label: 'CBX', value: 'Cross Border Xpress (CBX), 2745 Otay Pacific Dr, San Diego, CA' },
];

type Props = {
  label: string; value: string; onChange: (text: string) => void; placeholder: string; dot?: 'black' | 'gold';
  places?: { label: string; address: string }[];
  /** just the field with suggestions: no route dot and no airport / saved-place buttons (the Account tab) */
  bare?: boolean;
};

export default function AddressInput({ label, value, onChange, placeholder, dot = 'black', places = [], bare }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [down, setDown] = useState(false); // Google answered with an error: say so instead of staying silent
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function type(text: string) {
    onChange(text);
    if (timer.current) clearTimeout(timer.current);
    if (!KEY || text.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(() => lookup(text), 300);
  }

  async function lookup(text: string) {
    setLoading(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${KEY}&components=country:us&location=32.7157,-117.1611&radius=120000`;
      const res = await fetch(url, { headers: { 'X-Ios-Bundle-Identifier': BUNDLE_ID } });
      const data = (await res.json()) as { status?: string; error_message?: string; predictions?: { description: string }[] };
      placesDebug.calls += 1;
      placesDebug.last = `${data.status || `HTTP ${res.status}`}${data.error_message ? `: ${data.error_message}` : ''}`;
      setDown(!!data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS');
      setSuggestions((data.predictions || []).slice(0, 5).map((p) => p.description.replace(/, USA$/, '')));
    } catch (e) {
      placesDebug.calls += 1;
      placesDebug.last = `network: ${e instanceof Error ? e.message : String(e)}`;
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }

  const pick = (text: string) => {
    onChange(text);
    setSuggestions([]);
  };

  return (
    <View style={[styles.wrap, bare && { paddingVertical: 0 }]}>
      <View style={styles.row}>
        {bare ? null : <View style={[styles.dot, dot === 'gold' && { backgroundColor: C.gold }]} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{label}</Text>
          {/* our own placeholder: the native one came out letter-spaced on iPhone after the field was cleared */}
          {!value ? (
            <View style={styles.placeholderBox} pointerEvents="none">
              <Text style={styles.placeholder} numberOfLines={1}>{placeholder}</Text>
            </View>
          ) : null}
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={type}
            accessibilityLabel={`${label}: ${placeholder}`}
            autoCorrect={false}
            spellCheck={false}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            returnKeyType="done"
          />
        </View>
        {loading ? <ActivityIndicator color={C.gold} /> : value ? (
          <TouchableOpacity onPress={() => pick('')} hitSlop={10} accessibilityLabel={`Clear ${label}`}>
            <Text style={styles.clear}>×</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {!value.trim() && !bare && (
        <View style={styles.quick}>
          {places.map((pl) => (
            <TouchableOpacity key={`${pl.label}:${pl.address}`} style={[styles.quickChip, styles.placeChip]} onPress={() => pick(pl.address)}>
              <Text style={[styles.quickText, { color: C.ink }]}>{pl.label}</Text>
            </TouchableOpacity>
          ))}
          {AIRPORTS.map((a) => (
            <TouchableOpacity key={a.label} style={styles.quickChip} onPress={() => pick(a.value)}>
              <Text style={styles.quickText}>✈ {a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {focused && down && suggestions.length === 0 && value.trim().length >= 3 ? (
        <Text style={[styles.down, bare && { marginLeft: 0 }]}>Suggestions are not available right now. Please type the full address.</Text>
      ) : null}
      {focused && suggestions.length > 0 && (
        <View style={[styles.list, bare && { marginLeft: 0 }]}>
          {suggestions.map((s) => (
            <TouchableOpacity key={s} style={styles.item} onPress={() => pick(s)}>
              <Text style={styles.itemText} numberOfLines={2}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.ink, marginTop: 14 },
  label: { fontSize: 11.5, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: { fontSize: 17, color: C.ink, paddingVertical: 6, fontWeight: '600' },
  placeholderBox: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 34, justifyContent: 'center' },
  placeholder: { fontSize: 17, color: '#A1A1A6', fontWeight: '500' },
  down: { marginLeft: 22, marginTop: 4, fontSize: 12.5, color: C.muted, lineHeight: 17 },
  clear: { fontSize: 24, color: '#A1A1A6', paddingHorizontal: 4 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginLeft: 22, marginTop: 4 },
  placeChip: { backgroundColor: '#F0F0F2', borderColor: '#E0E0E5' },
  quickChip: { backgroundColor: C.goldSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#E8D9A8' },
  quickText: { fontSize: 13, fontWeight: '700', color: C.goldText },
  list: { marginLeft: 22, marginTop: 6, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  item: { paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  itemText: { fontSize: 15, color: C.ink },
});
