// Everything the client app reads or changes goes through the client_* database functions and the
// client-login edge function (supabase/client_app.sql and supabase/functions/client-login in the CRM repo).
// A rider has no direct table access.
import { supabase } from './supabase';

export const PHONE = '(619) 394-5340';
export const PHONE_TEL = '+16193945340';
export const SITE = 'https://pacificeliterides.com';

const FUNCTIONS_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export type Me = { id: number; email: string; name: string | null; phone: string | null };

export type RideStatus = 'requested' | 'confirmed' | 'on_the_way' | 'on_board' | 'completed' | 'cancelled';

export type Ride = {
  id: number;
  status: RideStatus;
  ride_datetime: string | null;
  return_datetime: string | null;
  trip_type: string | null;
  hours: number | null;
  pickup: string | null;
  dropoff: string | null;
  stops: string[];
  vehicle: string | null;
  passengers: string | null;
  flight_number: string | null;
  flight_line: string | null;
  flight_state: string | null;
  price: number | null;
  /** false while the ride is only requested: the number is an estimate until dispatch confirms */
  price_final: boolean;
  paid: boolean;
  pay_url: string | null;
  pay_kind: 'deposit' | 'invoice' | null;
  chauffeur: string | null;
  chauffeur_phone: string | null;
  car: string | null;
  plate: string | null;
  stage: string | null;
  stage_at: string | null;
  booked_in_app: boolean;
  created_at: string;
};

export type Booking = {
  name: string;
  phone: string;
  pickup: string;
  dropoff: string;
  stops: string[];
  when: string;
  return_when: string | null;
  trip_type: 'One way' | 'Round trip' | 'Hourly';
  hours: number | null;
  vehicle: string;
  passengers: number;
  flight_number: string;
  note: string;
  estimate: number | null;
};

async function login(body: Record<string, unknown>, token?: string) {
  const res = await fetch(`${FUNCTIONS_URL}/client-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${token || ANON}` },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; access_token?: string; refresh_token?: string; ok?: boolean };
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

/** Step 1: email the 6-digit code. */
export async function sendCode(email: string) {
  await login({ action: 'start', email });
}

/** Step 2: the code → a session (the auth listener in App.tsx takes over). */
export async function verifyCode(email: string, code: string) {
  const data = await login({ action: 'verify', email, code });
  if (!data.access_token || !data.refresh_token) throw new Error('Could not sign in. Please try again.');
  const { error } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
  if (error) throw new Error(error.message);
}

export async function deleteAccount() {
  const { data } = await supabase.auth.getSession();
  await login({ action: 'delete' }, data.session?.access_token);
  await supabase.auth.signOut();
}

export async function me(): Promise<Me | null> {
  const { data, error } = await supabase.rpc('client_me');
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return (row as Me) || null;
}

export async function saveProfile(name: string, phone: string) {
  const { error } = await supabase.rpc('client_save_profile', { p_name: name, p_phone: phone });
  if (error) throw new Error(error.message);
}

export async function rides(): Promise<Ride[]> {
  const { data, error } = await supabase.rpc('client_rides');
  if (error) throw new Error(error.message);
  return ((data || []) as Ride[]).map((r) => ({
    ...r,
    price: r.price == null ? null : Number(r.price),
    hours: r.hours == null ? null : Number(r.hours),
    stops: Array.isArray(r.stops) ? r.stops.filter((s) => typeof s === 'string' && s.trim()) : [],
  }));
}

export async function book(b: Booking): Promise<number> {
  const { data, error } = await supabase.rpc('client_book', { p: b });
  if (error) throw new Error(error.message);
  return Number(data);
}

export async function cancelRequest(rideId: number) {
  const { error } = await supabase.rpc('client_cancel', { p_lead_id: rideId });
  if (error) throw new Error(error.message);
}

export async function registerPush(token: string) {
  const { error } = await supabase.rpc('client_register_push', { p_token: token });
  if (error) throw new Error(error.message);
}

// ─── formatting ─────────────────────────────────────────────────────────────────────────
export const money = (n: number | null | undefined) => (n == null ? '' : `$${Math.round(n).toLocaleString('en-US')}`);

/** "(SAN) San Diego International Airport, 3225 N Harbor Dr…" → "SAN Airport"; otherwise the first two parts. */
export function shortAddress(address?: string | null) {
  if (!address) return '';
  const text = address.trim();
  const code = text.match(/\(([A-Z]{3})\)/);
  if (code) return `${code[1]} Airport`;
  if (/\blax\b|los angeles international/i.test(text)) return 'LAX Airport';
  if (/san diego international|san diego airport/i.test(text)) return 'SAN Airport';
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.slice(0, 2).join(', ');
}

export function dayLabel(iso: string | null, now = new Date()) {
  if (!iso) return 'No date yet';
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export const timeLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';

export const whenLabel = (iso: string | null) => (iso ? `${dayLabel(iso)} · ${timeLabel(iso)}` : 'No date yet');

export const STATUS: Record<RideStatus, { label: string; color: string; soft: string; note: string }> = {
  requested: { label: 'Requested', color: '#8A6D1F', soft: '#FBF6E9', note: 'We are checking the schedule and will confirm shortly.' },
  confirmed: { label: 'Confirmed', color: '#219653', soft: '#E6F4EA', note: 'Your ride is booked. We will remind you the day before.' },
  on_the_way: { label: 'Chauffeur on the way', color: '#1A56C4', soft: '#E8F0FE', note: 'Your chauffeur is heading to the pickup.' },
  on_board: { label: 'On board', color: '#1A56C4', soft: '#E8F0FE', note: 'Enjoy the ride.' },
  completed: { label: 'Completed', color: '#555555', soft: '#F0F0F2', note: 'Thank you for riding with us.' },
  cancelled: { label: 'Cancelled', color: '#B3261E', soft: '#FDECEA', note: 'This ride is not booked.' },
};

export const isUpcoming = (r: Ride, now = Date.now()) =>
  r.status !== 'cancelled' && r.status !== 'completed' && (!r.ride_datetime || new Date(r.ride_datetime).getTime() > now - 3 * 3_600_000);
