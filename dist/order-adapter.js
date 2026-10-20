import { restaurant } from './restaurant.config.js';

/** Replace the adapter or set mode="api" and connect your own server endpoint. */
export async function submitOrder(payload, idempotencyKey) {
  if (restaurant.demo || restaurant.ordering.mode === 'demo') {
    return { id: `DEMO-${crypto.randomUUID().slice(0, 6).toUpperCase()}`, status: 'demo', requestedAt: payload.requestedAt, fulfillment: payload.fulfillment };
  }
  if (restaurant.ordering.mode !== 'api') throw new Error('Beställning är tillfälligt otillgänglig. Försök igen senare.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(restaurant.ordering.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      credentials: 'same-origin',
      signal: controller.signal,
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(response.status === 409 ? 'Tiden eller någon rätt är inte längre tillgänglig. Gå tillbaka och kontrollera din beställning.' : 'Beställningen kunde inte bekräftas. Försök igen med samma beställning.');
    const result = await response.json();
    if (!result.id || !['accepted', 'payment_required'].includes(result.status)) throw new Error('Vi kunde inte bekräfta beställningen. Kontakta restaurangen innan du försöker igen.');
    if (result.status === 'payment_required') {
      const paymentUrl = new URL(result.paymentUrl);
      if (paymentUrl.protocol !== 'https:') throw new Error('Betalningen kunde inte öppnas säkert.');
      return { ...result, paymentUrl: paymentUrl.href };
    }
    return result;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('Anslutningen avbröts. Din varukorg finns kvar. Försök igen för att kontrollera samma beställning.');
    throw error;
  } finally { clearTimeout(timeout); }
}

export function foodoraLink(location) {
  if (!location?.foodoraUrl) return null;
  try {
    const url = new URL(location.foodoraUrl);
    return url.protocol === 'https:' && (url.hostname === 'foodora.se' || url.hostname.endsWith('.foodora.se')) ? url.href : null;
  } catch { return null; }
}
