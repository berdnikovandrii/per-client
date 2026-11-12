// What the rider sees as the price before sending the request. Same rate card as the website and the CRM
// (src/lib/pricing.ts is a copy of the CRM file — keep them in sync). The app knows no drive time, so a ride
// that is not SAN / LAX / hourly gets no number here: dispatch sends a custom quote.
import { suggestTripPrice } from './pricing';

export type VehicleKey = 'SUV' | 'Sprinter';
export const VEHICLES: { key: VehicleKey; name: string; seats: number; line: string; crm: string }[] = [
  { key: 'SUV', name: 'Luxury SUV', seats: 6, line: 'Escalade or Suburban · up to 6', crm: 'SUV' },
  { key: 'Sprinter', name: 'Sprinter Party Bus', seats: 14, line: 'Hourly · up to 14 · 4 h minimum', crm: 'Sprinter Party Bus' },
];

export type Estimate = { amount: number | null; title: string; basis: string };

const SPRINTER = { first: 180, after: 160, firstHours: 5, min: 4 };

export function estimate(o: {
  pickup: string;
  dropoff: string;
  stops: string[];
  tripType: 'One way' | 'Round trip' | 'Hourly';
  hours: number | null;
  vehicle: VehicleKey;
  passengers: number;
}): Estimate | null {
  const custom = (basis: string): Estimate => ({ amount: null, title: 'Custom quote', basis });

  if (o.vehicle === 'Sprinter') {
    if (o.tripType !== 'Hourly') return custom('The Sprinter is booked by the hour. We will send you the price for this trip.');
    const h = Math.max(SPRINTER.min, o.hours || SPRINTER.min);
    const amount = Math.min(h, SPRINTER.firstHours) * SPRINTER.first + Math.max(0, h - SPRINTER.firstHours) * SPRINTER.after;
    return {
      amount,
      title: 'Estimated price',
      basis: h > SPRINTER.firstHours ? `${SPRINTER.firstHours} h × $${SPRINTER.first} + ${h - SPRINTER.firstHours} h × $${SPRINTER.after}` : `${h} h × $${SPRINTER.first}/h`,
    };
  }
  if (o.passengers > 6) return custom('For more than 6 passengers we send two SUVs or the Sprinter. We will confirm the price.');
  if (!o.pickup.trim() || (o.tripType !== 'Hourly' && !o.dropoff.trim())) return null;

  const s = suggestTripPrice({
    pickup: o.pickup,
    dropoff: o.tripType === 'Hourly' ? o.dropoff || o.pickup : o.dropoff,
    vehicle: 'Suburban',
    routeMinutes: null,
    stops: o.stops.filter((x) => x.trim()),
    tripType: o.tripType,
    hours: o.hours,
  });
  if (!s) return custom('This route is priced individually. We reply with the exact price, usually within 15 minutes.');
  return { amount: s.amount, title: s.roundTrip && o.tripType !== 'Round trip' ? 'Event package (round trip)' : 'Estimated flat rate', basis: s.basis };
}

export const INCLUDED = 'Fuel and tolls included · gratuity not included · card payments +3.5%';
