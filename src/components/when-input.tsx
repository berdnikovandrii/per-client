// Date + time of the pickup: a field that reads "Tomorrow · 12:10 AM" and, under it, the iPhone's own wheel.
// iPhone: the system wheel picker opens in place; web: the browser's own field; Android: two system dialogs.
import { createElement } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Icon from './icon';
import { Rise, T, Tap } from './ui';
import { dayLabel } from '../lib/api';
import { C } from '../theme';

const pad = (n: number) => String(n).padStart(2, '0');
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "Tomorrow · 12:10 AM" */
export const whenText = (d: Date) => `${dayLabel(d.toISOString())} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

type FieldProps = { label: string; value: Date; onChange: (d: Date) => void; min?: Date; open: boolean; onToggle: () => void; style?: StyleProp<ViewStyle> };

/** The field. On iPhone and the web it opens <WhenPicker> (the screen decides where that goes). */
export function WhenField({ label, value, onChange, min, open, onToggle, style }: FieldProps) {
  function press() {
    if (Platform.OS !== 'android') return onToggle();
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      minimumDate: min,
      onChange: (_e, day) => {
        if (!day) return;
        DateTimePickerAndroid.open({
          value: day,
          mode: 'time',
          onChange: (_e2, t) => t && onChange(new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.getHours(), t.getMinutes())),
        });
      },
    });
  }
  return (
    <View style={[{ gap: 8 }, style]}>
      <Text style={T.fieldLabel} numberOfLines={1}>{label}</Text>
      <Tap style={[styles.field, open && { borderColor: C.gold }]} onPress={press} feedback="select" accessibilityRole="button" accessibilityLabel={`${label}: ${whenText(value)}`} accessibilityState={{ expanded: open }}>
        <Icon name="clock" size={18} color={C.gold} />
        <Text style={styles.text} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{whenText(value)}</Text>
      </Tap>
    </View>
  );
}

/** The wheel, shown under the field that opened it. */
export function WhenPicker({ value, onChange, min, onDone }: { value: Date; onChange: (d: Date) => void; min?: Date; onDone: () => void }) {
  return (
    <Rise style={styles.picker}>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={value}
          mode="datetime"
          display="spinner"
          minuteInterval={5}
          minimumDate={min}
          themeVariant="dark"
          textColor={C.ink}
          accentColor={C.gold}
          style={{ height: 180 }}
          onChange={(_e, d) => d && onChange(d)}
        />
      ) : (
        createElement('input', {
          type: 'datetime-local',
          value: local(value),
          min: min ? local(min) : undefined,
          step: 300,
          onChange: (e: { target: { value: string } }) => {
            const d = new Date(e.target.value);
            if (!Number.isNaN(d.getTime())) onChange(d);
          },
          style: { fontSize: 16, padding: '12px 14px', margin: 14, borderRadius: 12, border: `1px solid ${C.lineHi}`, fontFamily: 'inherit', color: C.ink, background: C.raised, colorScheme: 'dark' },
        })
      )}
      <Tap style={styles.done} onPress={onDone} accessibilityRole="button">
        <Text style={styles.doneText}>Done</Text>
      </Tap>
    </Rise>
  );
}

const styles = StyleSheet.create({
  field: { height: 54, paddingHorizontal: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  text: { flex: 1, fontSize: 15, fontWeight: '500', color: C.ink },
  picker: { borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.goldLine, overflow: 'hidden' },
  done: { height: 46, alignItems: 'center', justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineHi },
  doneText: { fontSize: 15, fontWeight: '600', color: C.goldText },
});
