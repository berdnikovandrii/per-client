// Date + time of the pickup. iPhone: the system compact picker; web: the browser's own field; Android: two dialogs.
import { createElement } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { C } from '../theme';

type Props = { label: string; value: Date; onChange: (d: Date) => void; min?: Date };

const pad = (n: number) => String(n).padStart(2, '0');
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function WhenInput({ label, value, onChange, min }: Props) {
  const text = value.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={value}
          mode="datetime"
          display="compact"
          minuteInterval={5}
          minimumDate={min}
          accentColor={C.goldText}
          themeVariant="light"
          onChange={(_e, d) => d && onChange(d)}
        />
      ) : Platform.OS === 'web' ? (
        createElement('input', {
          type: 'datetime-local',
          value: local(value),
          min: min ? local(min) : undefined,
          step: 300,
          onChange: (e: { target: { value: string } }) => {
            const d = new Date(e.target.value);
            if (!Number.isNaN(d.getTime())) onChange(d);
          },
          style: { fontSize: 16, padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.line}`, fontFamily: 'inherit', color: C.ink, background: '#fff' },
        })
      ) : (
        <TouchableOpacity
          style={styles.androidBtn}
          onPress={() =>
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
            })
          }
        >
          <Text style={styles.androidText}>{text}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, gap: 10 },
  label: { fontSize: 16, fontWeight: '600', color: C.ink },
  androidBtn: { backgroundColor: '#F0F0F2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  androidText: { fontSize: 15, fontWeight: '600', color: C.ink },
});
