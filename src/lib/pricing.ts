/**
 * Price suggestion — same rules as the estimator on pacificeliterides.com/booking.html,
 * so the app suggests what the website would have quoted:
 * Same evaluation order as WIZ.estimateFare (keep in sync):
 *  1. any LAX leg: $375 flat, one way
 *  2. LA / Orange County event venue either way: $795 / $695 ROUND TRIP incl. up to 5 h wait
 *     (venue names only — "Anaheim, CA" / "Los Angeles, CA" alone stay custom quotes)
 *  3. neither endpoint is SAN → custom quote (the app then suggests drive time × $95/h, like the website does)
 *  4. SAN airport leg: zone rate by the other address (Downtown $60 … Riverside/Corona $350)
 *  - drive-time fallback: rounded up to 30 min, then to $5, never below $75
 *  - stops: SAN zone = the most expensive zone among drop-off and stops; + $25 per stop on every price
 * Maybach uses its own hourly rate ($280/h, 3 h minimum) since zone rates are Suburban/Escalade.
 */

export type PriceSuggestion = {
  amount: number;
  basis: string;
  note?: string;
  /** Event packages are already a round trip (there, wait up to 5 h, back). */
  roundTrip?: boolean;
  /** Part of `amount` that is the per-stop fee (charged once, not doubled for a round trip). */
  stopFee?: number;
  /** LAX flat rate — a round trip is $700, not 2 × $375 (Andrii, 2026-10-11). */
  lax?: boolean;
};

export const LAX_ROUND_TRIP = 700;

/** LA / OC event venues — flat round trip incl. up to 5 h wait. Venue names only, never city names. */
export const EVENT_VENUES: { price: number; name: string; re: RegExp }[] = [
  {
    price: 795,
    name: 'LA event package',
    re: /\bsofi stadium\b|\bdodger stadium\b|\bcrypto\.com arena\b|\bintuit dome\b|\bhollywood bowl\b|\brose bowl\b|\bkia forum\b|\bbmo stadium\b/,
  },
  {
    price: 695,
    name: 'Orange County event package',
    re: /\bhonda center\b|\bangel stadium\b|\bdisneyland\b|\bdisney california adventure\b/,
  },
];

const HOURLY_RATE = 95;
const MIN_FARE = 75;
const MAYBACH_RATE = 280;
const MAYBACH_MIN_HRS = 3;
const STOP_FEE = 25;
// Hourly services include stops (website card: "Multiple stops included", Andrii 2026-10-04) — same list as
// booking.html WIZ.HOURLY_SERVICES. Sprinter and Maybach are hourly vehicles, so their stops are free too.
export const HOURLY_SERVICES = ['Hourly Charter', 'Sprinter Van', 'Maybach VIP'];
const freeStops = (vehicle?: string | null, service?: string | null) =>
  ['Sprinter', 'Maybach'].includes((vehicle || '').trim()) || HOURLY_SERVICES.includes((service || '').trim());

// Order matters: the first match wins, so specific areas come before broad ones
// (e.g. "Chula Vista" and "Linda Vista" must be checked before the "Vista" zone).
const ZONES: { price: number; name: string; re: RegExp }[] = [
  { price: 60, name: 'Downtown', re: /\bdowntown\b|\bgaslamp\b|\bmarina district\b|\beast village\b|\blittle italy\b|\bcore-columbia\b|\bcortez hill\b|\bwestgate hotel\b|\bpetco park\b|\bsan diego convention center\b|\bhorton plaza\b|\bseaport village\b|\bmanchester grand hyatt\b|\bhilton san diego bayfront\b|\bmarriott marquis san diego\b|\bu\.?s\.? grant\b|\bhard rock hotel san diego\b|\bpendry san diego\b|\bomni san diego\b|\b9210[12]\b/ },
  { price: 80, name: 'Coronado', re: /\bcoronado\b|\b92118\b|\bcoronado cays\b/ },
  { price: 80, name: 'Point Loma / Ocean Beach', re: /\bpoint loma\b|\bocean beach\b|\bliberty station\b|\bloma portal\b|\bsunset cliffs\b|\b9210[67]\b/ },
  { price: 85, name: 'Pacific Beach / Mission Beach', re: /\bpacific beach\b|\bmission beach\b|\b92109\b/ },
  { price: 80, name: 'Old Town / Mission Valley / Hillcrest', re: /\bold town\b|\bmission valley\b|\bhillcrest\b|\bnorth park\b|\bsouth park\b|\bmission hills\b|\bbankers hill\b|\buniversity heights\b|\bgolden hill\b|\b9210[348]\b|\b92110\b/ },
  { price: 90, name: 'Clairemont / Linda Vista / Kearny Mesa', re: /\bclairemont\b|\bbay park\b|\blinda vista\b|\bkearny mesa\b|\bserra mesa\b|\b92111\b|\b92117\b|\b92123\b/ },
  { price: 90, name: 'City Heights / College Area', re: /\bcity heights\b|\bkensington\b|\bnormal heights\b|\bcollege area\b|\bsdsu\b|\bsan diego state\b|\bdel cerro\b|\ballied gardens\b|\bsan carlos\b|\b92105\b|\b9211[569]\b|\b92120\b/ },
  { price: 90, name: 'La Jolla / UTC', re: /\bla jolla\b|\butc\b|\buniversity city\b|\btorrey pines\b|\bbird rock\b|\b9203[78]\b|\b92122\b|\b92121\b/ },
  { price: 95, name: 'Del Mar', re: /\bdel mar\b|\bcarmel valley\b|\btorrey hills\b|\b92014\b|\b92130\b/ },
  { price: 110, name: 'Mira Mesa / Scripps Ranch', re: /\bmira mesa\b|\bsorrento valley\b|\bsorrento mesa\b|\bscripps ranch\b|\b92126\b|\b92131\b/ },
  { price: 115, name: 'Rancho Bernardo / Rancho Peñasquitos', re: /\brancho bernardo\b|\brancho pe(n|ñ)asquitos\b|\b4s ranch\b|\bcarmel mountain\b|\bsabre springs\b|\b9212[789]\b/ },
  { price: 95, name: 'Poway', re: /\bpoway\b|\b92064\b/ },
  { price: 90, name: 'La Mesa / Lemon Grove / Spring Valley', re: /\bla mesa\b|\blemon grove\b|\bspring valley\b|\b9194[125]\b|\b9197[78]\b/ },
  { price: 95, name: 'El Cajon / Santee / Lakeside', re: /\bel cajon\b|\bsantee\b|\blakeside\b|\b9202[01]\b|\b92019\b|\b92071\b|\b92040\b/ },
  { price: 110, name: 'Alpine / Jamul', re: /\balpine\b|\bjamul\b|\b91901\b|\b91935\b/ },
  { price: 85, name: 'Eastlake / Otay Ranch', re: /\beastlake\b|\botay ranch\b|\b9191[345]\b/ },
  { price: 75, name: 'National City / Chula Vista', re: /\bnational city\b|\bchula vista\b|\bbonita\b|\b9191[01]\b|\b91950\b|\b91902\b/ },
  { price: 95, name: 'Imperial Beach / San Ysidro / Otay Mesa', re: /\bimperial beach\b|\bsan ysidro\b|\botay mesa\b|\bnestor\b|\b91932\b|\b92173\b|\b92154\b/ },
  { price: 115, name: 'Carlsbad / Encinitas', re: /\bcarlsbad\b|\bencinitas\b|\bsolana beach\b|\bcardiff\b|\bleucadia\b|\b9200[78]\b|\b92009\b|\b9201[01]\b|\b92024\b|\b92075\b/ },
  { price: 120, name: 'Escondido', re: /\bescondido\b|\b9202[5679]\b/ },
  { price: 135, name: "Valley Center / Pauma (Harrah's)", re: /\bvalley center\b|\bpauma\b|\bharrah'?s\b|\b92082\b|\b92061\b/ },
  { price: 130, name: 'Oceanside / Vista / San Marcos', re: /\boceanside\b|\bvista\b|\bsan marcos\b|\b9205[478]\b|\b92069\b|\b9208[134]\b/ },
  { price: 150, name: 'Ramona / Fallbrook', re: /\bramona\b|\bfallbrook\b|\b92065\b|\b92028\b/ },
  { price: 195, name: 'Temecula / Murrieta', re: /\btemecula\b|\bmurrieta\b|\bwildomar\b|\b9259[01234]\b|\b9256[23]\b/ },
  { price: 350, name: 'Riverside / Corona', re: /\briverside\b|\bcorona\b|\b925[0-9]{2}\b|\b9287[89]\b|\b9288[01]\b/ },
];

// Zones match on the place, not the street: "1163 Via Vista Dr, Riverside" is Riverside, not Vista.
// Drops address parts that are a street ("123 Main St", "Via Vista Dr"); keeps names, cities and ZIPs.
const STREET_PART = /^\d+[a-z]?\s+\S|\b(st|street|ave|avenue|dr|drive|rd|road|blvd|boulevard|way|ln|lane|ct|court|pl|place|pkwy|parkway|hwy|highway|cir|circle|ter|terrace|trl|trail|row|loop)\.?$/;
// Clearly outside San Diego County (LA / Orange County names, ZIPs 900xx–918xx and 926xx–927xx) → never a SAN zone
const OUTSIDE_SD = /\blos angeles\b|\bnewport beach\b|\bcorona del mar\b|\birvine\b|\bsanta ana\b|\blong beach\b|\bhuntington beach\b|\borange county\b|\b9[01][0-8]\d\d\b|\b92[67]\d\d\b/;
function zoneOf(address: string) {
  const text = address.toLowerCase();
  if (OUTSIDE_SD.test(text)) return null;
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  const place = parts.length > 1 ? parts.filter((p) => !STREET_PART.test(p)).join(', ') : text;
  return ZONES.find((z) => z.re.test(place || text)) || null;
}

function isSAN(t: string) {
  return (
    /\bsan diego international\b|\bsan diego airport\b|\b\(san\)|\bharbor dr\b.*\bterminal\b|\bterminal [12]\b.*san diego|\b92101\b.*airport/.test(t) ||
    /\bsan\b.*\bairport\b/.test(t)
  );
}

function isLAX(t: string) {
  return /\blax\b|\blos angeles international\b|\bworld way\b/.test(t);
}

function hourly(minutes: number, rate: number, minHours: number) {
  const hrs = minutes / 60;
  const billed = Math.max(minHours, Math.ceil(hrs * 2) / 2);
  return { billed, amount: Math.round((billed * rate) / 5) * 5 };
}

function hoursText(h: number) {
  return Number.isInteger(h) ? `${h} h` : `${Math.floor(h)} h 30 min`;
}

/** Price for one vehicle, one way. `stops` = addresses between pickup and drop-off: +$25 each
 *  (free on hourly services / Sprinter / Maybach; the zone still counts the farthest stop). */
export function suggestPrice(
  pickup?: string | null,
  dropoff?: string | null,
  vehicle?: string | null,
  routeMinutes?: number | null,
  stops: string[] = [],
  service?: string | null
): PriceSuggestion | null {
  const list = stops.map((x) => x.toLowerCase().trim()).filter(Boolean);
  const base = basePrice((pickup || '').toLowerCase(), (dropoff || '').toLowerCase(), vehicle, routeMinutes, list);
  if (!base || !list.length || freeStops(vehicle, service)) return base;
  const fee = STOP_FEE * list.length;
  return {
    ...base,
    amount: base.amount + fee,
    basis: `${base.basis} + ${list.length} stop${list.length === 1 ? '' : 's'} × $${STOP_FEE}`,
    stopFee: fee,
  };
}

function basePrice(
  pu: string,
  dr: string,
  vehicle: string | null | undefined,
  routeMinutes: number | null | undefined,
  stops: string[]
): PriceSuggestion | null {
  if (!pu.trim() || !dr.trim()) return null;

  if ((vehicle || '').trim() === 'Maybach') {
    if (routeMinutes == null) return null;
    const { billed, amount } = hourly(routeMinutes, MAYBACH_RATE, MAYBACH_MIN_HRS);
    return { amount, basis: `Maybach ${hoursText(billed)} × $${MAYBACH_RATE}/h` };
  }

  const longTrip =
    routeMinutes != null && routeMinutes > 150
      ? "One-way drive time only — doesn't include your drive back."
      : undefined;

  if (isLAX(pu) || isLAX(dr)) return { amount: 375, basis: 'LAX flat rate', lax: true };

  const venue = EVENT_VENUES.find((v) => v.re.test(pu) || v.re.test(dr));
  if (venue)
    return {
      amount: venue.price,
      basis: `${venue.name} — round trip, up to 5 h wait`,
      roundTrip: true,
    };

  if (isSAN(pu) || isSAN(dr)) {
    // With stops: the most expensive zone among the other end and the stops (every one must be in a zone)
    const places = [isSAN(pu) ? dr : pu, ...stops.filter((x) => !isSAN(x))];
    const zones = places.map(zoneOf);
    if (zones.every(Boolean)) {
      const zone = zones.reduce((a, b) => (b!.price > a!.price ? b : a))!;
      return { amount: zone.price, basis: `${zone.name} ↔ SAN zone rate` };
    }
  }

  if (routeMinutes == null) return null;
  const { billed, amount } = hourly(routeMinutes, HOURLY_RATE, 0);
  if (amount < MIN_FARE) return { amount: MIN_FARE, basis: `$${MIN_FARE} minimum fare` };
  return {
    amount,
    basis: `${hoursText(billed)} × $${HOURLY_RATE}/h (drive time)`,
    note: longTrip,
  };
}

const CHARTER: Record<string, { rate: number; min: number }> = {
  Sprinter: { rate: 180, min: 4 },
  Maybach: { rate: 280, min: 3 },
};
const CHARTER_DEFAULT = { rate: 95, min: 2 }; // Suburban / Escalade hourly charter

/**
 * Suggestion for the whole booking: trip type (one way / round trip / hourly) × number of vehicles.
 * Round trip = the one-way price twice; hourly = hours × the vehicle's charter rate (with its minimum).
 */
export function suggestTripPrice(opts: {
  pickup?: string | null;
  dropoff?: string | null;
  vehicle?: string | null;
  routeMinutes?: number | null;
  stops?: string[];
  service?: string | null;
  tripType?: string | null;
  hours?: number | null;
  vehicles?: number;
}): PriceSuggestion | null {
  const count = Math.max(1, opts.vehicles || 1);
  const times = (s: PriceSuggestion, n: number, label: string): PriceSuggestion => ({
    ...s,
    amount: s.amount * n,
    basis: n > 1 ? `${s.basis} × ${n} ${label}` : s.basis,
  });

  if (opts.tripType === 'Hourly') {
    const c = CHARTER[(opts.vehicle || '').trim()] || CHARTER_DEFAULT;
    const hrs = Math.max(c.min, opts.hours && opts.hours > 0 ? opts.hours : c.min);
    const one: PriceSuggestion = {
      amount: Math.round(hrs * c.rate),
      basis: `${hrs} h × $${c.rate}/h${hrs === c.min && (!opts.hours || opts.hours < c.min) ? ` (${c.min} h minimum)` : ''}`,
    };
    return times(one, count, 'vehicles');
  }

  const base = suggestPrice(opts.pickup, opts.dropoff, opts.vehicle, opts.routeMinutes ?? null, opts.stops, opts.service);
  if (!base) return null;
  let s = base;
  if (base.roundTrip) {
    // event package already covers there + wait + back
    if (opts.tripType !== 'Round trip') s = { ...base, note: 'Event package is a round trip — set the trip type to Round trip.' };
  } else if (opts.tripType === 'Round trip' && base.lax) {
    s = { amount: LAX_ROUND_TRIP, basis: `LAX round trip flat rate (2 rides × $${LAX_ROUND_TRIP / 2})`, note: 'Return can be any day.' };
  } else if (opts.tripType === 'Round trip') {
    // the stop fee is charged once — stops are on the way there
    const fee = base.stopFee || 0;
    const stopsText = fee ? ` + ${fee / STOP_FEE} stop${fee === STOP_FEE ? '' : 's'} × $${STOP_FEE}` : '';
    const one = fee ? base.basis.slice(0, -stopsText.length) : base.basis;
    s = {
      amount: (base.amount - fee) * 2 + fee,
      basis: `2 × ${one} (there and back)${stopsText}`,
      note: 'Add waiting time if the driver waits in between.',
      stopFee: fee || undefined,
    };
  }
  return times(s, count, 'vehicles');
}
