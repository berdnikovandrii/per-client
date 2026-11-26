// One ride: where it stands, the flight, who is driving, the price, paying by card, the receipt,
// and — after the ride — a rating and "Book again". While the chauffeur is on the way or the rider is on board,
// the car is on a map and the screen asks for a fresh position every 12 seconds.
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FlightCard from '../components/flight-card';
import LiveMap from '../components/live-map';
import Icon from '../components/icon';
import { Card, GhostButton, GoldButton, haptic, Label, Pill, reduceMotion, Rise, RouteRail, T, Tap } from '../components/ui';
import {
  agoLabel, cancelRequest, emailReceipt, isAirportText, money, money2, PHONE, PHONE_TEL, payUrl, rate, receipt, receiptText, REVIEW_URL, rideText,
  STATUS, timeLabel, whenLabel, type Ride, type RideStatus,
} from '../lib/api';
import { addRideToCalendar, calendarAvailable } from '../lib/calendar';
import { shareText, webConfirm } from '../lib/layout';
import { C, SERIF } from '../theme';

const STEPS: { key: RideStatus; label: string }[] = [
  { key: 'requested', label: 'Requested' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'on_the_way', label: 'On the way' },
  { key: 'on_board', label: 'On board' },
  { key: 'completed', label: 'Done' },
];

type Props = { ride: Ride; onClose: () => void; onChanged: () => void; onBookAgain: (r: Ride) => void };

const hoursLabel = (h: number) => `${h} hour${h === 1 ? '' : 's'}`;
/** What one car of a multi-car booking is doing right now. */
const STAGE_NOTE: Record<string, string> = { on_my_way: 'On the way', picked_up: 'On board', done: 'Finished' };
const BRANDS: Record<string, string> = { VISA: 'Visa', MASTERCARD: 'Mastercard', AMERICAN_EXPRESS: 'Amex', DISCOVER: 'Discover' };
/** Whole minutes from now until the car gets there (negative once that time has passed). */
const etaLeft = (iso: string, now: number) => Math.round((new Date(iso).getTime() - now) / 60_000);
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const brandName = (b: string | null) => (b ? BRANDS[b] || b.replace(/_/g, ' ') : 'Card');

export default function RideScreen({ ride, onClose, onChanged, onBookAgain }: Props) {
  const [busy, setBusy] = useState<'' | 'cancel' | 'pay' | 'rate' | 'card' | 'mail'>('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [stars, setStars] = useState(ride.rating || 0);
  const [comment, setComment] = useState('');
  const [rated, setRated] = useState(!!ride.rating);
  const insets = useSafeAreaInsets();
  const [dropY, setDropY] = useState(0);
  // the progress line fills up to where the ride stands
  const fill = useRef(new Animated.Value(reduceMotion() ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(fill, { toValue: 1, duration: 1200, delay: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [fill, ride.status]);
  const s = STATUS[ride.status];
  const at = STEPS.findIndex((x) => x.key === ride.status);
  const chauffeurLine = [ride.car, ride.plate].filter(Boolean).join(' · ');
  // a booking with several cars lists every chauffeur; one car keeps the single card
  const team = (ride.vehicles || []).filter((v) => v && (v.chauffeur || v.car));
  const live = ride.status !== 'cancelled' && ride.status !== 'completed';
  const airportPickup = isAirportText(ride.pickup);
  // the paid meet & greet at baggage claim (or the older free name sign) changes where the chauffeur meets the rider
  const greet = (ride.extras || []).some((x) => /meet\s*&\s*greet|name sign/i.test(x));
  const rc = receipt(ride);
  const moving = ride.status === 'on_the_way' || ride.status === 'on_board';
  const car = moving ? ride.location : null;
  // the arrival time counts only for the leg the ride is on, and not long after it has passed
  const etaLeg = ride.status === 'on_board' ? 'dropoff' : 'pickup';
  const eta = car && ride.eta && ride.eta.to === etaLeg && ride.eta.at ? ride.eta : null;

  // while the ride is under way: a fresh position every 12 s, and "updated … ago" kept true in between
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!moving) return;
    const poll = setInterval(onChanged, 12_000);
    const tick = setInterval(() => setNow(Date.now()), 5_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [moving, onChanged]);

  // Back from the payment page: Square tells us about the payment within a minute, so keep asking until the
  // ride shows as paid (or for two and a half minutes — the page may have been closed without paying)
  const [checkingPay, setCheckingPay] = useState(false);
  useEffect(() => {
    if (!checkingPay) return;
    if (ride.paid) {
      setCheckingPay(false);
      return;
    }
    const poll = setInterval(onChanged, 5_000);
    const stop = setTimeout(() => setCheckingPay(false), 150_000);
    return () => {
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, [checkingPay, ride.paid, onChanged]);

  async function doCancel() {
    setBusy('cancel');
    setError('');
    try {
      await cancelRequest(ride.id);
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }
  function cancel() {
    if (Platform.OS === 'web') {
      if (webConfirm('Cancel this request? It has not been confirmed yet, so there is no charge.')) void doCancel();
      return;
    }
    Alert.alert('Cancel this request?', 'It has not been confirmed yet, so there is no charge.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel request', style: 'destructive', onPress: doCancel },
    ]);
  }

  /** Card payment inside the app: the open Square invoice, or a new one made right now. */
  async function pay() {
    setBusy('pay');
    setError('');
    try {
      const url = ride.pay_url || (await payUrl(ride.id));
      if (Platform.OS === 'web') await Linking.openURL(url);
      else await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
      setCheckingPay(true); // back from the payment page: see the effect above
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  /** "Secure your ride": Square's card form on our page. Nothing is charged; the app only opens the page. */
  async function addCard() {
    if (!ride.card?.url) return;
    setBusy('card');
    setError('');
    try {
      if (Platform.OS === 'web') await Linking.openURL(ride.card.url);
      else await WebBrowser.openBrowserAsync(ride.card.url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
      onChanged(); // back from the page: the card shows as saved
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  /** The receipt in our own look, with a PDF, to the rider's email. */
  const [mailedTo, setMailedTo] = useState('');
  async function mailReceipt() {
    setBusy('mail');
    setError('');
    try {
      setMailedTo(await emailReceipt(ride.id));
      haptic.success();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  async function sendRating() {
    if (!stars) return;
    setBusy('rate');
    setError('');
    try {
      await rate(ride.id, stars, comment.trim());
      haptic.success();
      setRated(true);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  const done = Math.max(6, (Math.max(0, at) / (STEPS.length - 1)) * 100);
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const chauffeurTel = (ride.chauffeur_phone || '').replace(/[^\d+]/g, '');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, Platform.OS !== 'ios' && { paddingTop: insets.top + 14 }]}>
        <Text style={styles.when} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} accessibilityRole="header">{whenLabel(ride.ride_datetime)}</Text>
        <Tap onPress={onClose} hitSlop={10} style={styles.close} accessibilityRole="button">
          <Text style={styles.closeText}>Done</Text>
        </Tap>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 28 + insets.bottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {ride.status !== 'cancelled' ? (
          <View style={{ gap: 9 }} accessibilityLabel={`Status: ${s.label}`}>
            <View style={styles.track}>
              <Animated.View style={[styles.trackFill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${done}%`] }) }]} />
            </View>
            <View style={styles.steps}>
              {STEPS.map((step, i) => (
                <Text key={step.key} style={[styles.step, i === at && styles.stepOn]} numberOfLines={1}>{step.label}</Text>
              ))}
            </View>
            <Text style={styles.note}>{s.note}</Text>
          </View>
        ) : (
          <View style={styles.cancelled}>
            <Text style={styles.cancelledText}>{s.note} Need it after all? Call us at {PHONE}.</Text>
          </View>
        )}

        {car ? (
          <Rise>
            <Card gold style={{ gap: 14 }}>
              <View style={styles.rowBetween}>
                <Label>{ride.status === 'on_board' ? 'Your ride, live' : 'Live location'}</Label>
                <Pill label={agoLabel(car.at, now)} tone="green" live />
              </View>
              {eta && etaLeft(eta.at, now) > -4 ? (
                <View accessibilityLabel={etaLeg === 'pickup' ? 'Your chauffeur arrives' : 'You arrive'}>
                  <Text style={styles.etaBig}>
                    {etaLeft(eta.at, now) <= 1 ? (etaLeg === 'pickup' ? 'Arriving now' : 'Almost there') : `${etaLeft(eta.at, now)} min`}
                  </Text>
                  <Text style={T.small}>
                    {etaLeg === 'pickup' ? 'Your chauffeur arrives' : 'You arrive'} about {clock(eta.at)}, with the traffic right now
                  </Text>
                </View>
              ) : null}
              <LiveMap lat={car.lat} lng={car.lng} label={ride.chauffeur || undefined} />
              <GhostButton
                label="Open in Maps"
                icon="map"
                onPress={() => open(`https://maps.apple.com/?ll=${car.lat},${car.lng}&q=${encodeURIComponent(ride.chauffeur ? `${ride.chauffeur}, your chauffeur` : 'Your chauffeur')}`)}
              />
            </Card>
          </Rise>
        ) : null}

        {/* rating first on a finished ride: that is what we want the rider to do next */}
        {ride.status === 'completed' && (
          <Rise>
            <Card gold style={{ gap: 14 }}>
              <Text style={T.h2}>{rated ? 'Your rating' : 'How was your ride?'}</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Tap key={n} to={0.8} feedback="select" onPress={() => !rated && setStars(n)} disabled={rated} hitSlop={4} accessibilityRole="button" accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`} accessibilityState={{ selected: n <= stars }}>
                    <Icon name="star" size={40} color={n <= stars ? C.goldHi : C.faint} filled={n <= stars} stroke={1.3} />
                  </Tap>
                ))}
              </View>
              {!rated && stars > 0 && (
                <>
                  <TextInput
                    style={styles.comment}
                    value={comment}
                    onChangeText={setComment}
                    placeholder={stars >= 4 ? 'Anything we should tell your chauffeur? (optional)' : 'What should we do better?'}
                    placeholderTextColor={C.faint}
                    keyboardAppearance="dark"
                    selectionColor={C.gold}
                    multiline
                  />
                  <GoldButton label="Send" onPress={sendRating} busy={busy === 'rate'} />
                </>
              )}
              {rated && stars === 5 && (
                <>
                  <Text style={styles.sub}>Thank you! A public review helps a small local company more than anything.</Text>
                  <GoldButton label="Leave a Google review" icon="star" onPress={() => open(REVIEW_URL)} />
                </>
              )}
              {rated && stars > 0 && stars < 5 && <Text style={styles.sub}>Thank you. Andrii reads every rating personally.</Text>}
            </Card>
          </Rise>
        )}

        <Rise delay={60}>
          <Card gold={!car && ride.status !== 'completed'} style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 9, paddingTop: 20 }}>{ride.dropoff && dropY > 0 ? <RouteRail height={dropY + 9} grow /> : <View style={styles.lone} />}</View>
              <View style={{ flex: 1, gap: 14 }}>
                <Place label="Pickup" value={ride.pickup || '—'} />
                {ride.stops.map((stop, i) => (
                  <Place key={i} label={`Stop ${i + 1}`} value={stop} />
                ))}
                {ride.dropoff ? (
                  <View onLayout={(e) => setDropY(e.nativeEvent.layout.y)}>
                    <Place label="Drop-off" value={ride.dropoff} />
                  </View>
                ) : null}
              </View>
            </View>
            {ride.passenger || (ride.trip_type === 'Round trip' && ride.return_datetime) || (ride.trip_type === 'Hourly' && ride.hours) ? (
              <View style={styles.facts}>
                {ride.passenger ? <Fact label="Passenger" value={ride.passenger} /> : null}
                {ride.trip_type === 'Round trip' && ride.return_datetime ? <Fact label="Return" value={whenLabel(ride.return_datetime)} /> : null}
                {ride.trip_type === 'Hourly' && ride.hours ? <Fact label="Booked for" value={`${ride.hours} hours`} /> : null}
              </View>
            ) : null}
            {live && (
              <View style={styles.pair}>
                {calendarAvailable && ride.ride_datetime ? (
                  <GhostButton label="Add to Calendar" icon="calendarPlus" style={{ flex: 1 }} onPress={() => addRideToCalendar(ride).then(setNote).catch((e) => setNote(e instanceof Error ? e.message : String(e)))} />
                ) : null}
                <GhostButton label="Share ride" icon="share" style={{ flex: 1 }} onPress={() => shareText(rideText(ride)).catch(() => {})} />
              </View>
            )}
            {!!note && <Text style={styles.hint}>{note}</Text>}
          </Card>
        </Rise>

        {ride.flight_number && (ride.flight || live) ? (
          <Rise delay={120}>
            {ride.flight ? (
              <FlightCard flight={ride.flight} flightNumber={ride.flight_number} pickupAt={ride.ride_datetime} />
            ) : (
              <Card style={{ gap: 6 }}>
                <Label>Flight</Label>
                <Text style={styles.big}>{ride.flight_number}</Text>
                <Text style={styles.sub}>Live status appears here the day before the flight. We adjust the pickup if it is early or late.</Text>
              </Card>
            )}
          </Rise>
        ) : null}

        {team.length > 1 && ride.status !== 'cancelled' ? (
          <Rise delay={180}>
            <Card style={{ gap: 14 }}>
              <Label>{`Your chauffeurs · ${team.length} vehicles`}</Label>
              {team.map((v, i) => {
                const tel = (v.chauffeur_phone || '').replace(/[^\d+]/g, '');
                const line = [v.car, v.plate, STAGE_NOTE[v.stage || '']].filter(Boolean).join(' · ');
                return (
                  <View key={i} style={[{ flexDirection: 'row', alignItems: 'center', gap: 14 }, i > 0 && styles.teamRow]}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(v.chauffeur || '·').trim().charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.name}>{v.chauffeur || 'Assigned soon'}</Text>
                      {line ? <Text style={styles.sub}>{line}</Text> : null}
                    </View>
                    {tel ? (
                      <GhostButton label="Call" icon="phone" style={{ height: 44, borderRadius: 22, paddingHorizontal: 16 }} onPress={() => open(`tel:${tel}`)} />
                    ) : null}
                  </View>
                );
              })}
              {!team.some((v) => v.chauffeur_phone) && ride.status === 'confirmed' ? (
                <Text style={styles.hint}>Call buttons appear here a day before the pickup.</Text>
              ) : null}
            </Card>
          </Rise>
        ) : (ride.chauffeur || chauffeurLine) && ride.status !== 'cancelled' ? (
          <Rise delay={180}>
            <Card style={{ gap: 14 }}>
              <Label>Your chauffeur</Label>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(ride.chauffeur || '·').trim().charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.name}>{ride.chauffeur || 'Assigned soon'}</Text>
                  {chauffeurLine ? <Text style={styles.sub}>{chauffeurLine}</Text> : null}
                </View>
              </View>
              {chauffeurTel ? (
                <View style={styles.pair}>
                  <GoldButton label="Call" icon="phone" height={48} style={{ flex: 1, shadowOpacity: 0 }} onPress={() => open(`tel:${chauffeurTel}`)} />
                  <GhostButton label="Text" icon="message" style={{ flex: 1, height: 48, borderRadius: 24 }} onPress={() => open(`sms:${chauffeurTel}`)} />
                </View>
              ) : ride.status === 'confirmed' ? (
                <Text style={styles.hint}>Call and text buttons appear here a day before the pickup.</Text>
              ) : null}
            </Card>
          </Rise>
        ) : null}

        {live && airportPickup && (
          <Card style={{ gap: 14 }}>
            <Label>Where we meet</Label>
            {(greet
              ? [
                  "After you land, switch your phone on. Your chauffeur's name and number are on this screen.",
                  'Your chauffeur waits for you at baggage claim with a sign with your name.',
                  'There is no rush: 60 minutes of waiting are free, 90 on international flights.',
                ]
              : [
                  "After you land, switch your phone on. Your chauffeur's name and number are on this screen.",
                  'Collect your bags. There is no rush: 60 minutes of waiting are free, 90 on international flights.',
                  'Text or call your chauffeur when you have your bags. He tells you the exact pickup spot at your terminal and is there in a few minutes.',
                ]
            ).map((line, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={styles.num}>
                  <Text style={styles.numText}>{i + 1}</Text>
                </View>
                <Text style={styles.meetLine}>{line}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* price → pay → receipt */}
        <Card gold style={{ gap: 14 }}>
          {ride.paid ? (
            <>
              <View style={styles.rowBetween}>
                <Label>Receipt</Label>
                <Pill label="Paid" tone="green" />
              </View>
              <View>
                {rc.lines.map((l) => (
                  <View key={l.label} style={styles.rcRow}>
                    <Text style={styles.rcLabel}>{l.label}</Text>
                    <Text style={styles.rcAmount}>{money2(l.amount)}</Text>
                  </View>
                ))}
                <View style={[styles.rcRow, styles.rcTotal]}>
                  <Text style={styles.rcTotalLabel}>Total paid</Text>
                  <Text style={styles.price}>{money2(rc.total)}</Text>
                </View>
              </View>
              <Text style={styles.sub}>
                {[
                  ride.paid_at ? `Paid ${new Date(ride.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Paid',
                  ride.payment_method,
                  `Ride #${ride.id}`,
                ].filter(Boolean).join(' · ')}
              </Text>
              <GhostButton label={mailedTo ? 'Email it again' : 'Email me the receipt (PDF)'} icon="mail" busy={busy === 'mail'} onPress={mailReceipt} />
              {mailedTo ? <Text style={styles.hintCenter} accessibilityLiveRegion="polite">Sent to {mailedTo}. It arrives within a minute.</Text> : null}
              <GhostButton label="Share as text" icon="share" onPress={() => shareText(receiptText(ride)).catch(() => {})} />
            </>
          ) : (
            <>
              <View style={styles.rowBetween}>
                <Text style={styles.priceLabel}>{ride.price_final ? 'Price' : 'Estimated price'}</Text>
                {ride.price != null ? <Text style={styles.price}>{money(ride.price)}</Text> : null}
              </View>
              {ride.price == null ? <Text style={styles.big}>We will send it shortly</Text> : null}
              <Text style={[styles.sub, { marginTop: -8 }]}>
                {[ride.vehicle, ride.passengers ? `${ride.passengers} passenger${ride.passengers === '1' ? '' : 's'}` : null, ride.deposit_paid ? `deposit ${money(ride.deposit_paid)} paid` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {(ride.pay_url || ride.can_pay) && ride.status !== 'cancelled' ? (
                <>
                  <GoldButton
                    label={ride.pay_kind === 'deposit' ? 'Pay the deposit' : ride.price != null ? `Pay by card · ${money2(Math.round(ride.price * 1.035 * 100) / 100)}` : 'Pay by card'}
                    onPress={pay}
                    busy={busy === 'pay'}
                  />
                  {checkingPay ? (
                    <Text style={[styles.hintCenter, { color: C.goldHi }]} accessibilityLiveRegion="polite">
                      Just paid? We are confirming it with Square. It shows here within a minute, no need to pay again.
                    </Text>
                  ) : null}
                  <Text style={styles.hintCenter}>
                    Secure payment by Square, with Apple Pay. The card price includes a 3.5% processing fee; you can add a gratuity there. Zelle and Venmo have no fee: text us and we send the details.
                  </Text>
                </>
              ) : ride.status === 'requested' ? (
                <Text style={styles.hint}>No payment now. You can pay here as soon as we confirm the ride.</Text>
              ) : null}
            </>
          )}
        </Card>

        {ride.card?.needed ? (
          <Card gold style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.badge}>
                <Icon name="shield" size={20} color={C.goldHi} />
              </View>
              <Text style={[T.h2, { flex: 1 }]}>Secure your ride</Text>
            </View>
            <Text style={styles.sub}>
              Add a card to hold this booking. Nothing is charged now. Cancellation is free up to {hoursLabel(ride.card.free_hours)} before pickup; a later cancellation or a no-show is charged the ride price plus a 3.5% card fee.
            </Text>
            <GoldButton label="Add a card · no charge" icon="card" onPress={addCard} busy={busy === 'card'} />
            <Text style={styles.hintCenter}>The card is entered on a secure Square page. You can still pay by Zelle, Venmo or card.</Text>
          </Card>
        ) : ride.card?.saved ? (
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.badge}>
                <Icon name="card" size={20} color={C.goldHi} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>Card on file</Text>
                {ride.card.last4 ? <Text style={styles.sub}>{brandName(ride.card.brand)} •••• {ride.card.last4}</Text> : null}
              </View>
              <Icon name="check" size={20} color={C.green} stroke={2} />
            </View>
            <Text style={styles.hint}>
              Nothing was charged. It is used only for a no-show or a cancellation later than {hoursLabel(ride.card.free_hours)} before pickup.
            </Text>
          </Card>
        ) : null}

        {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
        {!live && <GoldButton label="Book this ride again" arrow onPress={() => onBookAgain(ride)} />}
        <View style={styles.pair}>
          <GhostButton label="Call dispatch" icon="phone" style={{ flex: 1 }} onPress={() => open(`tel:${PHONE_TEL}`)} />
          <GhostButton label="Text us" icon="message" style={{ flex: 1 }} onPress={() => open(`sms:${PHONE_TEL}`)} />
        </View>
        {ride.status === 'requested' && ride.booked_in_app ? (
          <GhostButton label="Cancel this request" tone="danger" busy={busy === 'cancel'} onPress={cancel} style={{ backgroundColor: 'transparent', borderColor: 'transparent' }} />
        ) : ride.status === 'confirmed' ? (
          <Text style={styles.footNote}>To change or cancel a confirmed ride, call or text us. Pickup {timeLabel(ride.ride_datetime)}.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Place({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={[T.fieldLabel, { lineHeight: 14 }]}>{label}</Text>
      <Text style={styles.place}>{value}</Text>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10 },
  when: { flex: 1, ...SERIF, fontSize: 34, lineHeight: 44, letterSpacing: -0.3, color: C.ink },
  close: { height: 44, justifyContent: 'center', paddingHorizontal: 4 },
  closeText: { fontSize: 16, fontWeight: '600', color: C.goldText },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  track: { height: 4, borderRadius: 2, backgroundColor: C.track, overflow: 'hidden' },
  trackFill: { height: 4, borderRadius: 2, backgroundColor: C.goldHi },
  steps: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { fontSize: 11, color: '#9F9A8F' },
  stepOn: { color: C.goldHi, fontWeight: '600' },
  note: { fontSize: 14, lineHeight: 20, color: C.text, marginTop: 5 },
  cancelled: { borderRadius: 18, padding: 16, backgroundColor: C.redSoft, borderWidth: 1, borderColor: 'rgba(255,120,105,0.25)' },
  cancelledText: { fontSize: 14.5, lineHeight: 21, color: C.red },
  etaBig: { fontSize: 30, lineHeight: 34, fontWeight: '600', color: C.ink, marginBottom: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pair: { flexDirection: 'row', gap: 10 },
  lone: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5, borderColor: C.gold },
  place: { fontSize: 16, lineHeight: 21, color: C.ink },
  facts: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineHi, paddingTop: 12, gap: 8 },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  factLabel: { fontSize: 14, color: C.muted },
  factValue: { fontSize: 14, color: C.ink, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  big: { fontSize: 19, fontWeight: '600', color: C.ink },
  name: { fontSize: 17, fontWeight: '600', color: C.ink },
  sub: { fontSize: 13.5, lineHeight: 19, color: C.muted },
  hint: { fontSize: 12.5, lineHeight: 18, color: C.muted },
  teamRow: { paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineHi },
  hintCenter: { fontSize: 12, lineHeight: 17, color: C.muted, textAlign: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: C.raised, borderWidth: 1, borderColor: 'rgba(200,168,95,0.5)' },
  avatarText: { ...SERIF, fontSize: 26, lineHeight: 30, color: C.goldHi },
  num: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: C.goldSoft },
  numText: { fontSize: 13, fontWeight: '600', color: C.goldHi },
  meetLine: { flex: 1, fontSize: 14, lineHeight: 20, color: '#E9E5DC' },
  priceLabel: { fontSize: 15, color: C.text },
  price: { ...SERIF, fontSize: 34, lineHeight: 38, color: C.goldHi },
  rcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, gap: 12 },
  rcLabel: { fontSize: 15, color: C.text, flex: 1 },
  rcAmount: { fontSize: 15, color: C.ink, fontWeight: '500', fontVariant: ['tabular-nums'] },
  rcTotal: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineHi, marginTop: 6, paddingTop: 12 },
  rcTotalLabel: { fontSize: 16, fontWeight: '600', color: C.ink, flex: 1 },
  stars: { flexDirection: 'row', gap: 8 },
  comment: { borderWidth: 1, borderColor: C.lineHi, borderRadius: 16, padding: 14, fontSize: 15, lineHeight: 20, color: C.ink, minHeight: 72, textAlignVertical: 'top', backgroundColor: C.card },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.goldSoft },
  footNote: { fontSize: 13, lineHeight: 19, color: C.muted, textAlign: 'center' },
  error: { color: C.red, fontSize: 14, lineHeight: 19 },
});
