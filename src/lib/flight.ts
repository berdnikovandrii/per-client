// Flight status for screens (2026-11-05): one place that turns leads.flight_status into a label + colour,
// so the flight card, the lead list and the desktop pipeline say the same thing.
// (Copied from the CRM's src/lib/flight.ts — keep the two in step.)
export type FlightStatus = {
  number: string;
  status: string;
  airline?: string | null;
  from?: string | null;
  to?: string | null;
  scheduledDeparture?: string | null;
  actualDeparture?: string | null;
  departureTerminal?: string | null;
  departureGate?: string | null;
  quality?: 'live' | 'schedule' | null;
  scheduledArrival?: string | null;
  estimatedArrival?: string | null;
  landedAt?: string | null;
  delayMin?: number | null;
  terminal?: string | null;
  gate?: string | null;
  baggage?: string | null;
  checkedAt: string;
  line: string;
  error?: string | null;
};
export type FlightTone = 'green' | 'orange' | 'blue' | 'red' | 'grey';

export const FLIGHT_TONES: Record<FlightTone, { color: string; background: string }> = {
  green: { color: '#1E7B34', background: '#E6F4EA' },
  orange: { color: '#B35C00', background: '#FFF1DF' },
  blue: { color: '#1A56C4', background: '#E8F0FE' },
  red: { color: '#C62828', background: '#FDECEA' },
  grey: { color: '#5F6368', background: '#EDEDF0' },
};

// Airline names people type instead of the code ("Delta 4020")
const AIRLINE_CODES: Record<string, string> = {
  'AIR CANADA': 'AC', 'ALASKA': 'AS', 'ALLEGIANT': 'G4', 'AMERICAN': 'AA', 'AEROMEXICO': 'AM', 'BRITISH AIRWAYS': 'BA',
  'DELTA': 'DL', 'FRONTIER': 'F9', 'HAWAIIAN': 'HA', 'JETBLUE': 'B6', 'LUFTHANSA': 'LH', 'SOUTHWEST': 'WN',
  'SPIRIT': 'NK', 'SUN COUNTRY': 'SY', 'UNITED': 'UA', 'VOLARIS': 'Y4', 'WESTJET': 'WS',
};

/** The flight number in whatever was typed into "Flight #": "AC 1582 (arr 3:55 PM)" → "AC1582", "Delta 4020" →
 *  "DL4020"; nothing usable → null. Same function as normalizeFlight in supabase/functions/alerts/flights.ts. */
export function normalizeFlight(raw: string | null | undefined) {
  const text = (raw || '').toUpperCase();
  const out = (code: string, num: string) => `${code}${String(parseInt(num, 10))}`;
  const whole = text.replace(/[^A-Z0-9]/g, '').match(/^([A-Z0-9]{2}[A-Z]?)(\d{1,4})$/);
  if (whole && /[A-Z]/.test(whole[1])) return out(whole[1], whole[2]);
  const token = text.match(/\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s*-?\s*(\d{1,4})(?![\d:])/);
  if (token) return out(token[1], token[2]);
  for (const [name, code] of Object.entries(AIRLINE_CODES)) {
    const m = text.match(new RegExp(`\\b${name}\\s*-?\\s*(\\d{1,4})(?![\\d:])`));
    if (m) return out(code, m[1]);
  }
  return null;
}

/** "9:42 PM" in the phone's time zone; '' for no time. */
export function flightTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export const isLanded = (f: FlightStatus) => !!f.landedAt || /Landed|Arrived/i.test(f.status);
export const isInAir = (f: FlightStatus) =>
  !isLanded(f) && !/Canceled|Diverted/i.test(f.status) && (/EnRoute|Departed|Airborne|Approaching/i.test(f.status) || !!f.actualDeparture);

/** Badge for a flight: label (long, for the card) + short (for list badges) + tone. */
export function flightBadge(f: FlightStatus): { label: string; short: string; tone: FlightTone } {
  if (/Canceled/i.test(f.status)) return { label: 'Canceled', short: 'Canceled', tone: 'red' };
  if (/Diverted/i.test(f.status)) return { label: 'Diverted', short: 'Diverted', tone: 'red' };
  if (isLanded(f)) {
    const at = flightTime(f.landedAt);
    return { label: at ? `Landed ${at}` : 'Landed', short: 'Landed', tone: 'green' };
  }
  if (/NotFound/i.test(f.status)) return { label: 'Not found', short: 'Not found', tone: 'grey' };
  if (isInAir(f)) return { label: 'In the air', short: 'In the air', tone: 'blue' };
  if (f.delayMin != null && f.delayMin >= 15) return { label: `Delayed ${f.delayMin} min`, short: `Delayed ${f.delayMin}`, tone: 'orange' };
  if (f.quality === 'schedule' || /Unknown/i.test(f.status)) return { label: 'Schedule only', short: 'Schedule only', tone: 'grey' };
  return { label: 'On time', short: 'On time', tone: 'green' };
}

/** 0 → still at the departure airport, 1 → on the ground at the arrival one. */
export function flightProgress(f: FlightStatus, now = Date.now()) {
  if (isLanded(f) || /Diverted/i.test(f.status)) return 1;
  const dep = f.actualDeparture ? new Date(f.actualDeparture).getTime() : NaN;
  const arr = new Date(f.estimatedArrival || f.scheduledArrival || '').getTime();
  if (Number.isNaN(dep) || dep > now) return 0;
  if (Number.isNaN(arr) || arr <= dep) return 0.5;
  return Math.min(1, Math.max(0, (now - dep) / (arr - dep)));
}

/** "checked 12 min ago" */
export function checkedAgo(iso?: string | null, now = Date.now()) {
  if (!iso) return '';
  const min = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (Number.isNaN(min)) return '';
  if (min < 1) return 'checked just now';
  if (min < 60) return `checked ${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `checked ${h} h ago` : `checked ${Math.round(h / 24)} d ago`;
}
