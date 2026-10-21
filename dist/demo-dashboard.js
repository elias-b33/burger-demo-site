import { restaurant } from './restaurant.config.js';
import { money } from './order-core.js';
import { activeStatuses, statusNames, catalogFor, operationFor, snapshotDetails, transitions } from './demo-engine.js';
import { readDemoState, demoRuntime, changeDemoOrder, changeOperation, addSampleOrder, resetDemo, watchDemo, trackLink } from './demo-store.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
let state, runtime, view = 'orders', selectedLocation = restaurant.locations[0].id, selectedOrder = null, history = false, busy = false, lastRevision = '', toastTimer;
const location = () => restaurant.locations.find(item => item.id === selectedLocation);
function requested(value) {
  const [date, time] = value.split('T');
  return `${new Intl.DateTimeFormat('sv-SE', { day:'numeric',month:'short',timeZone:'UTC' }).format(new Date(`${date}T12:00:00Z`))} · ${time.replace(':','.')}`;
}
function shortTime(value) { return new Intl.DateTimeFormat('sv-SE', { hour:'2-digit',minute:'2-digit',timeZone:restaurant.timeZone }).format(new Date(value)); }
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible'); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3500); }
function showError(error) { $('#demo-alert').hidden = false; $('#demo-alert').textContent = error.message || 'Ändringen kunde inte genomföras. Försök igen.'; }
async function action(callback, message) {
  if (busy) return;
  busy = true; $('#demo-alert').hidden = true;
  document.querySelectorAll('[data-transition],#sample-order').forEach(button => button.disabled = true);
  try { await callback(); lastRevision = ''; await refresh(); if (message) toast(message); }
  catch (error) { showError(error); }
  finally { busy = false; document.querySelectorAll('[data-transition],#sample-order').forEach(button => button.disabled = false); }
}
function progressLabel(order) {
  if (order.status === 'ready') return order.fulfillment === 'dine_in' ? 'Klar för servering' : 'Klar att hämtas';
  if (order.status === 'completed') return order.fulfillment === 'dine_in' ? 'Serverad' : 'Utlämnad';
  return statusNames[order.status];
}
function nextAction(order) {
  return {
    received: ['accepted', 'Acceptera & skicka till köket'],
    accepted: ['preparing', 'Börja tillaga'], preparing: ['ready', 'Markera klar'],
    ready: ['completed', order.fulfillment === 'dine_in' ? 'Markera serverad' : 'Markera utlämnad'],
  }[order.status];
}
function renderStats(orders) {
  const stats = [
    [orders.filter(order => order.status === 'received').length, 'NYA WEBBORDRAR'],
    [orders.filter(order => ['accepted','preparing'].includes(order.status)).length, 'I KÖKET'],
    [orders.filter(order => order.status === 'ready').length, 'KLARA ATT LÄMNA UT'],
    [money(orders.filter(order => !['cancelled','rejected'].includes(order.status)).reduce((sum, order) => sum + order.total, 0)), 'ORDERVÄRDE I DEMON'],
  ];
  $('#demo-stats').innerHTML = stats.map(([value,label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('');
}
function orderCard(order) {
  const next = nextAction(order);
  return `<article class="demo-order-card status-${order.status}"><div class="demo-order-card-top"><span class="demo-order-code">${esc(order.id)}</span><span class="demo-order-time">${shortTime(order.createdAt)}</span></div><div class="demo-order-meta"><span>${order.fulfillment === 'dine_in' ? 'ÄTA HÄR' : 'TAKEAWAY'}</span>${order.example ? '<span class="demo-example">PROVORDER</span>' : '<span>FRÅN WEBBSIDAN</span>'}</div><p class="demo-order-slot">${requested(order.requestedAt)}</p><ul>${order.items.map(line => `<li><b>${line.quantity}×</b><div><strong>${esc(line.name)}</strong>${snapshotDetails(line) ? `<small>${esc(snapshotDetails(line))}</small>` : ''}</div></li>`).join('')}</ul><div class="demo-order-price"><strong>${money(order.total)}</strong><span>${order.paymentStatus === 'paid_in_pos' ? 'Betald i testkassan' : ['cancelled','rejected'].includes(order.status) ? 'Ingen betalning' : 'Betalas i kassan'}</span></div>${order.pos?.tabNumber ? `<p class="demo-pos-reference">Kassans nota ${order.pos.tabNumber} · ${order.pos.ticketIds.length} köks-/barbongar</p>` : ''}${order.reason ? `<p class="demo-order-reason">${esc(order.reason)}</p>` : ''}<div class="demo-card-actions">${next ? `<button class="demo-primary-action" data-transition="${next[0]}" data-order="${order.id}">${next[1]} <span><span class="ui-arrow ui-arrow-right" aria-hidden="true"></span></span></button>` : `<span class="demo-terminal-status">${progressLabel(order)}</span>`}<button class="demo-detail-button" data-detail="${order.id}">Detaljer & status <span class="ui-arrow" aria-hidden="true"></span></button></div></article>`;
}
function renderOrders(orders) {
  const active = orders.filter(order => activeStatuses.includes(order.status));
  const completed = orders.filter(order => !activeStatuses.includes(order.status));
  const operation = operationFor(state, selectedLocation);
  $('#demo-view').innerHTML = `<div class="demo-board-toolbar"><div><span class="demo-online-dot${operation.paused ? ' paused' : ''}"></span><strong>${operation.paused ? 'Onlinebeställning pausad' : 'Tar emot onlinebeställningar'}</strong><span>Från ${operation.prepMinutes} min · Max ${operation.slotCapacity} order / ${restaurant.ordering.slotMinutes} min</span></div><button class="demo-text-button" data-history>${history ? 'Visa aktiva ordrar' : `Historik (${completed.length})`}</button></div>${history ? `<div class="demo-history">${completed.length ? completed.slice().reverse().map(orderCard).join('') : '<div class="demo-empty"><h2>INGET AVSLUTAT ÄN.</h2><p>Slutför eller avböj en provorder för att se den här.</p></div>'}</div>` : !active.length ? `<div class="demo-empty"><span class="demo-empty-icon"><span class="ui-arrow" aria-hidden="true"></span></span><span class="eyebrow">REDO FÖR FÖRSTA BESTÄLLNINGEN</span><h2>FRÅN WEBBEN.<br>RAKT IN I FLÖDET.</h2><p>Beställ något på gästsidan eller skapa en provorder.<br>Acceptera den, följ den genom köket och se statusen uppdateras hos gästen.</p><button class="button button-green" data-sample>SKAPA EN PROVORDER +</button><a href="/" target="_blank" rel="noopener">Jag vill beställa som gäst <span class="ui-arrow" aria-hidden="true"></span></a></div>` : `<div class="demo-board">${[
    ['received','Nya beställningar',order => order.status === 'received'],
    ['preparing','Pågår i köket',order => ['accepted','preparing'].includes(order.status)],
    ['ready','Klart att lämna ut',order => order.status === 'ready'],
  ].map(([key,label,filter]) => { const group = active.filter(filter); return `<section class="demo-board-column"><div class="demo-column-heading"><i class="demo-stage-dot ${key}"></i><h2>${label}</h2><span>${group.length}</span></div><div class="demo-column-orders">${group.length ? group.map(orderCard).join('') : '<p class="demo-column-empty">Inga beställningar här just nu.</p>'}</div></section>`; }).join('')}</div>`}`;
}
function renderOperations() {
  const operation = operationFor(state, selectedLocation);
  const catalog = catalogFor(state, selectedLocation);
  $('#demo-view').innerHTML = `<div class="demo-operations-intro"><div><span class="eyebrow">GÄSTEN SER SAMMA LÄGE</span><h2>MENYN SKA HÅLLA TAKTEN.</h2><p>Ändra pris eller markera en rätt som slutsåld. Kontrollera sedan gästsidan i en annan flik.</p></div><a href="/" target="_blank" rel="noopener" class="button button-outline">ÖPPNA GÄSTSIDAN <span class="ui-arrow" aria-hidden="true"></span></a></div><form id="operations-form" class="demo-operations-form"><label class="demo-pause-label"><span><strong>Ta emot nya onlinebeställningar</strong><small>Redan mottagna ordrar ligger kvar även när du pausar.</small></span><input name="online" type="checkbox" role="switch" ${operation.paused ? '' : 'checked'}></label><label>Tillagningstid<select name="prepMinutes">${[5,10,15,20,25,30,40,45,60,90,120].map(value => `<option ${operation.prepMinutes === value ? 'selected' : ''} value="${value}">${value} minuter</option>`).join('')}</select></label><label>Order per ${restaurant.ordering.slotMinutes} min<select name="slotCapacity">${[1,2,3,4,5,6,8,10,15,20,30].map(value => `<option ${operation.slotCapacity === value ? 'selected' : ''} value="${value}">${value} ${value === 1 ? 'beställning' : 'beställningar'}</option>`).join('')}</select></label><button class="button button-green" type="submit">SPARA DRIFTLÄGE <span class="ui-arrow" aria-hidden="true"></span></button></form><div class="demo-menu-table"><div class="demo-menu-table-head"><span>RÄTT</span><span>PRIS</span><span>TILLGÄNGLIGHET</span></div>${catalog.map(item => `<form class="demo-product-row" data-menu-form="${item.id}"><div class="demo-product-name"><img src="/${esc(item.image)}" alt="" width="54" height="54"><div><strong>${esc(item.name)}</strong><small>${esc(item.category === 'burgers' ? 'Burgare' : item.category === 'sides' ? 'Sides & dips' : 'Shakes & dryck')}</small></div></div><label class="demo-price-field"><span class="sr-only">Pris för ${esc(item.name)}, kronor</span><input type="number" min="0" max="10000" step="0.01" name="price" value="${item.price / 100}" required><span>kr</span></label><label><span class="sr-only">Tillgänglighet för ${esc(item.name)}</span><select name="available"><option value="true" ${item.available ? 'selected' : ''}>Säljbar</option><option value="false" ${item.available ? '' : 'selected'}>Slutsåld</option></select></label><button class="demo-save-product" type="submit" aria-label="Spara ${esc(item.name)}">Spara <span class="ui-arrow" aria-hidden="true"></span></button></form>`).join('')}</div>`;
}
function renderGuide() {
  $('#demo-view').innerHTML = `<div class="demo-guide"><div class="demo-guide-heading"><span class="eyebrow">EN BRA DEMO VISAR VÄRDET I VARDAGEN</span><h2>VISA HELA VARVET.<br>PÅ ETT PAR MINUTER.</h2><p>Webbsidan väcker aptiten. Orderflödet visar varför den hör ihop med kassan.</p></div><div class="demo-guide-steps"><article><span>01</span><h3>BESTÄLL SOM GÄST</h3><p>Välj takeaway eller Äta här. Anpassa en burgare, lägg till meny och välj tid. Använd knappen för demouppgifter i kassan.</p><a href="/" target="_blank" rel="noopener">Öppna gästsidan <span class="ui-arrow" aria-hidden="true"></span></a></article><article><span>02</span><h3>TA EMOT I RESTAURANGEN</h3><p>Acceptera ordern här. Tillval, bortval, restaurang, tid och serveringssätt följer med. Markera tillagas och sedan klar.</p><button class="demo-text-button" data-view="orders">Till orderöversikten <span class="ui-arrow ui-arrow-right" aria-hidden="true"></span></button></article><article><span>03</span><h3>LÅT GÄSTEN FÖLJA MED</h3><p>Öppna orderstatusen i gästens flik. Statusen ändras när personalen arbetar med samma order. Ingen SMS-tjänst behövs för att visa flödet.</p><button class="demo-text-button" data-track-latest>Följ senaste ordern <span class="ui-arrow" aria-hidden="true"></span></button></article></div><div class="demo-guide-scenarios"><h3>PROVA NÄR ALLT INTE GÅR ENLIGT PLAN.</h3><p><strong>Slutsålt:</strong> markera en burgare som slutsåld och kontrollera menyn.<br><strong>Mycket att göra:</strong> öka tillagningstiden eller pausa nya ordrar.<br><strong>Full tidslucka:</strong> sätt kapaciteten till en order och beställ två gånger på samma tid.<br><strong>Avböjd order:</strong> välj en orsak. Gästen får ett tydligt besked i orderstatusen.</p><button class="button button-outline" data-view="operations">PROVA MENY & DRIFT <span class="ui-arrow" aria-hidden="true"></span></button></div><div class="demo-integration-card"><span class="eyebrow">KOPPLINGEN TILL ERT KASSASYSTEM</span><h3>${runtime.mode === 'pos' ? 'ER BEFINTLIGA TESTKASSA ÄR ANSLUTEN.' : 'SAMMA DEMO. TVÅ SÄTT ATT VISA DEN.'}</h3><p>${runtime.mode === 'pos' ? 'Accepterade webbordrar skapar riktiga testnotor och köks-/barbongar i er befintliga kassakod. Ändringar i kökets status läses tillbaka till webbplatsen. Allt körs i en separat demodatabas.' : 'Här på Vercel fungerar order, driftläge och status mellan flikar i samma webbläsare. Den lokala kombinationsdemon startar dessutom er befintliga kassakod med en egen demodatabas. Den här publika vyn ger ingen åtkomst till er ordinarie kassa.'}</p>${runtime.posUrl ? `<a class="button button-green" href="${esc(runtime.posUrl)}" target="_blank" rel="noopener">ÖPPNA ER TESTKASSA <span class="ui-arrow" aria-hidden="true"></span></a><p class="demo-login-hint">Demoinloggning: Ansvarig · PIN 1234 · enhetskod ${esc(runtime.deviceCode)}</p>` : ''}</div></div>`;
}
function renderDetail() {
  const order = state.orders.find(order => order.id === selectedOrder);
  if (!order) return;
  const reason = $('#order-detail [name=reason]')?.value || 'Slutsålt';
  const next = nextAction(order);
  $('#order-detail-content').innerHTML = `<span class="eyebrow">${esc(location().name)} · ${progressLabel(order)}</span><h2 id="detail-title">${esc(order.id)}</h2><p class="demo-detail-subtitle">${order.fulfillment === 'dine_in' ? 'Äta här' : 'Takeaway'} · ${requested(order.requestedAt)}</p><ul class="demo-detail-items">${order.items.map(line => `<li><span>${line.quantity}×</span><div><strong>${esc(line.name)}</strong><p>${esc(snapshotDetails(line))}</p></div><b>${money(line.quantity * line.unitPrice)}</b></li>`).join('')}</ul><div class="demo-detail-total"><span>Totalt</span><strong>${money(order.total)}</strong></div><p class="demo-detail-payment">${order.paymentStatus === 'paid_in_pos' ? 'Betald i testkassan. Ingen riktig betalning.' : ['cancelled','rejected'].includes(order.status) ? 'Avslutad utan betalning i demon.' : 'Betalas i restaurangen. Att lämna ut maten markerar inte ordern som betald.'}</p>${order.pos ? `<p class="demo-pos-reference">Kassans nota ${order.pos.tabNumber} · ${order.pos.ticketIds.length} köks-/barbongar</p>` : ''}<h3>HÄNDELSEFÖRLOPP</h3><ol class="demo-events">${order.events.map(event => `<li><time>${shortTime(event.at)}</time><span>${esc(event.label)}</span></li>`).join('')}</ol><a class="demo-track-link" href="${trackLink(order)}" target="_blank" rel="noopener">Öppna gästens orderstatus <span class="ui-arrow" aria-hidden="true"></span></a>${next ? `<button class="button button-green demo-detail-primary" data-transition="${next[0]}" data-order="${order.id}">${next[1]} <span class="ui-arrow ui-arrow-right" aria-hidden="true"></span></button>` : ''}${transitions[order.status]?.some(status => ['rejected','cancelled'].includes(status)) ? `<form id="cancel-order-form"><label>Om beställningen inte kan fullföljas<select name="reason">${['Slutsålt','Kapaciteten är full','Kunden avbeställer','Restaurangen behöver stänga'].map(value => `<option ${value === reason ? 'selected' : ''}>${value}</option>`).join('')}</select></label><button type="submit" class="demo-danger-button">${order.status === 'received' ? 'Avböj beställning' : 'Avbryt beställning'}</button></form>` : ''}`;
}
function render() {
  const orders = state.orders.filter(order => order.locationId === selectedLocation);
  renderStats(orders);
  document.querySelectorAll('.demo-tabs button').forEach(button => button.setAttribute('aria-current', button.dataset.view === view ? 'page' : 'false'));
  if (view === 'orders') renderOrders(orders);
  else if (view === 'operations') renderOperations();
  else renderGuide();
  if ($('#order-detail').open) renderDetail();
}
async function refresh() {
  try {
    const next = await readDemoState();
    const revision = JSON.stringify([next.revision, next.operations, next.orders.map(order => [order.id,order.status,order.updatedAt,order.paymentStatus])]);
    state = next;
    if (revision !== lastRevision) { lastRevision = revision; render(); }
  } catch (error) { showError(error); }
}
document.addEventListener('click', event => {
  const target = event.target.closest('button,a');
  if (!target) return;
  if (target.dataset.view) { view = target.dataset.view; render(); }
  if (target.dataset.history !== undefined) { history = !history; render(); }
  if (target.id === 'sample-order' || target.dataset.sample !== undefined) action(() => addSampleOrder(selectedLocation), 'Provordern har kommit in.');
  if (target.dataset.transition) action(() => changeDemoOrder(target.dataset.order, target.dataset.transition), 'Orderstatus uppdaterad hos gästen.');
  if (target.dataset.detail) { selectedOrder = target.dataset.detail; renderDetail(); $('#order-detail').showModal(); }
  if (target.dataset.closeDetail !== undefined) $('#order-detail').close();
  if (target.dataset.trackLatest !== undefined) {
    const order = state.orders.filter(order => order.locationId === selectedLocation).at(-1);
    if (order) window.open(trackLink(order), '_blank', 'noopener'); else toast('Skapa eller lägg en beställning först.');
  }
  if (target.id === 'reset-demo') $('#reset-confirm').showModal();
  if (target.id === 'cancel-reset') $('#reset-confirm').close();
  if (target.id === 'confirm-reset') { $('#reset-confirm').close(); action(resetDemo, 'Demon är återställd. Börja med en ny provorder.'); }
});
$('#restaurant-select').addEventListener('change', event => { selectedLocation = event.target.value; history = false; selectedOrder = null; render(); });
document.addEventListener('submit', event => {
  const form = event.target;
  if (form.id === 'operations-form') { event.preventDefault(); const data = new FormData(form); action(() => changeOperation(selectedLocation, { paused: !data.has('online'), prepMinutes:Number(data.get('prepMinutes')), slotCapacity:Number(data.get('slotCapacity')) }), 'Driftläget är uppdaterat på webbsidan.'); }
  if (form.dataset.menuForm) { event.preventDefault(); const data = new FormData(form); action(() => changeOperation(selectedLocation, { product: { id: form.dataset.menuForm, price: Math.round(Number(data.get('price')) * 100), available: data.get('available') === 'true' } }), 'Rätten är uppdaterad på gästsidan.'); }
  if (form.id === 'cancel-order-form') { event.preventDefault(); const order = state.orders.find(order => order.id === selectedOrder); action(() => changeDemoOrder(order.id, order.status === 'received' ? 'rejected' : 'cancelled', new FormData(form).get('reason')), 'Gästens orderstatus visar orsaken.'); }
});
$('#restaurant-select').innerHTML = restaurant.locations.map(item => `<option value="${item.id}">${esc(item.name)}</option>`).join('');
$('.demo-brand>span').textContent = restaurant.brand.wordmark;
document.title = `${restaurant.brand.name} · Webborder & kök`;
for (const [key,value] of Object.entries(restaurant.brand.colors)) document.documentElement.style.setProperty(`--${key}`,value);
try {
  runtime = await demoRuntime();
  $('#demo-connection').innerHTML = `<span class="demo-online-dot"></span><strong>${esc(runtime.label)}</strong><p>${esc(runtime.description)}</p>${runtime.posUrl ? `<a href="${esc(runtime.posUrl)}" target="_blank" rel="noopener">Öppna er testkassa <span class="ui-arrow" aria-hidden="true"></span></a>` : ''}`;
  $('#reset-demo').hidden = runtime.mode === 'pos';
  await refresh(); watchDemo(refresh);
} catch (error) { showError(error); }
