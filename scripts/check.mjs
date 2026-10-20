import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { restaurant, menu, extras } from '../dist/restaurant.config.js';
import { normalizeLine, unitPrice, summarizeCart, lineKey, pickupSlots, validateCheckout, locationStatus, money } from '../dist/order-core.js';
import { foodoraLink, submitOrder } from '../dist/order-adapter.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.ok(['demo', 'api'].includes(restaurant.ordering.mode), 'Order mode must be demo or api');
assert.equal(restaurant.demo, restaurant.ordering.mode === 'demo', 'Change restaurant.demo and ordering.mode together to keep customer messages accurate');
const testCatalog = [
  { id: 'original', price: 11900, meal: true, extras: ['cheese', 'dip'], removable: ['Pickles'] },
  { id: 'green', price: 12900, meal: true, extras: ['dip'], removable: [] },
  { id: 'shake', price: 5900, meal: false, extras: [], removable: [] },
];
const testExtras = [{ id: 'cheese', price: 1200 }, { id: 'dip', price: 1500 }];
const testMeal = { price: 4500, drinks: ['Coca-Cola', 'Fanta'] };
const normalizeFixture = raw => normalizeLine(raw, testCatalog, testMeal);
const fixturePrice = line => unitPrice(line, testCatalog, testExtras, testMeal);
const normalized = normalizeFixture({ itemId: 'original', quantity: 2, isMeal: true, drink: 'Fanta', extraIds: ['cheese', 'cheese', 'imaginary'], removed: ['Pickles', '<script>'], price: 1 });
assert.equal(fixturePrice(normalized), 17600, '119 + 45 + 12 = 176 kr per burger');
assert.deepEqual(summarizeCart([normalized], fixturePrice), { quantity: 2, total: 35200 });
assert.deepEqual(normalized.extraIds, ['cheese']);
assert.deepEqual(normalized.removed, ['Pickles']);
assert.equal(normalized.drink, 'Fanta');
assert.equal(normalizeFixture({ itemId: 'missing', quantity: 1 }), null);
assert.equal(normalizeFixture({ itemId: 'original', quantity: -1 }), null);
assert.equal(normalizeFixture({ itemId: 'original', quantity: 1.5 }), null);
assert.equal(normalizeFixture({ itemId: 'original', quantity: 999 }).quantity, restaurant.ordering.maxQuantityPerLine);
const vegetarian = normalizeFixture({ itemId: 'green', quantity: 1, extraIds: ['bacon', 'dip'], isMeal: true, drink: 'not-a-drink' });
assert.deepEqual(vegetarian.extraIds, ['dip']);
assert.equal(vegetarian.drink, 'Coca-Cola');
assert.equal(normalizeFixture({ itemId: 'shake', quantity: 1, isMeal: true }).isMeal, false);
assert.equal(lineKey(normalized), lineKey({ ...normalized, quantity: 15 }));
assert.match(money(12950), /129,5/);
const soder = { pickupMinutes: 20, exceptions: {}, hours: { 0: ['12:00','21:00'], 1: ['11:00','21:00'], 2: ['11:00','21:00'], 3: ['11:00','21:00'], 4: ['11:00','21:00'], 5: ['11:00','22:00'], 6: ['12:00','22:00'] } };
const slots = pickupSlots(soder, new Date('2026-10-20T17:00:00Z'));
assert.equal(slots[0].value, '2026-10-20T19:30');
assert.ok(!slots.some(slot => slot.date === '2026-10-20' && slot.time > '20:45'));
assert.equal(pickupSlots(soder, new Date('2026-10-20T21:00:00Z'))[0].value, '2026-10-21T11:00');
assert.equal(pickupSlots(soder, new Date('2026-10-20T05:00:00Z'))[0].value, '2026-10-20T11:00');
assert.equal(pickupSlots({ ...soder, exceptions: { '2026-10-20': null } }, new Date('2026-10-20T05:00:00Z'))[0].date, '2026-10-21');
assert.equal(pickupSlots(soder, new Date('2026-10-25T00:00:00Z'))[0].value, '2026-10-25T12:00', 'Autumn DST transition');
assert.equal(locationStatus(soder, new Date('2026-10-20T17:00:00Z')).open, true);
assert.equal(locationStatus(soder, new Date('2026-10-20T21:00:00Z')).open, false);
const valid = { name: 'Demo Gäst', phone: '0700000000', email: '', pickupAt: slots[0].value, accepted: true };
assert.equal(validateCheckout(valid, slots), null);
assert.ok(validateCheckout({ ...valid, name: '' }, slots));
assert.ok(validateCheckout({ ...valid, phone: '123' }, slots));
assert.ok(validateCheckout({ ...valid, email: 'invalid' }, slots));
assert.ok(validateCheckout({ ...valid, pickupAt: '2020-01-01T12:00' }, slots));
assert.ok(validateCheckout({ ...valid, accepted: false }, slots));
assert.equal(foodoraLink({ foodoraUrl: 'https://www.foodora.se/restaurant/example' }), 'https://www.foodora.se/restaurant/example');
assert.equal(foodoraLink({ foodoraUrl: 'https://foodora.se.attacker.example/' }), null);
assert.equal(foodoraLink({ foodoraUrl: 'javascript:alert(1)' }), null);
assert.equal(foodoraLink({ foodoraUrl: null }), null);
if (restaurant.ordering.mode === 'demo') {
  const result = await submitOrder({ requestedAt: slots[0].value, fulfillment: 'dine_in' }, 'demo-test');
  assert.equal(result.status, 'demo');
  assert.equal(result.fulfillment, 'dine_in');
  assert.equal(result.requestedAt, slots[0].value);
}
assert.equal(new Set(menu.map(item => item.id)).size, menu.length);
assert.ok(restaurant.locations.length >= 1);
for (const item of menu) {
  assert.ok(Number.isSafeInteger(item.price) && item.price >= 0, `Price: ${item.id}`);
  assert.ok(item.extras.every(id => extras.some(extra => extra.id === id)), `Extras: ${item.id}`);
  await access(path.join(root, 'dist', item.image));
}
for (const location of restaurant.locations) {
  assert.ok(location.fulfillmentMethods.every(method => ['pickup', 'dine_in'].includes(method)));
  await access(path.join(root, 'dist', location.image));
}
const html = await readFile(path.join(root, 'dist/index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="((?:assets\/|styles\.css|app\.js)[^"]+)"/g)) await access(path.join(root, 'dist', match[1]));
const fonts = await readFile(path.join(root, 'dist/assets/fonts.css'), 'utf8');
assert.ok(!fonts.includes('https://'), 'Fonts must be self-hosted');
for (const match of fonts.matchAll(/url\(\.\/([^)]+)\)/g)) await access(path.join(root, 'dist/assets', match[1]));
console.log('Checks passed: totals, modifiers, quantities, opening hours, DST, checkout validation, Foodora URLs, demo order and all referenced assets.');
