// What the app tells Meta, so that ads can be judged by bookings and not only by installs: one event when a ride
// request is sent. No name, phone, email or address ever goes there — only the event and the estimated price.
// The SDK itself reports the install and app opens. Everything here is a no-op when the SDK is not configured.
import Constants from 'expo-constants';
import { AppEventsLogger } from 'react-native-fbsdk-next';

const on = !!(Constants.expoConfig?.extra as { meta?: boolean } | undefined)?.meta;

export function trackBooking(estimate: number | null) {
  if (!on) return;
  try {
    if (estimate != null) AppEventsLogger.logEvent(AppEventsLogger.AppEvents.Schedule, estimate, { fb_currency: 'USD' });
    else AppEventsLogger.logEvent(AppEventsLogger.AppEvents.Schedule);
  } catch (e) {
    console.log('ANALYTICS', e instanceof Error ? e.message : String(e));
  }
}
