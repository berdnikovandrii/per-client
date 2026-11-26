// The same app in a browser — the client account on the web (Andrii, 2026-11-25).
// On a phone it fills the screen exactly as on the iPhone. On a wide screen it stays one column in the middle:
// the screens are designed for a phone's width, so they keep it instead of stretching across a monitor.
import type { ReactNode } from 'react';
import { Linking, Platform, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { PHONE, PHONE_TEL, SITE } from './api';
import { C, SERIF } from '../theme';

export const WEB = Platform.OS === 'web';
/** The widest the app's column gets in a browser. */
export const COLUMN = 520;
/** From this width up there is room for the brand panel beside the column. */
const WIDE = 1080;
const APP_STORE = 'https://apps.apple.com/app/id6833778131';

/** The width the screens lay themselves out in: the window on a phone, the column in a wide browser. */
export function useAppWidth() {
  const { width } = useWindowDimensions();
  return WEB ? Math.min(width, COLUMN) : width;
}

/** The root and every sheet on the web sit in this column; on the iPhone it adds nothing. */
export function Column({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  if (!WEB) return <>{children}</>;
  const wide = width >= WIDE;
  return (
    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', backgroundColor: '#050506' }}>
      {wide ? <Aside /> : null}
      <View style={{ flex: 1, width: '100%', maxWidth: COLUMN, backgroundColor: C.bg, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

/** Wide screens only: who we are and how to reach us, beside the account itself. */
function Aside() {
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  return (
    <View style={aside.box}>
      <Text style={aside.kicker}>PACIFIC ELITE RIDES</Text>
      <Text style={[aside.title, SERIF]} accessibilityRole="header">Your rides,{'\n'}in one place</Text>
      <Text style={aside.text}>Book a black car in San Diego, follow your chauffeur on the map, pay by card and keep every receipt.</Text>
      <View style={aside.rule} />
      {['Flat rates, no surge: the price you see is the price you pay', 'Flight tracked on every airport pickup', 'One account here and in the iPhone app'].map((line) => (
        <Text key={line} style={aside.point}>·  {line}</Text>
      ))}
      <View style={aside.links}>
        <Text style={aside.link} accessibilityRole="link" onPress={() => open(`tel:${PHONE_TEL}`)}>{PHONE}</Text>
        <Text style={aside.link} accessibilityRole="link" onPress={() => open(APP_STORE)}>Get the iPhone app</Text>
        <Text style={aside.link} accessibilityRole="link" onPress={() => open(SITE)}>pacificeliterides.com</Text>
      </View>
      <Text style={aside.small}>Pacific Elite Rides LLC · TCP 35857B</Text>
    </View>
  );
}

const aside = StyleSheet.create({
  box: { width: 400, marginRight: 72, justifyContent: 'center', paddingVertical: 40 },
  kicker: { fontSize: 12, letterSpacing: 3.2, fontWeight: '700', color: C.gold },
  title: { fontSize: 52, lineHeight: 58, color: '#FFFFFF', marginTop: 18 },
  text: { fontSize: 17, lineHeight: 26, color: C.muted, marginTop: 18 },
  rule: { height: 1, backgroundColor: C.line, marginVertical: 28 },
  point: { fontSize: 15, lineHeight: 24, color: C.muted, marginBottom: 8 },
  links: { marginTop: 24, gap: 12 },
  link: { fontSize: 16, fontWeight: '600', color: C.gold },
  small: { fontSize: 12, color: C.faint, marginTop: 36 },
});

/** The browser has no native alert sheet: a web page asks with the browser's own dialog instead. */
export function webConfirm(question: string): boolean {
  const ask = (globalThis as { confirm?: (q: string) => boolean }).confirm;
  return ask ? ask(question) : true;
}

export function webNotice(message: string) {
  const tell = (globalThis as { alert?: (m: string) => void }).alert;
  if (tell) tell(message);
}

/** Share sheet on the phone; in a browser without one the text goes to the clipboard and the page says so. */
export async function shareText(message: string): Promise<void> {
  if (!WEB) {
    await Share.share({ message });
    return;
  }
  const nav = (globalThis as { navigator?: { share?: (d: { text: string }) => Promise<void>; clipboard?: { writeText: (t: string) => Promise<void> } } }).navigator;
  if (nav?.share) {
    await nav.share({ text: message });
    return;
  }
  if (nav?.clipboard) {
    await nav.clipboard.writeText(message);
    webNotice('Copied. Paste it into a message or an email.');
  }
}
