// One thin-line icon set for the whole app (24 × 24 grid, 1.5 stroke, round caps), drawn as vectors.
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { C } from '../theme';

export type IconName =
  | 'car' | 'calendar' | 'calendarPlus' | 'user' | 'phone' | 'message' | 'arrow' | 'chevron' | 'back' | 'close' | 'check'
  | 'plus' | 'minus' | 'plusCircle' | 'clock' | 'share' | 'home' | 'pin' | 'card' | 'shield' | 'star' | 'map' | 'receipt'
  | 'gift' | 'lock' | 'mail' | 'plane' | 'signOut' | 'trash' | 'info' | 'briefcase';

type Props = { name: IconName; size?: number; color?: string; stroke?: number; /** star and plane can be solid */ filled?: boolean };

export default function Icon({ name, size = 24, color = C.ink, stroke = 1.5, filled }: Props) {
  const p = { stroke: color, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {name === 'car' && (
        <>
          <Path {...p} d="M3 17v-4l2-5a2 2 0 0 1 1.9-1.3h10.2A2 2 0 0 1 19 8l2 5v4M3 13h18M8.6 17h6.8" />
          <Circle {...p} cx={7} cy={17} r={1.6} />
          <Circle {...p} cx={17} cy={17} r={1.6} />
        </>
      )}
      {(name === 'calendar' || name === 'calendarPlus') && (
        <>
          <Rect {...p} x={3} y={5} width={18} height={16} rx={2.5} />
          <Path {...p} d={name === 'calendarPlus' ? 'M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5' : 'M3 10h18M8 3v4M16 3v4'} />
        </>
      )}
      {name === 'user' && (
        <>
          <Circle {...p} cx={12} cy={8} r={3.6} />
          <Path {...p} d="M5 20c1.2-3.4 3.9-5 7-5s5.8 1.6 7 5" />
        </>
      )}
      {name === 'phone' && <Path {...p} d="M6 3h3l1.5 5-2 1.5a12 12 0 0 0 6 6l1.5-2 5 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" />}
      {name === 'message' && <Path {...p} d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />}
      {name === 'arrow' && <Path {...p} d="M5 12h14M13 6l6 6-6 6" />}
      {name === 'chevron' && <Path {...p} d="M9 5l7 7-7 7" />}
      {name === 'back' && <Path {...p} d="M15 5l-7 7 7 7" />}
      {name === 'close' && <Path {...p} d="M6 6l12 12M18 6L6 18" />}
      {name === 'check' && <Path {...p} d="M5 12.5l4.5 4.5L19 7.5" />}
      {name === 'plus' && <Path {...p} d="M12 5v14M5 12h14" />}
      {name === 'minus' && <Path {...p} d="M5 12h14" />}
      {name === 'plusCircle' && (
        <>
          <Circle {...p} cx={12} cy={12} r={9} />
          <Path {...p} d="M12 8v8M8 12h8" />
        </>
      )}
      {name === 'clock' && (
        <>
          <Circle {...p} cx={12} cy={12} r={9} />
          <Path {...p} d="M12 7v5l3.2 2" />
        </>
      )}
      {name === 'info' && (
        <>
          <Circle {...p} cx={12} cy={12} r={9} />
          <Path {...p} d="M12 11v5M12 8v.2" />
        </>
      )}
      {name === 'share' && <Path {...p} d="M12 15V3M7.5 7.5L12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />}
      {name === 'home' && <Path {...p} d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8z" />}
      {name === 'pin' && (
        <>
          <Path {...p} d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
          <Circle {...p} cx={12} cy={10} r={2.4} />
        </>
      )}
      {name === 'briefcase' && (
        <>
          <Rect {...p} x={3} y={7.5} width={18} height={12.5} rx={2.5} />
          <Path {...p} d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M3 13h18" />
        </>
      )}
      {name === 'card' && (
        <>
          <Rect {...p} x={3} y={6} width={18} height={13} rx={2.5} />
          <Path {...p} d="M3 10.5h18M7 15h3" />
        </>
      )}
      {name === 'shield' && <Path {...p} d="M12 3l7 3v5.5c0 4.4-3 7.9-7 9.5-4-1.6-7-5.1-7-9.5V6l7-3zM9 12l2.2 2.2L15 10.4" />}
      {name === 'star' && <Path {...p} fill={filled ? color : 'none'} d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />}
      {name === 'map' && <Path {...p} d="M9 4l6 2 5-2v14l-5 2-6-2-5 2V6l5-2zM9 4v14M15 6v14" />}
      {name === 'receipt' && <Path {...p} d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6" />}
      {name === 'gift' && (
        <>
          <Rect {...p} x={4} y={11} width={16} height={9} rx={1.5} />
          <Path {...p} d="M3 7.5h18V11H3zM12 7.5V20M12 7.5c-1.4-3.4-5.2-3-4.4-.7.4 1 4.4.7 4.4.7zM12 7.5c1.4-3.4 5.2-3 4.4-.7-.4 1-4.4.7-4.4.7z" />
        </>
      )}
      {name === 'lock' && (
        <>
          <Rect {...p} x={5} y={11} width={14} height={9} rx={2} />
          <Path {...p} d="M8 11V8a4 4 0 0 1 8 0v3" />
        </>
      )}
      {name === 'mail' && (
        <>
          <Rect {...p} x={3} y={5} width={18} height={14} rx={2.5} />
          <Path {...p} d="M3.5 7.5l8.5 6 8.5-6" />
        </>
      )}
      {name === 'plane' && <Path fill={color} d="M21 12l-7-2.2L10 3H8l2 6.2L5 9 3.5 7H2l1 5-1 5h1.5L5 15l5-.2L8 21h2l4-6.8L21 12z" />}
      {name === 'signOut' && <Path {...p} d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h9" />}
      {name === 'trash' && <Path {...p} d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6" />}
    </Svg>
  );
}
