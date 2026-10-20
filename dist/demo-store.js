import { restaurant } from './restaurant.config.js';
import { initialState, normalizeState, createDemoOrder, transitionOrder, updateOperation, samplePayload } from './demo-engine.js';

const dbName = `${restaurant.id}:restaurant-demo:v1`;
let databasePromise, runtimePromise;
const listeners = new Set();
let channel, polling;
const isBrowser = typeof window !== 'undefined';
const hasPos = () => isBrowser && document.querySelector('meta[name="demo-transport"]')?.content === 'pos';
function announce() {
  for (const callback of listeners) callback();
}
function notify() { announce(); channel?.postMessage('changed'); }
function database() {
  if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('Webbläsaren tillåter inte demodata. Använd en vanlig webbläsarflik och försök igen.')); return; }
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Demolagringen kunde inte öppnas. Kontrollera webbläsarens lagringsinställningar.'));
  });
  return databasePromise;
}
async function localTransaction(mutator) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('state', 'readwrite');
    const store = transaction.objectStore('state');
    const request = store.get('current');
    let result, issue;
    request.onsuccess = () => {
      try {
        const state = normalizeState(request.result);
        result = mutator ? mutator(state) : state;
        if (mutator || request.result?.orders?.length !== state.orders.length) store.put(state, 'current');
      } catch (error) { issue = error; transaction.abort(); }
    };
    transaction.oncomplete = () => { if (mutator) notify(); resolve(result); };
    transaction.onabort = () => reject(issue || new Error('Ändringen kunde inte sparas. Försök igen.'));
    transaction.onerror = () => reject(issue || new Error('Ändringen kunde inte sparas. Försök igen.'));
  });
}
async function request(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`/api/demo/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Kassan kunde inte ta emot ändringen. Försök igen.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('Testkassan svarar inte. Beställningen är inte bekräftad. Kontrollera anslutningen och försök igen med samma order.');
    throw error;
  } finally { clearTimeout(timer); }
}
export async function demoRuntime() {
  if (!hasPos()) return { mode: 'browser', label: 'Webbläsardemo', description: 'Order, meny och status delas mellan flikar i den här webbläsaren. Inga riktiga beställningar eller betalningar.' };
  runtimePromise ||= request('runtime').catch(error => { runtimePromise = null; throw error; });
  return runtimePromise;
}
export async function readDemoState() {
  return hasPos() ? request('state') : localTransaction();
}
export async function sendDemoOrder(payload, key) {
  // Do not persist or transmit actual contact details in the demonstration.
  const safePayload = { restaurantId: payload.restaurantId, locationId: payload.locationId, fulfillment: payload.fulfillment, requestedAt: payload.requestedAt, expectedTotal: payload.expectedTotal, items: payload.items.map(({ itemId, quantity, extraIds, removed, isMeal, drink }) => ({ itemId, quantity, extraIds, removed, isMeal, drink })), example: false };
  const result = hasPos() ? await request('orders', { payload: safePayload, key }) : await localTransaction(state => createDemoOrder(state, safePayload, key));
  if (hasPos()) notify();
  return result;
}
export async function changeDemoOrder(id, status, reason = '') {
  const result = hasPos() ? await request('transition', { id, status, reason }) : await localTransaction(state => transitionOrder(state, id, status, reason));
  if (hasPos()) notify();
  return result;
}
export async function changeOperation(locationId, patch) {
  const result = hasPos() ? await request('operation', { locationId, patch }) : await localTransaction(state => updateOperation(state, locationId, patch));
  if (hasPos()) notify();
  return result;
}
export async function addSampleOrder(locationId) {
  if (hasPos()) { const result = await request('sample', { locationId }); notify(); return result; }
  return localTransaction(state => createDemoOrder(state, samplePayload(state, locationId), crypto.randomUUID()));
}
export async function resetDemo() {
  if (hasPos()) throw new Error('Starta en ny testomgång med kassademots startkommando. Kassans historik raderas inte från webbplatsen.');
  return localTransaction(state => {
    Object.assign(state, initialState(), { revision: state.revision + 1 });
    try { localStorage.removeItem(`${restaurant.id}:last-demo-order`); } catch { /* no tracking shortcut */ }
  });
}
export function trackLink(order) { return `/#order=${encodeURIComponent(order.id)}&token=${encodeURIComponent(order.trackingToken)}`; }
export function rememberOrder(order) {
  try { localStorage.setItem(`${restaurant.id}:last-demo-order`, JSON.stringify({ id: order.id, token: order.trackingToken })); } catch { /* Tracking works for the open order. */ }
}
export function lastOrder() {
  try { return JSON.parse(localStorage.getItem(`${restaurant.id}:last-demo-order`)); } catch { return null; }
}
export function watchDemo(callback) {
  listeners.add(callback);
  if (!channel && typeof BroadcastChannel !== 'undefined') { channel = new BroadcastChannel(dbName); channel.onmessage = announce; }
  if (!polling && isBrowser) {
    window.addEventListener('storage', announce);
    window.addEventListener('focus', announce);
    polling = setInterval(() => { if (!document.hidden) announce(); }, hasPos() ? 2000 : 5000);
  }
  return () => listeners.delete(callback);
}
