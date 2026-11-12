// Everything the client app reads or changes goes through the client_* database functions and the
// client-login edge function (supabase/client_app.sql and supabase/functions/client-login in the CRM repo).
// A rider has no direct table access.
import { supabase } from './supabase';
import type { FlightStatus } from './flight';

export const PHONE = '(619) 394-5340';
export const PHONE_TEL = '+16193945340';
export const SITE = 'https://pacificeliterides.com';

const FUNCTIONS_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const REVIEW_URL = 'https://search.google.com/local/writereview?placeid=ChIJE0qtZLk4QSARFMPubxQjFBs';
export const CARD_FEE = 0.035;

export type Place = { label: string; address: string };
export type Me = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  places: Place[];
  /** the rider's own invite code, and how many friends used it */
  ref_code: string | null;
  referrals: number;
  /** the sentence under "Invite a friend"; null = the block is hidden (set in the CRM database) */
  referral_offer: string | null;
  demo: boolean;
};

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
  /** who rides, when the booking is for someone else */
  passenger: string | null;
  flight_number: string | null;
  flight: FlightStatus | null;
  flight_line: string | null;
  price: number | null;
  /** false while the ride is only requested: the number is an estimate until dispatch confirms */
  price_final: boolean;
  paid: boolean;
  paid_at: string | null;
  payment_method: string | null;
  tip: number | null;
  deposit_paid: number | null;
  pay_url: string | null;
  pay_kind: 'deposit' | 'invoice' | null;
  /** no invoice yet, but the rider may open one himself (ride confirmed, price set) */
  can_pay: boolean;
  rating: number | null;
  chauffeur: string | null;
  chauffeur_phone: string | null;
  car: string | null;
  plate: string | null;
  stage: string | null;
  stage_at: string | null;
  /** where the car is — only while the chauffeur is on the way or the rider is on board */
  location: { lat: number; lng: number; heading: number | null; at: string } | null;
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
  passenger_name?: string;
  passenger_phone?: string;
  extras?: string[];
  /** a friend's invite code (first booking only) */
  ref?: string;
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
  const { data, error } = await supabase.rpc('client_profile');
  if (error) throw new Error(error.message);
  if (!data) return null;
  const m = data as Me;
  return { ...m, places: Array.isArray(m.places) ? m.places : [], referrals: Number(m.referrals) || 0 };
}

export async function savePlaces(places: Place[]) {
  const { error } = await supabase.rpc('client_save_places', { p: places });
  if (error) throw new Error(error.message);
}

/** The card payment page for this ride: the open Square invoice, or a new one made on the spot. */
export async function payUrl(rideId: number): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${FUNCTIONS_URL}/client-pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${data.session?.access_token || ANON}` },
    body: JSON.stringify({ rideId }),
  });
  const out = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !out.url) throw new Error(out.error || 'Could not open the card payment. Please try again.');
  return out.url;
}

export async function rate(rideId: number, stars: number, comment: string) {
  const { error } = await supabase.rpc('client_rate', { p_lead_id: rideId, p_stars: stars, p_comment: comment || null });
  if (error) throw new Error(error.message);
}

export async function saveProfile(name: string, phone: string) {
  const { error } = await supabase.rpc('client_save_profile', { p_name: name, p_phone: phone });
  if (error) throw new Error(error.message);
}

export async function rides(): Promise<Ride[]> {
  const { data, error } = await supabase.rpc('client_rides_v2');
  if (error) throw new Error(error.message);
  return ((Array.isArray(data) ? data : []) as Ride[]).map((r) => ({
    ...r,
    price: r.price == null ? null : Number(r.price),
    hours: r.hours == null ? null : Number(r.hours),
    tip: r.tip == null ? null : Number(r.tip),
    deposit_paid: r.deposit_paid == null ? null : Number(r.deposit_paid),
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
/** "updated just now" / "updated 40 s ago" / "updated 6 min ago" for the car's position */
export function agoLabel(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return '';
  const sec = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (Number.isNaN(sec)) return '';
  if (sec < 20) return 'updated just now';
  if (sec < 90) return `updated ${Math.round(sec / 10) * 10} s ago`;
  return `updated ${Math.round(sec / 60)} min ago`;
}

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

export const isAirportText = (t?: string | null) => /airport|\(san\)|\(lax\)|\bcbx\b/i.test(t || '');

/** Ride details as plain text — for the share sheet and the calendar note. */
export function rideText(r: Ride) {
  return [
    `Pacific Elite Rides · ${whenLabel(r.ride_datetime)}`,
    `Pickup: ${r.pickup || ''}`,
    ...r.stops.map((s, i) => `Stop ${i + 1}: ${s}`),
    r.dropoff ? `Drop-off: ${r.dropoff}` : null,
    r.flight_number ? `Flight: ${r.flight_number}` : null,
    r.chauffeur ? `Chauffeur: ${r.chauffeur}${[r.car, r.plate].filter(Boolean).length ? ` · ${[r.car, r.plate].filter(Boolean).join(' · ')}` : ''}` : null,
    `Questions: ${PHONE}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** A paid ride as a receipt: lines and the total (card fee only when it was paid by card). */
export function receipt(r: Ride) {
  const fare = r.price ?? 0;
  const byCard = /square|card/i.test(r.payment_method || '');
  const fee = byCard ? Math.round(fare * CARD_FEE * 100) / 100 : 0;
  const tip = r.tip ?? 0;
  const lines: { label: string; amount: number }[] = [{ label: r.trip_type === 'Hourly' && r.hours ? `Chauffeur service · ${r.hours} h` : 'Ride', amount: fare }];
  if (fee) lines.push({ label: 'Card processing fee (3.5%)', amount: fee });
  if (tip) lines.push({ label: 'Gratuity', amount: tip });
  return { lines, total: Math.round((fare + fee + tip) * 100) / 100, byCard };
}

export const money2 = (n: number) => `$${Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function receiptText(r: Ride) {
  const rc = receipt(r);
  return [
    'Pacific Elite Rides LLC · TCP 35857B',
    `Receipt for ride #${r.id}`,
    whenLabel(r.ride_datetime),
    `${shortAddress(r.pickup)}${r.dropoff ? ` → ${shortAddress(r.dropoff)}` : ''}`,
    '',
    ...rc.lines.map((l) => `${l.label}: ${money2(l.amount)}`),
    `Total paid: ${money2(rc.total)}`,
    r.paid_at ? `Paid ${new Date(r.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${r.payment_method ? ` · ${r.payment_method}` : ''}` : null,
    '',
    `${PHONE} · pacificeliterides.com`,
  ]
    .filter((x) => x != null)
    .join('\n');
}
