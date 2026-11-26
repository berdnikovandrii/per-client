// The same app in a browser — the client account on the web (Andrii, 2026-11-25).
// On a phone it fills the screen exactly as on the iPhone. On a wide screen it stays one column in the middle:
// the screens are designed for a phone's width, so they keep it instead of stretching across a monitor.
import type { ReactNode } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { C } from '../theme';

export const WEB = Platform.OS === 'web';
/** The widest the app's column gets in a browser. */
export const COLUMN = 520;

/** The width the screens lay themselves out in: the window on a phone, the column in a wide browser. */
export function useAppWidth() {
  const { width } = useWindowDimensions();
  return WEB ? Math.min(width, COLUMN) : width;
}

/** The root and every sheet on the web sit in this column; on the iPhone it adds nothing. */
export function Column({ children }: { children: ReactNode }) {
  if (!WEB) return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#050506' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: COLUMN, backgroundColor: C.bg, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}
