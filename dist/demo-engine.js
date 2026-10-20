import { restaurant, menu, extras, meal } from './restaurant.config.js';
import { normalizeLine, unitPrice, pickupSlots } from './order-core.js';

// Keep source prices separate from the guest view's current restaurant prices.
export const baseCatalog = structuredClone(menu);
export const activeStatuses = ['received', 'accepted', 'preparing', 'ready'];
export const transitions = {
  received: ['accepted', 'rejected'], accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'], ready: ['completed', 'cancelled'],
  completed: [], rejected: [], cancelled: [],
};
export const statusNames = {
  received: 'Ny beställning', accepted: 'Bekräftad', preparing: 'Tillagas',
  ready: 'Klar', completed: 'Utlämnad', rejected: 'Avböjd', cancelled: 'Avbruten',
};
export class DemoError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, message) => { throw new DemoError(code, message); };

export function initialState() {
  return {
    schemaVersion: 1, revision: 0, orders: [], updatedAt: null,
    operations: Object.fromEntries(restaurant.locations.map(location => [location.id, {
      paused: false, prepMinutes: location.pickupMinutes, slotCapacity: 6, products: {},
    }])),
  };
}
export function normalizeState(raw, now = new Date()) {
  const state = raw?.schemaVersion === 1 && Array.isArray(raw.orders) ? structuredClone(raw) : initialState();
  const defaults = initialState();
  state.operations = Object.fromEntries(restaurant.locations.map(location => [location.id, {
    ...defaults.operations[location.id], ...state.operations?.[location.id],
  }]));
  state.orders = state.orders.filter(order => order && new Date(order.createdAt).getTime() > now.getTime() - 86400000).slice(-100);
  return state;
}
export function operationFor(state, locationId) {
  return state?.operations?.[locationId] || initialState().operations[locationId];
}
export function catalogFor(state, locationId) {
  const operation = operationFor(state, locationId);
  return baseCatalog.map(item => ({ ...item, price: operation?.products?.[item.id]?.price ?? item.price, available: operation?.products?.[item.id]?.available !== false }));
}
export function availableSlots(state, locationId, now = new Date()) {
  const location = restaurant.locations.find(item => item.id === locationId);
  const operation = operationFor(state, locationId);
  if (!location || operation.paused) return [];
  return pickupSlots({ ...location, pickupMinutes: operation.prepMinutes }, now).filter(slot =>
    state.orders.filter(order => order.locationId === locationId && order.requestedAt === slot.value && activeStatuses.includes(order.status)).length < operation.slotCapacity,
  );
}
const touch = (state, now) => { state.revision += 1; state.updatedAt = now.toISOString(); };

export function createDemoOrder(state, payload, key, now = new Date(), uuid = () => crypto.randomUUID()) {
  if (typeof key !== 'string' || !/^[a-zA-Z0-9:_-]{8,100}$/.test(key)) fail('INVALID_KEY', 'Beställningen saknar en giltig försöksnyckel.');
  const location = restaurant.locations.find(item => item.id === payload?.locationId);
  if (!location || payload.restaurantId !== restaurant.id) fail('INVALID_LOCATION', 'Välj en restaurang igen.');
  if (!location.fulfillmentMethods.includes(payload.fulfillment)) fail('INVALID_METHOD', 'Det valda beställningssättet finns inte här.');
  if (!Array.isArray(payload.items) || !payload.items.length || payload.items.length > 50) fail('EMPTY_CART', 'Kontrollera din varukorg.');
  const catalog = catalogFor(state, location.id);
  const lines = payload.items.map(raw => {
    const line = normalizeLine(raw, catalog);
    if (!line || line.quantity !== raw.quantity || line.extraIds.length !== (raw.extraIds || []).length || line.removed.length !== (raw.removed || []).length || line.isMeal !== !!raw.isMeal || line.isMeal && line.drink !== raw.drink) fail('INVALID_ITEM', 'En rätt eller ett tillval har ändrats. Kontrollera din varukorg.');
    const item = catalog.find(item => item.id === line.itemId);
    return { ...line, name: item.name, unitPrice: unitPrice(line, catalog), image: item.image };
  });
  if (lines.reduce((sum, line) => sum + line.quantity, 0) > restaurant.ordering.maxCartItems) fail('TOO_LARGE', 'Beställningen innehåller för många produkter.');
  // No contact data or free-text comments enter the demo order store.
  const fingerprint = JSON.stringify({ locationId: location.id, fulfillment: payload.fulfillment, requestedAt: payload.requestedAt, items: lines.map(({ itemId, quantity, extraIds, removed, isMeal, drink }) => ({ itemId, quantity, extraIds, removed, isMeal, drink })) });
  const existing = state.orders.find(order => order.key === key);
  if (existing) {
    if (existing.fingerprint !== fingerprint) fail('KEY_CONFLICT', 'Försöket hör till en annan beställning. Kontrollera din orderstatus.');
    return existing;
  }
  if (operationFor(state, location.id).paused) fail('PAUSED', 'Onlinebeställning är tillfälligt pausad här. Välj en annan restaurang eller försök senare.');
  const unavailable = lines.find(line => !catalog.find(item => item.id === line.itemId).available);
  if (unavailable) fail('SOLD_OUT', `${unavailable.name} är slutsåld. Ta bort den från varukorgen för att fortsätta.`);
  if (!availableSlots(state, location.id, now).some(slot => slot.value === payload.requestedAt)) fail('SLOT_FULL', 'Den valda tiden är inte längre tillgänglig. Välj en annan tid.');
  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  if (payload.expectedTotal !== undefined && payload.expectedTotal !== total) fail('PRICE_CHANGED', 'Priset har uppdaterats. Kontrollera varukorgen och bekräfta det nya beloppet.');
  if (total < restaurant.ordering.minimumOrder) fail('MINIMUM', 'Beställningen når inte restaurangens minsta orderbelopp.');
  if (state.orders.length >= 100) fail('DEMO_FULL', 'Demon innehåller många beställningar. Återställ visningsdatan för att börja om.');
  const id = `DEMO-${uuid().slice(0, 8).toUpperCase()}`;
  const order = {
    id, trackingToken: uuid(), key, fingerprint, locationId: location.id, fulfillment: payload.fulfillment,
    requestedAt: payload.requestedAt, items: lines, total, status: 'received', source: 'website',
    guestName: 'Demogäst', paymentStatus: 'pay_at_restaurant', createdAt: now.toISOString(), updatedAt: now.toISOString(),
    events: [{ status: 'received', at: now.toISOString(), label: 'Beställningen har kommit in från webbsidan.' }],
    pos: null, example: !!payload.example,
  };
  state.orders.push(order);
  touch(state, now);
  return order;
}
export function transitionOrder(state, id, status, reason = '', now = new Date()) {
  const order = state.orders.find(order => order.id === id);
  if (!order) fail('NOT_FOUND', 'Beställningen finns inte längre i den här demon.');
  if (order.status === status) return order;
  if (!transitions[order.status]?.includes(status)) fail('INVALID_TRANSITION', 'Beställningen har redan ändrats. Uppdatera vyn och kontrollera statusen.');
  if (['cancelled', 'rejected'].includes(status) && !['Slutsålt', 'Kapaciteten är full', 'Kunden avbeställer', 'Restaurangen behöver stänga'].includes(reason)) fail('REASON_REQUIRED', 'Välj en orsak så att gästen vet vad som hände.');
  order.status = status;
  order.updatedAt = now.toISOString();
  order.reason = ['cancelled', 'rejected'].includes(status) ? reason : null;
  order.events.push({ status, at: now.toISOString(), label: reason || statusNames[status] });
  touch(state, now);
  return order;
}
export function updateOperation(state, locationId, patch, now = new Date()) {
  const operation = structuredClone(operationFor(state, locationId));
  if (!operation || !restaurant.locations.some(location => location.id === locationId)) fail('INVALID_LOCATION', 'Välj en restaurang.');
  if (Object.hasOwn(patch, 'paused')) {
    if (typeof patch.paused !== 'boolean') fail('INVALID_OPERATION', 'Pausläget är ogiltigt.');
    operation.paused = patch.paused;
  }
  if (Object.hasOwn(patch, 'prepMinutes')) {
    if (!Number.isInteger(patch.prepMinutes) || patch.prepMinutes < 5 || patch.prepMinutes > 120) fail('INVALID_OPERATION', 'Tillagningstiden ska vara 5–120 minuter.');
    operation.prepMinutes = patch.prepMinutes;
  }
  if (Object.hasOwn(patch, 'slotCapacity')) {
    if (!Number.isInteger(patch.slotCapacity) || patch.slotCapacity < 1 || patch.slotCapacity > 30) fail('INVALID_OPERATION', 'Välj 1–30 beställningar per tidslucka.');
    operation.slotCapacity = patch.slotCapacity;
  }
  if (patch.product) {
    const item = baseCatalog.find(item => item.id === patch.product.id);
    if (!item) fail('INVALID_ITEM', 'Rätten finns inte.');
    const current = operation.products[item.id] || {};
    if (Object.hasOwn(patch.product, 'price')) {
      if (!Number.isSafeInteger(patch.product.price) || patch.product.price < 0 || patch.product.price > 1000000) fail('INVALID_PRICE', 'Ange ett giltigt pris i öre.');
      current.price = patch.product.price;
    }
    if (Object.hasOwn(patch.product, 'available')) {
      if (typeof patch.product.available !== 'boolean') fail('INVALID_OPERATION', 'Välj säljbar eller slutsåld.');
      current.available = patch.product.available;
    }
    operation.products[item.id] = current;
  }
  state.operations[locationId] = operation;
  touch(state, now);
  return operation;
}
export function snapshotDetails(line) {
  return [line.isMeal ? `Meny · pommes + ${line.drink}` : '', ...line.extraIds.map(id => extras.find(extra => extra.id === id)?.name), ...line.removed.map(name => `Utan ${name.toLowerCase()}`)].filter(Boolean).join(' · ');
}
export function samplePayload(state, locationId, now = new Date()) {
  const catalog = catalogFor(state, locationId);
  const first = catalog.find(item => item.category === 'burgers' && item.available) || catalog.find(item => item.available);
  const slot = availableSlots(state, locationId, now)[0];
  if (!first || !slot) fail('NO_SAMPLE', 'Öppna onlinebeställningen och minst en rätt samt en ledig tid för att prova.');
  return {
    restaurantId: restaurant.id, locationId, fulfillment: restaurant.locations.find(location => location.id === locationId).fulfillmentMethods[0], requestedAt: slot.value, example: true,
    items: [{ itemId: first.id, quantity: 1, extraIds: first.extras.includes('cheese') ? ['cheese'] : [], removed: first.removable.includes('Pickles') ? ['Pickles'] : [], isMeal: !!first.meal, drink: meal.drinks[0] }],
  };
}
