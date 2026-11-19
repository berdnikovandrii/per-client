// The building blocks of the Noir Concierge look: gold pill button with a moving sheen, cards, labels, chips,
// the sliding segment, fields, and the small motions (rise-in, press scale, pulsing dot). Animated only —
// transforms and opacity on the native driver, and everything stands still when the phone asks for reduced motion.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Icon, { type IconName } from './icon';
import { C, SERIF } from '../theme';

export const NATIVE = Platform.OS !== 'web';

let calm = false;
AccessibilityInfo.isReduceMotionEnabled().then((v) => (calm = v)).catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => (calm = v));
export const reduceMotion = () => calm;

const quiet = (p: Promise<unknown>) => void p.catch(() => {});
export const haptic = {
  tap: () => NATIVE && quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  select: () => NATIVE && quiet(Haptics.selectionAsync()),
  success: () => NATIVE && quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};

/** Shared text styles. */
export const T = StyleSheet.create({
  title: { ...SERIF, fontSize: 40, lineHeight: 44, letterSpacing: -0.3, color: C.ink },
  h2: { ...SERIF, fontSize: 24, lineHeight: 28, color: C.ink },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 2.4, color: C.muted, textTransform: 'uppercase' },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1.6, color: C.muted, textTransform: 'uppercase' },
  body: { fontSize: 15, lineHeight: 21, color: C.text },
  small: { fontSize: 12.5, lineHeight: 18, color: C.muted },
});

/** Content that fades in and rises 14 pt when it first appears. */
export function Rise({ delay = 0, style, children }: { delay?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const v = useRef(new Animated.Value(calm ? 1 : 0)).current;
  useEffect(() => {
    if (calm) return;
    Animated.timing(v, { toValue: 1, duration: 600, delay, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

const APressable = Animated.createAnimatedComponent(Pressable);

type TapProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** how far it shrinks while pressed */
  to?: number;
  feedback?: 'tap' | 'select' | null;
};

/** Anything tappable: it gives slightly under the finger and answers with a light tick. */
export function Tap({ style, children, onPress, to = 0.97, feedback = 'tap', disabled, ...rest }: TapProps) {
  const s = useRef(new Animated.Value(1)).current;
  const spring = (n: number) => Animated.spring(s, { toValue: n, speed: 40, bounciness: 4, useNativeDriver: NATIVE }).start();
  return (
    <APressable
      {...rest}
      disabled={disabled}
      onPressIn={() => spring(to)}
      onPressOut={() => spring(1)}
      onPress={(e) => {
        if (feedback) haptic[feedback]();
        onPress?.(e);
      }}
      style={[style, { transform: [{ scale: s }] }]}
    >
      {children}
    </APressable>
  );
}

type GoldProps = {
  label: string; onPress: () => void; busy?: boolean; disabled?: boolean; /** the round arrow at the right (the main call to action) */ arrow?: boolean;
  icon?: IconName; height?: number; style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
};

/** The primary action: a gold pill, and every few seconds a soft light runs across it. */
export function GoldButton({ label, onPress, busy, disabled, arrow, icon, height = 58, style, accessibilityLabel }: GoldProps) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (calm || !w) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
        Animated.delay(1900),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: NATIVE }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [w, x]);
  const r = height / 2;
  return (
    <Tap
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!(busy || disabled), busy: !!busy }}
      style={[gold.wrap, { height, borderRadius: r }, disabled && { opacity: 0.45 }, style]}
    >
      <LinearGradient colors={[C.goldHi, C.gold]} style={[StyleSheet.absoluteFill, { borderRadius: r }]} />
      <View style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: 'hidden' }]} pointerEvents="none" onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <Animated.View style={[gold.sheen, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-190, w + 30] }) }, { skewX: '-14deg' }] }]}>
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
        </Animated.View>
      </View>
      {busy ? (
        <ActivityIndicator color={C.onGold} />
      ) : arrow ? (
        <View style={gold.arrowRow}>
          <Text style={gold.text}>{label}</Text>
          <View style={[gold.arrow, { width: height - 16, height: height - 16, borderRadius: (height - 16) / 2 }]}>
            <Icon name="arrow" size={20} color={C.goldHi} />
          </View>
        </View>
      ) : (
        <View style={gold.row}>
          {icon ? <Icon name={icon} size={18} color={C.onGold} stroke={1.7} /> : null}
          <Text style={[gold.text, height < 54 && { fontSize: 15 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{label}</Text>
        </View>
      )}
    </Tap>
  );
}

const gold = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', shadowColor: C.gold, shadowOpacity: 0.28, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  sheen: { position: 'absolute', top: 0, bottom: 0, width: 160 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18 },
  arrowRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 26, paddingRight: 8 },
  arrow: { backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 17, fontWeight: '600', color: C.onGold },
});

/** The quiet second action: a dark pill with a gold icon. */
export function GhostButton({ label, onPress, icon, style, tone, busy }: { label: string; onPress: () => void; icon?: IconName; style?: StyleProp<ViewStyle>; tone?: 'danger'; busy?: boolean }) {
  return (
    <Tap onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={label} style={[ghost.wrap, style]}>
      {busy ? <ActivityIndicator color={C.goldHi} /> : (
        <>
          {icon ? <Icon name={icon} size={18} color={tone === 'danger' ? C.red : C.goldHi} /> : null}
          <Text style={[ghost.text, tone === 'danger' && { color: C.red }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{label}</Text>
        </>
      )}
    </Tap>
  );
}

const ghost = StyleSheet.create({
  wrap: { height: 46, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, backgroundColor: C.raised, borderWidth: 1, borderColor: C.line },
  text: { fontSize: 14, fontWeight: '600', color: C.ink },
});

/** A card. `gold` is the one that matters most on the screen: soft gradient and a gold hairline. */
export function Card({ gold: isGold, style, children }: { gold?: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  if (isGold) {
    return (
      <LinearGradient colors={[C.cardHi, C.cardLo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[card.base, card.gold, style]}>
        {children}
      </LinearGradient>
    );
  }
  return <View style={[card.base, card.plain, style]}>{children}</View>;
}

const card = StyleSheet.create({
  base: { borderRadius: 22, padding: 18, borderWidth: 1 },
  plain: { backgroundColor: C.cardLo, borderColor: C.line },
  gold: { borderColor: C.goldLine },
});

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[T.label, style]}>{children}</Text>;
}

/** A small dot with a ring that keeps spreading: "this is live". */
export function PulseDot({ color = C.greenDot }: { color?: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (calm) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={pulse.box}>
      <Animated.View style={[pulse.ring, { backgroundColor: color, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 3.4] }) }] }]} />
      <View style={[pulse.dot, { backgroundColor: color }]} />
    </View>
  );
}

const pulse = StyleSheet.create({
  box: { width: 6, height: 6, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

export type Tone = 'neutral' | 'gold' | 'green' | 'red' | 'blue' | 'orange';
export const TONES: Record<Tone, { color: string; soft: string }> = {
  neutral: { color: C.text, soft: C.chip },
  gold: { color: C.goldHi, soft: C.goldSoft },
  green: { color: C.green, soft: C.greenSoft },
  red: { color: C.red, soft: C.redSoft },
  blue: { color: C.blue, soft: C.blueSoft },
  orange: { color: C.orange, soft: C.orangeSoft },
};

/** A small status chip. `live` adds the pulsing dot. */
export function Pill({ label, tone = 'neutral', live, icon }: { label: string; tone?: Tone; live?: boolean; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <View style={[pill.wrap, { backgroundColor: t.soft }]}>
      {live ? <PulseDot color={tone === 'green' ? C.greenDot : t.color} /> : null}
      {icon ? <Icon name={icon} size={12} color={t.color} filled /> : null}
      <Text style={[pill.text, { color: t.color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const pill = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 26, paddingHorizontal: 11, borderRadius: 13, maxWidth: '100%' },
  text: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
});

/** Two or three choices in one pill; the gold thumb slides to the chosen one. */
export function Segment<V extends string>({ items, value, onChange, style }: { items: readonly V[]; value: V; onChange: (v: V) => void; style?: StyleProp<ViewStyle> }) {
  const [w, setW] = useState(0);
  const index = Math.max(0, items.indexOf(value));
  const x = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    if (calm) return x.setValue(index);
    Animated.spring(x, { toValue: index, speed: 18, bounciness: 5, useNativeDriver: NATIVE }).start();
  }, [index, x]);
  const itemW = w ? (w - 8) / items.length : 0;
  return (
    <View style={[seg.wrap, style]} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {itemW > 0 ? (
        <Animated.View style={[seg.thumb, { width: itemW, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, itemW] }) }] }]}>
          <LinearGradient colors={[C.goldHi, C.gold]} style={{ flex: 1, borderRadius: 19 }} />
        </Animated.View>
      ) : null}
      {items.map((it) => {
        const on = it === value;
        return (
          <Pressable
            key={it}
            style={seg.item}
            onPress={() => {
              if (!on) haptic.select();
              onChange(it);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[seg.text, on && seg.textOn]}>{it}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const seg = StyleSheet.create({
  wrap: { height: 46, padding: 3, borderRadius: 23, flexDirection: 'row', backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  thumb: { position: 'absolute', left: 3, top: 3, bottom: 3 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 14, fontWeight: '500', color: C.text },
  textOn: { color: C.onGold, fontWeight: '600' },
});

type FieldProps = TextInputProps & { label: string; style?: StyleProp<ViewStyle> };

/** A labelled text field; the border turns gold while it is being edited. */
export function Field({ label, style, multiline, onFocus, onBlur, ...input }: FieldProps) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: 8 }, style]}>
      <Text style={T.fieldLabel}>{label}</Text>
      <TextInput
        {...input}
        multiline={multiline}
        accessibilityLabel={label}
        placeholderTextColor={C.faint}
        keyboardAppearance="dark"
        selectionColor={C.gold}
        onFocus={(e) => {
          setFocus(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          onBlur?.(e);
        }}
        style={[field.input, multiline && field.multi, focus && field.focus]}
      />
    </View>
  );
}

const field = StyleSheet.create({
  input: { height: 54, paddingHorizontal: 16, borderRadius: 16, fontSize: 16, color: C.ink, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  multi: { height: undefined, minHeight: 54, paddingTop: 16, paddingBottom: 16, textAlignVertical: 'top' },
  focus: { borderColor: C.gold },
});

/** − 2 + */
export function Stepper({ label, value, min, max, onChange, note, style }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; note?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 8 }, style]}>
      <Text style={T.fieldLabel} numberOfLines={1}>{label}</Text>
      <View style={step.box}>
        <Tap style={[step.btn, value <= min && step.off]} onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min} feedback="select" accessibilityRole="button" accessibilityLabel={`Fewer ${label}`}>
          <Icon name="minus" size={18} />
        </Tap>
        <Text style={step.value} accessibilityLabel={`${value} ${label}`}>{value}</Text>
        <Tap style={[step.btn, value >= max && step.off]} onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max} feedback="select" accessibilityRole="button" accessibilityLabel={`More ${label}`}>
          <Icon name="plus" size={18} />
        </Tap>
      </View>
      {note ? <Text style={step.note}>{note}</Text> : null}
    </View>
  );
}

const step = StyleSheet.create({
  box: { height: 54, paddingHorizontal: 5, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  btn: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
  value: { fontSize: 18, fontWeight: '600', color: C.ink, minWidth: 24, textAlign: 'center' },
  note: { fontSize: 12, color: C.muted },
});

/** The gold dot → line → square that joins a pickup to a drop-off. */
export function RouteRail({ height, grow }: { height: number; /** draw the line in when it appears */ grow?: boolean }) {
  const v = useRef(new Animated.Value(grow && !calm ? 0 : 1)).current;
  useEffect(() => {
    if (!grow || calm) return;
    Animated.timing(v, { toValue: 1, duration: 900, delay: 300, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
  }, [grow, v]);
  const line = Math.max(0, height - 18);
  return (
    <View style={{ width: 9, height, alignItems: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={rail.from} />
      <Animated.View style={{ width: 1, height: line, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-line / 2, 0] }) }, { scaleY: v }] }}>
        <LinearGradient colors={[C.gold, 'rgba(200,168,95,0.22)']} style={{ flex: 1 }} />
      </Animated.View>
      <View style={rail.to} />
    </View>
  );
}

const rail = StyleSheet.create({
  from: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5, borderColor: C.gold },
  to: { width: 9, height: 9, borderRadius: 2, backgroundColor: C.gold },
});

/** A gold-ringed circle with an icon: empty states and "done" screens. */
export function Medal({ icon, pop }: { icon: IconName; /** spring in */ pop?: boolean }) {
  const v = useRef(new Animated.Value(pop && !calm ? 0 : 1)).current;
  useEffect(() => {
    if (!pop || calm) return;
    Animated.spring(v, { toValue: 1, speed: 6, bounciness: 12, useNativeDriver: NATIVE }).start();
  }, [pop, v]);
  return (
    <Animated.View style={[medal.wrap, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
      <Icon name={icon} size={30} color={C.goldHi} />
    </Animated.View>
  );
}

const medal = StyleSheet.create({
  wrap: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldLine },
});
