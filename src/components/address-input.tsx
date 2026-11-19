// Address field with Google suggestions (Southern California first) and one-tap airports.
// Without a Places key (web preview, or before the key allows this bundle id) it is a plain text field —
// zone prices still work because they match on the text ("La Jolla", "92037", "SAN").
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from './icon';
import { T, Tap } from './ui';
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

type Place = { label: string; address: string };
type Props = {
  label: string; value: string; onChange: (text: string) => void; placeholder: string;
  places?: Place[];
  /** the one-tap airports and saved places under an empty field (on by default) */
  quick?: boolean;
  /** a boxed field on its own, as on the Account tab: no one-tap buttons */
  bare?: boolean;
};

/** Where the route dot sits, measured from the top of the field. */
export const ADDRESS_DOT_Y = 36;

/** One-tap airports and saved places. */
export function QuickPicks({ places = [], onPick }: { places?: Place[]; onPick: (address: string) => void }) {
  return (
    <View style={styles.quick}>
      {places.map((pl) => (
        <Tap key={`${pl.label}:${pl.address}`} style={[styles.chip, styles.placeChip]} feedback="select" onPress={() => onPick(pl.address)} accessibilityRole="button" accessibilityLabel={`Use ${pl.label}`}>
          <Icon name={/home/i.test(pl.label) ? 'home' : /office|work/i.test(pl.label) ? 'briefcase' : 'pin'} size={14} color={C.text} />
          <Text style={[styles.chipText, { color: C.ink }]}>{pl.label}</Text>
        </Tap>
      ))}
      {AIRPORTS.map((a) => (
        <Tap key={a.label} style={styles.chip} feedback="select" onPress={() => onPick(a.value)} accessibilityRole="button" accessibilityLabel={`Use ${a.label}`}>
          <Icon name="plane" size={13} color={C.goldHi} />
          <Text style={styles.chipText}>{a.label}</Text>
        </Tap>
      ))}
    </View>
  );
}

export default function AddressInput({ label, value, onChange, placeholder, places = [], quick = true, bare }: Props) {
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
    <View style={bare ? { gap: 8 } : styles.wrap}>
      <Text style={[T.fieldLabel, { lineHeight: 14 }]}>{label}</Text>
      <View style={[styles.row, bare ? styles.box : styles.under, focused && { borderColor: C.gold }]}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {/* our own placeholder: the native one came out letter-spaced on iPhone after the field was cleared */}
          {!value ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
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
            keyboardAppearance="dark"
            selectionColor={C.gold}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            returnKeyType="done"
          />
        </View>
        {loading ? <ActivityIndicator color={C.gold} /> : value ? (
          <Tap onPress={() => pick('')} hitSlop={10} style={styles.clear} feedback={null} accessibilityRole="button" accessibilityLabel={`Clear ${label}`}>
            <Icon name="close" size={12} color={C.text} stroke={2} />
          </Tap>
        ) : null}
      </View>
      {!value.trim() && !bare && quick ? <QuickPicks places={places} onPick={pick} /> : null}
      {focused && down && suggestions.length === 0 && value.trim().length >= 3 ? (
        <Text style={styles.down}>Suggestions are not available right now. Please type the full address.</Text>
      ) : null}
      {focused && suggestions.length > 0 && (
        <View style={styles.list}>
          {suggestions.map((s, i) => (
            <Tap key={s} style={[styles.item, i > 0 && styles.itemLine]} to={0.99} feedback="select" onPress={() => pick(s)} accessibilityRole="button">
              <Icon name="pin" size={16} color={C.goldText} />
              <Text style={styles.itemText} numberOfLines={2}>{s}</Text>
            </Tap>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 2, paddingBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  under: { height: 40, borderBottomWidth: 1, borderBottomColor: C.line },
  box: { height: 54, paddingHorizontal: 16, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  input: { fontSize: 16, color: C.ink, paddingVertical: 0, height: 38 },
  placeholder: { fontSize: 16, lineHeight: 38, color: C.faint },
  down: { marginTop: 6, fontSize: 12.5, color: C.muted, lineHeight: 17 },
  clear: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { height: 34, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 17, paddingHorizontal: 12, backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldLine },
  placeChip: { backgroundColor: C.raised, borderColor: C.line },
  chipText: { fontSize: 13, fontWeight: '600', color: C.goldHi },
  list: { marginTop: 8, backgroundColor: C.raised, borderRadius: 14, borderWidth: 1, borderColor: C.lineHi, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12 },
  itemLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineHi },
  itemText: { flex: 1, fontSize: 15, lineHeight: 20, color: C.ink },
});
