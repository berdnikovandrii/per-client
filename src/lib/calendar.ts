// "Add to Calendar" for a booked ride. Same calls the CRM app uses for its own calendar sync
// (expo-calendar/legacy): ask once, then write one event with a reminder an hour before.
import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar/legacy';
import { rideText, shortAddress, type Ride } from './api';

export const calendarAvailable = Platform.OS === 'ios';

/** Returns a sentence to show the rider. */
export async function addRideToCalendar(r: Ride): Promise<string> {
  if (!calendarAvailable || !r.ride_datetime) return 'Calendar is not available on this device.';
  const current = await Calendar.getCalendarPermissionsAsync();
  const granted = current.granted || (current.canAskAgain && (await Calendar.requestCalendarPermissionsAsync()).granted);
  if (!granted) return 'Allow calendar access in Settings to add the ride.';
  const calendar = await Calendar.getDefaultCalendarAsync();
  const start = new Date(r.ride_datetime);
  const minutes = r.trip_type === 'Hourly' && r.hours ? r.hours * 60 : 60;
  await Calendar.createEventAsync(calendar.id, {
    title: `Pacific Elite Rides · ${shortAddress(r.pickup)}${r.dropoff ? ` → ${shortAddress(r.dropoff)}` : ''}`,
    startDate: start,
    endDate: new Date(start.getTime() + minutes * 60_000),
    location: r.pickup || undefined,
    notes: rideText(r),
    alarms: [{ relativeOffset: -60 }],
  });
  return 'Added to your calendar, with a reminder one hour before.';
}
