import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, createDemoOrder, transitionOrder, updateOperation, availableSlots, catalogFor, samplePayload, normalizeState } from '../dist/demo-engine.js';
import { toPosMenu, toPosAdd } from '../integrations/eleva-pos/mapping.mjs';
import { restaurant } from '../dist/restaurant.config.js';
const now = new Date('2026-10-20T17:00:00Z');
const sample = state => samplePayload(state,'sodermalm',now);
const key = () => crypto.randomUUID();

test('a burger combo keeps its modifiers, 176 kr total and no contact information',() => {
  const state = initialState(); const payload = sample(state);
  Object.assign(payload,{ customer:{ name:'PRIVATE_NAME',phone:'PRIVATE_PHONE' },notes:'PRIVATE_NOTE',expectedTotal:17600 });
  const order = createDemoOrder(state,payload,key(),now);
  assert.equal(order.total,17600);
  assert.deepEqual(order.items[0].extraIds,['cheese']);
  assert.deepEqual(order.items[0].removed,['Pickles']);
  assert.equal(order.items[0].drink,'Coca-Cola');
  assert.doesNotMatch(JSON.stringify(state),/PRIVATE_NAME|PRIVATE_PHONE|PRIVATE_NOTE/);
});
test('lost-response retry returns the same immutable order even after menu and pause changes',() => {
  const state = initialState(); const payload = sample(state); const attempt = key();
  const first = createDemoOrder(state,payload,attempt,now);
  updateOperation(state,'sodermalm',{ paused:true,product:{ id:'original',price:14900 } },now);
  const retry = createDemoOrder(state,payload,attempt,now);
  assert.equal(retry.id,first.id); assert.equal(retry.total,17600); assert.equal(state.orders.length,1);
  assert.throws(() => createDemoOrder(state,{ ...payload,items:[{ ...payload.items[0],quantity:2 }] },attempt,now),{ code:'KEY_CONFLICT' });
});
test('capacity is shared across takeaway and dine-in; rejected orders release a slot',() => {
  const state = initialState(); updateOperation(state,'sodermalm',{ slotCapacity:1 },now);
  const payload = sample(state); const order = createDemoOrder(state,payload,key(),now);
  assert.ok(!availableSlots(state,'sodermalm',now).some(slot => slot.value === payload.requestedAt));
  assert.throws(() => createDemoOrder(state,{ ...payload,fulfillment:'dine_in' },key(),now),{ code:'SLOT_FULL' });
  transitionOrder(state,order.id,'rejected','Kapaciteten är full',now);
  assert.equal(createDemoOrder(state,payload,key(),now).status,'received');
});
test('pause and sold-out flags belong to the selected restaurant',() => {
  const state = initialState(); const payload = sample(state);
  updateOperation(state,'sodermalm',{ paused:true },now);
  assert.equal(availableSlots(state,'sodermalm',now).length,0);
  assert.throws(() => createDemoOrder(state,payload,key(),now),{ code:'PAUSED' });
  assert.ok(availableSlots(state,'vasastan',now).length > 0);
  updateOperation(state,'sodermalm',{ paused:false,product:{ id:'original',available:false } },now);
  assert.throws(() => createDemoOrder(state,payload,key(),now),{ code:'SOLD_OUT' });
  assert.equal(catalogFor(state,'vasastan').find(item => item.id === 'original').available,true);
});
test('a changed price requires the guest to confirm the updated total',() => {
  const state = initialState(); const payload = { ...sample(state),expectedTotal:17600 };
  updateOperation(state,'sodermalm',{ product:{ id:'original',price:14900 } },now);
  assert.throws(() => createDemoOrder(state,payload,key(),now),{ code:'PRICE_CHANGED' });
  assert.equal(state.orders.length,0);
  assert.equal(createDemoOrder(state,{ ...payload,expectedTotal:20600 },key(),now).total,20600);
});
test('invalid products, drink options, modifiers and quantities cannot be silently changed',() => {
  const state = initialState(); const payload = sample(state); const line = payload.items[0];
  for (const patch of [{ itemId:'missing' },{ quantity:-1 },{ quantity:200 },{ quantity:1.5 },{ extraIds:['made-up'] },{ removed:['made-up'] },{ drink:'made-up' }]) {
    assert.throws(() => createDemoOrder(state,{ ...payload,items:[{ ...line,...patch }] },key(),now),{ code:'INVALID_ITEM' });
  }
  assert.equal(state.orders.length,0);
});
test('restaurant, fulfillment and time must be available; closed times are rejected',() => {
  const state = initialState(); const payload = sample(state);
  assert.throws(() => createDemoOrder(state,{ ...payload,locationId:'other' },key(),now),{ code:'INVALID_LOCATION' });
  assert.throws(() => createDemoOrder(state,{ ...payload,fulfillment:'delivery' },key(),now),{ code:'INVALID_METHOD' });
  assert.throws(() => createDemoOrder(state,{ ...payload,requestedAt:'2026-10-20T23:00' },key(),now),{ code:'SLOT_FULL' });
});
test('order transitions must progress in order; negative outcomes need a known reason',() => {
  const state = initialState(); const order = createDemoOrder(state,sample(state),key(),now);
  assert.throws(() => transitionOrder(state,order.id,'ready','',now),{ code:'INVALID_TRANSITION' });
  assert.throws(() => transitionOrder(state,order.id,'rejected','',now),{ code:'REASON_REQUIRED' });
  transitionOrder(state,order.id,'accepted','',now);
  transitionOrder(state,order.id,'preparing','',now);
  transitionOrder(state,order.id,'ready','',now);
  transitionOrder(state,order.id,'completed','',now);
  assert.equal(order.paymentStatus,'pay_at_restaurant');
  assert.throws(() => transitionOrder(state,order.id,'cancelled','Kunden avbeställer',now),{ code:'INVALID_TRANSITION' });
  assert.equal(order.events.length,5);
});
test('dine-in keeps its service mode throughout the same order lifecycle',() => {
  const state = initialState(); const order = createDemoOrder(state,{ ...sample(state),fulfillment:'dine_in' },key(),now);
  transitionOrder(state,order.id,'accepted','',now);
  assert.equal(order.fulfillment,'dine_in'); assert.equal(order.status,'accepted');
});
test('prep time and capacity validate business limits and preserve unrelated products',() => {
  const state = initialState();
  for (const patch of [{ prepMinutes:0 },{ prepMinutes:121 },{ slotCapacity:0 },{ slotCapacity:31 },{ paused:'yes' },{ product:{ id:'original',price:-1 } }]) assert.throws(() => updateOperation(state,'sodermalm',patch,now));
  updateOperation(state,'sodermalm',{ prepMinutes:60 },now);
  assert.equal(availableSlots(state,'sodermalm',now)[0].value,'2026-10-20T20:00');
});
test('browser orders expire after 24 hours without removing operation settings',() => {
  const state = initialState(); createDemoOrder(state,sample(state),key(),now);
  updateOperation(state,'sodermalm',{ slotCapacity:3 },now);
  const next = normalizeState(state,new Date(now.getTime() + 86400001));
  assert.equal(next.orders.length,0); assert.equal(next.operations.sodermalm.slotCapacity,3);
});
test('POS contract maps pickup, combo, extras and removals to the actual register model',() => {
  const state = initialState(); const order = createDemoOrder(state,sample(state),key(),now);
  const item = catalogFor(state,'sodermalm').find(item => item.id === 'original');
  const article = toPosMenu(item,restaurant.locations[0]); const command = toPosAdd(order,order.items[0],0,1);
  assert.equal(article.id,command.itemId);
  assert.equal(article.itemKind,'services'); assert.equal(article.takeawayItemKind,'goods');
  assert.deepEqual(command.modifiers,['meal-0','extra-cheese','omit-0']);
  assert.equal(command.hold,false); assert.ok(command.notes.includes('TAKEAWAY'));
});
