// The same app in a browser — the client account on the web (Andrii, 2026-11-25).
// On a phone it fills the screen exactly as on the iPhone. On a narrow window it stays one column in the middle.
// On a computer (DESKTOP and wider) it is laid out as a website: a menu on top, the booking form on the first
// page, lists beside their details (src/screens/desktop.tsx).
import { createContext, useContext, type ReactNode } from 'react';
import { Platform, Share, useWindowDimensions, View } from 'react-native';
import { C } from '../theme';

export const WEB = Platform.OS === 'web';
/** The widest the phone layout gets in a browser. */
export const COLUMN = 520;
/** From this window width up the browser gets the website layout. */
export const DESKTOP = 1100;
export const APP_STORE = 'https://apps.apple.com/app/id6833778131';

/** True in a browser window wide enough for the website layout. Always false on the iPhone. */
export function useDesktop() {
  const { width } = useWindowDimensions();
  return WEB && width >= DESKTOP;
}

/** A panel that hosts a phone-width screen (a dialog, the booking card) tells the screen how wide it is. */
const PanelWidth = createContext<number | null>(null);
export const PanelWidthProvider = PanelWidth.Provider;

/** The width the screens lay themselves out in: the window on a phone, the column or the panel in a browser. */
export function useAppWidth() {
  const { width } = useWindowDimensions();
  const panel = useContext(PanelWidth);
  if (panel != null) return panel;
  return WEB ? Math.min(width, COLUMN) : width;
}

/** The root and every sheet on a narrow browser window sit in this column; on the iPhone, and in the website
 *  layout, it adds nothing. */
export function Column({ children }: { children: ReactNode }) {
  const desktop = useDesktop();
  if (!WEB || desktop) return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#050506' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: COLUMN, backgroundColor: C.bg, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

/** A sheet: the whole screen on a phone, a centered window over the dimmed page in the website layout. */
export function Dialog({ children, width = 480 }: { children: ReactNode; width?: number }) {
  const desktop = useDesktop();
  if (!desktop) return <Column>{children}</Column>;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.66)' }}>
      <PanelWidthProvider value={width}>
        <View style={{ width, height: '90%', maxHeight: 760, borderRadius: 28, overflow: 'hidden', backgroundColor: C.bg, borderWidth: 1, borderColor: C.lineHi }}>{children}</View>
      </PanelWidthProvider>
    </View>
  );
}

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
