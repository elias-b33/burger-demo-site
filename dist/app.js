import { restaurant, categories, menu, extras, meal, fulfillmentMethods } from './restaurant.config.js';
import { money, itemById, normalizeLine, unitPrice, lineKey, lineDetails, summarizeCart, pickupSlots, locationStatus, validateCheckout } from './order-core.js';
import { submitOrder, foodoraLink } from './order-adapter.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const storageKey = `${restaurant.id}:cart:v${restaurant.contentVersion}`;
const locationIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
const bagIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></svg>';
let cart = [], selectedLocationId = null, homeCategory = 'burgers', orderCategory = 'burgers', orderSearch = '', orderVeg = false;
let stage = 'location', product = null, checkoutDraft = {}, activeSlots = [], busy = false, pendingKey = null, lastReceipt = null;
let fulfillment = 'pickup';
const orderAttempts = new Map();
let toastTimer;

try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (Array.isArray(stored?.cart)) {
    let remaining = restaurant.ordering.maxCartItems;
    cart = stored.cart.slice(0, 50).map(raw => normalizeLine(raw)).filter(Boolean).filter(line => {
      line.quantity = Math.min(line.quantity, remaining);
      remaining -= line.quantity;
      return line.quantity > 0;
    });
  }
  if (restaurant.locations.some(location => location.id === stored?.locationId)) selectedLocationId = stored.locationId;
  if (fulfillmentMethods.some(method => method.id === stored?.fulfillment)) fulfillment = stored.fulfillment;
} catch { /* Private browsing or stale storage must not prevent ordering. */ }

function persistCart() {
  try { localStorage.setItem(storageKey, JSON.stringify({ cart, locationId: selectedLocationId, fulfillment })); } catch { /* Cart still works in memory. */ }
}
const location = () => restaurant.locations.find(item => item.id === selectedLocationId);
const orderMethod = () => fulfillmentMethods.find(method => method.id === fulfillment) || fulfillmentMethods[0];
function fulfillmentControls(compact = false) {
  return `<div class="${compact ? 'mode-switcher' : 'fulfilment-toggle'}" role="group" aria-label="Hur vill du äta?">${fulfillmentMethods.map(method => `<button class="${fulfillment === method.id ? 'selected' : ''}" data-fulfillment="${method.id}" aria-pressed="${fulfillment === method.id}" ${compact && location() && !location().fulfillmentMethods.includes(method.id) ? 'disabled' : ''}>${esc(method.name)}${compact ? '' : ' ↗'}</button>`).join('')}${compact ? '' : '<button data-action="delivery">Hemleverans ↗</button>'}</div>`;
}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3000);
}

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('modal-open');
}
function closeDialog(id) {
  document.getElementById(id).close();
  if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
}
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
  });
  dialog.addEventListener('click', event => {
    if (busy || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog.id);
  });
}

function categoryButtons(active, scope) {
  return categories.map(category => `<button class="category-tab" id="${scope}-tab-${category.id}" role="tab" aria-selected="${active === category.id}" aria-controls="${scope === 'home' ? 'home-menu' : 'order-food-grid'}" tabindex="${active === category.id ? 0 : -1}" data-category="${category.id}" data-scope="${scope}">${esc(category.name)}</button>`).join('');
}

function renderHomeMenu() {
  $('#home-categories').innerHTML = categoryButtons(homeCategory, 'home');
  $('#home-menu').setAttribute('aria-labelledby', `home-tab-${homeCategory}`);
  const items = menu.filter(item => item.category === homeCategory && (!$('#home-veg').checked || item.vegetarian));
  $('#home-menu').innerHTML = items.map(item => `<article class="food-card"><button class="food-image-button" data-product="${item.id}" aria-label="Anpassa ${esc(item.name)}${item.vegetarian ? ', vegetarisk' : ''}">${item.badge ? `<span class="food-badge">${esc(item.badge)}</span>` : ''}<img src="${esc(item.image)}" alt="${esc(item.imageAlt)}" loading="lazy" width="600" height="650"><span class="food-plus" aria-hidden="true">+</span></button><div class="food-card-heading"><h3>${esc(item.name)}</h3><span class="food-card-price">${money(item.price)}</span></div><p class="food-card-description">${esc(item.shortDescription)}</p><button class="food-card-link" data-product="${item.id}">ANPASSA & LÄGG TILL <span aria-hidden="true">↗</span></button></article>`).join('') || '<p class="empty-results">Inga vegetariska rätter i den här kategorin ännu. Prova en annan kategori.</p>';
}

const days = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
function hoursMarkup(item) {
  return [1, 2, 3, 4, 5, 6, 0].map(day => `<tr><td>${days[day]}</td><td>${item.hours[day] ? item.hours[day].join('–') : 'Stängt'}</td></tr>`).join('');
}
function statusMarkup(item) {
  const status = locationStatus(item);
  return `<span class="location-status"><i class="status-dot${status.open ? ' open' : ''}" aria-hidden="true"></i>${esc(status.text)}</span>`;
}
function renderLocations() {
  $('#locations-grid').innerHTML = restaurant.locations.map(item => `<article class="location-card"><img class="location-image" src="${esc(item.image)}" alt="${esc(item.imageAlt)}" loading="lazy" width="900" height="500"><div class="location-card-content"><div class="location-topline"><h3>${esc(item.name)}</h3>${statusMarkup(item)}</div><p class="location-address">${esc(item.address)} · ${esc(item.postalCode)}</p><div class="location-links"><button class="button button-green" data-location="${esc(item.id)}">BESTÄLL HÄR <span aria-hidden="true">↗</span></button><a href="${esc(item.mapsUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Hitta till ${esc(item.name)} i Google Maps">HITTA HIT ↗</a><a href="tel:${esc(item.phoneHref)}" aria-label="Ring ${esc(item.name)}">${esc(item.phone)}</a></div><details class="location-hours"><summary>Se alla öppettider</summary><table class="hours-table"><caption class="sr-only">Öppettider ${esc(item.name)}</caption><tbody>${hoursMarkup(item)}</tbody></table></details></div></article>`).join('');
  if (restaurant.locations.length === 1) $('#locations-grid').style.gridTemplateColumns = 'minmax(0, 720px)';
}

function renderProgress() {
  const current = stage === 'location' ? 0 : ['menu', 'cart'].includes(stage) ? 1 : 2;
  $('#order-progress').hidden = stage === 'confirmation';
  $('#order-progress').innerHTML = ['Restaurang', 'Meny', 'Kassa'].map((name, i) => `${i ? '<span class="step-separator" aria-hidden="true"></span>' : ''}<button class="order-step${current === i ? ' active' : i < current ? ' complete' : ''}" ${current === i ? 'aria-current="step"' : ''} data-stage="${['location', 'menu', 'checkout'][i]}" ${i > current ? 'disabled' : ''}><b>${i < current ? '✓' : i + 1}</b>${name}</button>`).join('');
}

function locationChoices() {
  return restaurant.locations.map(item => `<button class="location-choice" data-location="${esc(item.id)}" aria-label="Välj ${esc(item.name)}" ${!item.fulfillmentMethods.includes(fulfillment) ? 'disabled' : ''}><img src="${esc(item.image)}" alt="${esc(item.imageAlt)}" width="400" height="180"><div><h4>${esc(item.name).toUpperCase()}</h4><p>${esc(item.address)}</p>${statusMarkup(item)}<div class="choice-footer"><span>${fulfillment === 'dine_in' ? 'Servering' : 'Upphämtning'} från ${item.pickupMinutes} min</span><span aria-hidden="true">↗</span></div></div></button>`).join('');
}

function renderLocationStep() {
  $('#order-content').innerHTML = `<section class="order-location"><h3>VILKET ÄR DITT HAK?</h3><p>Välj hur du vill äta och vilken restaurang du vill beställa från. Du väljer tid i kassan.</p>${fulfillmentControls()}<div class="location-choices">${locationChoices()}</div>${restaurant.demo ? '<p class="demo-notice">Du provar en restaurangmall. Beställningen är en demo, inga pengar dras och ingen matbeställning skickas.</p>' : ''}</section>`;
}

function cartLinesMarkup(readonly = false) {
  return cart.map((line, index) => `<div class="cart-line"><div class="cart-line-title"><span>${readonly ? `${line.quantity} × ` : ''}${esc(itemById(line.itemId).name)}</span><span>${money(unitPrice(line) * line.quantity)}</span></div>${lineDetails(line) ? `<p class="cart-line-details">${esc(lineDetails(line))}</p>` : ''}${readonly ? '' : `<div class="cart-line-actions"><div class="qty-control" aria-label="Antal ${esc(itemById(line.itemId).name)}"><button data-quantity="-1" data-index="${index}" aria-label="Minska antal ${esc(itemById(line.itemId).name)}">−</button><span>${line.quantity}</span><button data-quantity="1" data-index="${index}" aria-label="Öka antal ${esc(itemById(line.itemId).name)}" ${line.quantity >= restaurant.ordering.maxQuantityPerLine ? 'disabled' : ''}>+</button></div><button class="remove-line" data-remove="${index}" aria-label="Ta bort ${esc(itemById(line.itemId).name)}">Ta bort</button></div>`}</div>`).join('');
}
function totalsMarkup() {
  const { total } = summarizeCart(cart);
  return `<div class="cart-totals"><div><span>Mat & dryck</span><span>${money(total)}</span></div><div><span>${fulfillment === 'dine_in' ? 'Servering' : 'Upphämtning'}</span><span>0 kr</span></div><div class="cart-total"><span>Totalt</span><span>${money(total)}</span></div></div>`;
}
function emptyCartMarkup() {
  return `<div class="cart-empty">${bagIcon}<p class="handwritten">Plats för något gott.</p><p>Din varukorg är tom.<br>En burgare eller två ändrar på det.</p></div>`;
}
function cartPanelMarkup(readonly = false) {
  return `<h3>DIN BESTÄLLNING.</h3>${cart.length ? `<div class="cart-lines">${cartLinesMarkup(readonly)}</div>${totalsMarkup()}${readonly ? '' : `<button class="button button-green" data-action="checkout">TILL KASSAN <span aria-hidden="true">↗</span></button><p class="cart-footnote">${restaurant.demo ? 'Demobeställning · Inga pengar dras' : esc(orderMethod().paymentLabel)}</p>`}` : emptyCartMarkup()}`;
}

function renderOrderMenu() {
  const item = location();
  if (!item) { stage = 'location'; renderOrder(); return; }
  $('#order-content').innerHTML = `<div class="order-menu-layout"><section class="order-menu-main" aria-label="Beställningsmeny"><div class="selected-location">${locationIcon}<span><strong>${esc(restaurant.brand.name)} ${esc(item.name)}</strong>${esc(orderMethod().shortName)} · ${esc(item.address)} · Från ${item.pickupMinutes} min</span><button data-stage="location">Byt restaurang</button></div>${fulfillmentControls(true)}${fulfillment === 'dine_in' ? `<p class="order-fulfillment-note">${esc(orderMethod().note)}</p>` : ''}<div class="order-menu-toolbar"><div class="category-tabs" role="tablist" aria-label="Beställningskategorier" id="order-categories">${categoryButtons(orderCategory, 'order')}</div><div class="order-search-row"><input class="search-input" id="order-search" type="search" placeholder="Sök något gott…" aria-label="Sök i menyn" value="${esc(orderSearch)}"><label class="veg-toggle"><input type="checkbox" id="order-veg" ${orderVeg ? 'checked' : ''}><span class="leaf-icon" aria-hidden="true">✿</span>Bara veggo</label></div></div><div class="order-food-grid" id="order-food-grid" role="tabpanel" aria-labelledby="order-tab-${orderCategory}"></div></section><aside class="cart-panel" data-cart-panel aria-label="Varukorg">${cartPanelMarkup()}</aside><button class="mobile-cart-bar" data-action="cart"><span>DIN VARUKORG <b class="mobile-quantity">${summarizeCart(cart).quantity}</b></span><span class="mobile-total">${money(summarizeCart(cart).total)} ↗</span></button></div>`;
  renderOrderFoods();
}

function renderOrderFoods() {
  const container = $('#order-food-grid');
  if (!container) return;
  const search = orderSearch.toLocaleLowerCase(restaurant.locale).trim();
  const items = menu.filter(item => (!search ? item.category === orderCategory : true) && (!orderVeg || item.vegetarian) && (!search || `${item.name} ${item.description}`.toLocaleLowerCase(restaurant.locale).includes(search)));
  container.setAttribute('aria-labelledby', `order-tab-${orderCategory}`);
  container.innerHTML = items.map(item => `<article class="order-food-card"><button data-product="${item.id}" aria-label="Anpassa ${esc(item.name)}, ${money(item.price)}"><img src="${esc(item.image)}" alt="${esc(item.imageAlt)}" loading="lazy" width="500" height="300"><div class="order-food-details"><h4>${esc(item.name)}${item.vegetarian ? ' <span class="sr-only">(vegetarisk)</span>' : ''}</h4><p>${esc(item.shortDescription)}</p><div><span>${money(item.price)}</span><span class="add-icon" aria-hidden="true">+</span></div></div></button></article>`).join('') || '<div class="empty-results"><p>Inget som matchar din sökning här.<br>Prova en annan kategori eller ta bort filtret.</p><button class="button button-outline" data-action="clear-search">RENSA FILTER</button></div>';
}

function renderCart() {
  $('#order-content').innerHTML = `<section class="cart-view"><button class="back-button" data-stage="${location() ? 'menu' : 'location'}">← Fortsätt välja något gott</button><h3>DIN VARUKORG.</h3>${cart.length ? `${location() ? `<div class="cart-location-note"><span>${esc(orderMethod().shortName)} på <strong>${esc(location().name)}</strong></span><button data-stage="location">Byt</button></div>` : ''}<div class="cart-lines">${cartLinesMarkup()}</div>${totalsMarkup()}<button class="button button-green" data-action="checkout">${location() ? 'FORTSÄTT TILL KASSAN' : 'VÄLJ RESTAURANG'} <span aria-hidden="true">↗</span></button><p class="cart-footnote">${restaurant.demo ? 'Demobeställning · Inga pengar dras.' : esc(orderMethod().paymentLabel)}</p>` : `${emptyCartMarkup()}<button class="button button-green" data-stage="${location() ? 'menu' : 'location'}">HITTA DIN FAVORIT ↗</button>`}</section>`;
}

function renderCheckout() {
  if (!location() || !cart.length) { stage = location() ? 'menu' : 'location'; renderOrder(); return; }
  const item = location();
  activeSlots = pickupSlots(item);
  if (!activeSlots.some(slot => slot.value === checkoutDraft.pickupAt)) checkoutDraft.pickupAt = activeSlots[0]?.value || '';
  $('#order-content').innerHTML = `<div class="checkout-layout"><section class="checkout-main"><button class="back-button" data-stage="menu">← Tillbaka till menyn</button><h3>SNART DAGS ATT HUGGA IN.</h3><p class="checkout-intro">${fulfillment === 'dine_in' ? 'Ät hos oss. Din mat väntar vid disken när det är dags.' : 'En sista koll, så är din burgare nästan hemma.'}</p><form id="checkout-form" novalidate><fieldset class="checkout-form-fieldset" style="border:0;padding:0;margin:0;min-width:0"><div class="checkout-fields"><label class="field">Ditt namn *<input name="name" autocomplete="name" required maxlength="80" placeholder="För- och efternamn" value="${esc(checkoutDraft.name || '')}"></label><label class="field">Telefonnummer *<input name="phone" type="tel" autocomplete="tel" required maxlength="20" placeholder="070 123 45 67" value="${esc(checkoutDraft.phone || '')}"></label><label class="field full">E-post <span class="sr-only">(frivilligt)</span><input name="email" type="email" autocomplete="email" maxlength="120" placeholder="din@epost.se (frivilligt)" value="${esc(checkoutDraft.email || '')}"><small>${restaurant.demo ? 'Inget mejl skickas i demon.' : 'För ditt beställningskvitto.'}</small></label></div><div class="checkout-block"><h4>${esc(orderMethod().heading)}</h4><label class="field">${esc(orderMethod().timeLabel)} *<select name="pickupAt" required aria-label="${esc(orderMethod().timeLabel)}">${activeSlots.length ? activeSlots.map(slot => `<option value="${slot.value}" ${checkoutDraft.pickupAt === slot.value ? 'selected' : ''}>${esc(slot.label)}</option>`).join('') : '<option value="">Inga tillgängliga tider just nu</option>'}</select></label><p class="pickup-info"><strong>${esc(restaurant.brand.name)} ${esc(item.name)}</strong><br>${esc(item.address)}, ${esc(item.postalCode)}</p><p class="order-fulfillment-note">${esc(orderMethod().note)}</p></div><div class="checkout-block"><label class="field">Något vi ska veta? (frivilligt)<textarea name="notes" maxlength="400" placeholder="En extra servett? Något annat önskemål?">${esc(checkoutDraft.notes || '')}</textarea><small>Vid allergi: kontakta restaurangen innan du beställer.</small></label></div><div class="checkout-block"><h4>BETALNING</h4><div class="payment-option"><span aria-hidden="true"></span><span><strong>${esc(orderMethod().paymentLabel)}</strong><small>${restaurant.demo ? 'Demoläge — ingen betalning genomförs.' : fulfillment === 'dine_in' ? 'Du betalar på restaurangen när du kommer.' : 'Du betalar på restaurangen när du hämtar.'}</small></span></div></div><label class="consent-label"><input name="accepted" type="checkbox" required ${checkoutDraft.accepted ? 'checked' : ''}><span>Jag har kontrollerat min beställning, restaurang och tid.${restaurant.demo ? ' Jag förstår att detta är en demobeställning.' : ''}</span></label><div class="form-error" id="checkout-error" role="alert" tabindex="-1" hidden></div><button class="button button-green checkout-submit" type="submit" ${!activeSlots.length ? 'disabled' : ''}>${restaurant.demo ? 'BEKRÄFTA DEMOBESTÄLLNING' : 'SKICKA BESTÄLLNING'} <span>${money(summarizeCart(cart).total)} ↗</span></button><p class="checkout-privacy">${restaurant.demo ? 'Dina kontaktuppgifter stannar i webbläsaren i demoläget.' : 'Dina uppgifter används för att hantera din beställning.'} <button type="button" data-action="privacy">Läs om integritet.</button></p></fieldset></form></section><aside class="cart-panel" data-cart-panel data-readonly="true" aria-label="Beställningssammanfattning">${cartPanelMarkup(true)}</aside></div>`;
}

function renderConfirmation() {
  if (!lastReceipt) return;
  const receipt = lastReceipt;
  $('#order-content').innerHTML = `<section class="confirmation"><div class="success-icon" aria-hidden="true">✓</div><span class="eyebrow">${receipt.demo ? 'DEMON ÄR KLAR' : 'BESTÄLLNING BEKRÄFTAD'}</span><h3>${receipt.demo ? 'SÅ DÄR KOMMER<br>DET ATT FUNKA.' : 'VI FIXAR<br>DET GODA.'}</h3><p class="handwritten">${receipt.demo ? 'Nästan så man blir hungrig.' : 'Snart ses vi!'}</p><p>${receipt.demo ? 'Du har gått igenom hela beställningsflödet. Ingen riktig beställning har skickats och inga pengar har dragits.' : 'Din beställning har tagits emot. Uppge ditt ordernummer vid disken när du kommer.'}</p><div class="confirmation-receipt"><div><span>Ordernummer</span><strong>${esc(receipt.id)}</strong></div><div><span>Restaurang</span><strong>${esc(receipt.locationName)}<br>${esc(receipt.address)}</strong></div><div><span>Beställningssätt</span><strong>${esc(receipt.fulfillmentName)}</strong></div><div><span>${esc(receipt.timeLabel)}</span><strong>${esc(receipt.pickupLabel)}</strong></div><div><span>Din beställning</span><strong>${receipt.items.map(line => `${line.quantity} × ${esc(itemById(line.itemId).name)}${lineDetails(line) ? `<small class="receipt-details">${esc(lineDetails(line))}</small>` : ''}`).join('<br>')}</strong></div><div><span>Totalt${receipt.demo ? ' i demon' : ''}</span><strong>${money(receipt.total)}</strong></div></div><button class="button button-green" data-close="order-dialog">TILLBAKA TILL DET GODA ↗</button><button class="back-button" style="display:block;margin:20px auto 0" data-action="new-order">Gör en ny beställning</button></section>`;
}

function renderOrder() {
  renderProgress();
  $('#order-title').textContent = stage === 'checkout' ? 'DAGS FÖR DET SISTA.' : stage === 'confirmation' ? (lastReceipt?.demo ? 'TACK FÖR ATT DU TESTADE.' : 'TACK FÖR DIN BESTÄLLNING.') : fulfillment === 'dine_in' ? 'BESTÄLL & ÄT HÄR.' : 'BESTÄLL TAKEAWAY.';
  if (stage === 'location') renderLocationStep();
  else if (stage === 'menu') renderOrderMenu();
  else if (stage === 'cart') renderCart();
  else if (stage === 'checkout') renderCheckout();
  else if (stage === 'confirmation') renderConfirmation();
}

function openOrder(nextStage) {
  for (const id of ['nav-dialog', 'info-dialog']) if (document.getElementById(id).open) closeDialog(id);
  if (!selectedLocationId && restaurant.locations.length === 1) selectedLocationId = restaurant.locations[0].id;
  if (location() && !location().fulfillmentMethods.includes(fulfillment)) fulfillment = location().fulfillmentMethods[0];
  stage = nextStage || (selectedLocationId ? 'menu' : 'location');
  if (stage === 'checkout' && !selectedLocationId) stage = 'location';
  renderOrder();
  openDialog('order-dialog');
  $('#order-dialog').scrollTop = 0;
}

function refreshCartUI(announcement = '') {
  const totals = summarizeCart(cart);
  document.querySelectorAll('.cart-count').forEach(element => { element.textContent = totals.quantity; element.hidden = !totals.quantity; });
  document.querySelectorAll('.dock-cart').forEach(element => element.hidden = !totals.quantity);
  document.querySelectorAll('.dock-count,.mobile-quantity').forEach(element => element.textContent = totals.quantity);
  document.querySelectorAll('.mobile-total').forEach(element => element.textContent = `${money(totals.total)} ↗`);
  document.querySelectorAll('[data-cart-panel]').forEach(element => element.innerHTML = cartPanelMarkup(element.dataset.readonly === 'true'));
  if (announcement) $('#cart-announcement').textContent = announcement;
  persistCart();
}

function openProduct(id) {
  const item = itemById(id);
  if (!item) return;
  product = normalizeLine({ itemId: id, quantity: 1, extraIds: [], removed: [], isMeal: false });
  $('#product-content').innerHTML = `<img class="product-hero" src="${esc(item.image)}" alt="${esc(item.imageAlt)}" width="900" height="350"><form id="product-form"><div class="product-body"><div class="product-heading"><h2 id="product-title">${esc(item.name)}</h2><span>${money(item.price)}</span></div><p class="product-description">${esc(item.description)}</p><p class="allergens"><strong>Allergener:</strong> ${item.allergens.length ? esc(item.allergens.join(', ')) : 'Inga angivna i grundreceptet'}. Tillval kan innehålla fler allergener. Fråga oss vid allergi.</p>${item.meal ? `<fieldset class="product-options"><legend>HUNGRIG PÅ MER?</legend><label class="option-row"><input type="checkbox" name="isMeal"><span><strong>${esc(meal.name)}</strong><small>${esc(meal.description)}</small></span><span>+${money(meal.price)}</span></label><div class="meal-drink" id="meal-drink" hidden><label for="product-drink">Välj din dryck</label><select id="product-drink" name="drink">${meal.drinks.map(drink => `<option>${esc(drink)}</option>`).join('')}</select></div></fieldset>` : ''}${item.extras.length ? `<fieldset class="product-options"><legend>LITE EXTRA KÄRLEK</legend>${item.extras.map(id => extras.find(extra => extra.id === id)).map(extra => `<label class="option-row"><input type="checkbox" name="extraIds" value="${extra.id}"><span>${esc(extra.name)}${extra.allergens.length ? `<small>Innehåller ${esc(extra.allergens.join(', '))}</small>` : ''}</span><span>+${money(extra.price)}</span></label>`).join('')}</fieldset>` : ''}${item.removable.length ? `<fieldset class="product-options"><legend>NÅGOT DU VILL SKIPPA?</legend>${item.removable.map(name => `<label class="option-row"><input type="checkbox" name="removed" value="${esc(name)}"><span>Utan ${esc(name.toLowerCase())}</span><span>0 kr</span></label>`).join('')}</fieldset>` : ''}</div><div class="product-footer"><div class="qty-control" aria-label="Antal"><button type="button" data-product-quantity="-1" aria-label="Minska produktantal" disabled>−</button><span id="product-quantity">1</span><button type="button" data-product-quantity="1" aria-label="Öka produktantal">+</button></div><button class="button button-green" type="submit">LÄGG I VARUKORG <span id="product-total">${money(item.price)} ↗</span></button></div></form>`;
  openDialog('product-dialog');
  $('#product-dialog').scrollTop = 0;
}

function updateProduct() {
  if (!product) return;
  const values = new FormData($('#product-form'));
  product = normalizeLine({ ...product, isMeal: values.has('isMeal'), drink: values.get('drink'), extraIds: values.getAll('extraIds'), removed: values.getAll('removed') });
  if ($('#meal-drink')) $('#meal-drink').hidden = !product.isMeal;
  $('#product-quantity').textContent = product.quantity;
  $('#product-total').textContent = `${money(unitPrice(product) * product.quantity)} ↗`;
  $('[data-product-quantity="-1"]').disabled = product.quantity <= 1;
  $('[data-product-quantity="1"]').disabled = product.quantity >= restaurant.ordering.maxQuantityPerLine;
}

function addProduct() {
  if (!product) return;
  if (summarizeCart(cart).quantity + product.quantity > restaurant.ordering.maxCartItems) { toast(`Du kan beställa högst ${restaurant.ordering.maxCartItems} produkter åt gången.`); return; }
  const index = cart.findIndex(line => lineKey(line) === lineKey(product));
  if (index >= 0) {
    if (cart[index].quantity + product.quantity > restaurant.ordering.maxQuantityPerLine) { toast(`Du kan välja högst ${restaurant.ordering.maxQuantityPerLine} av samma kombination.`); return; }
    cart[index].quantity += product.quantity;
  } else cart.push({ ...product });
  pendingKey = null;
  const message = `${product.quantity} × ${itemById(product.itemId).name} i varukorgen`;
  refreshCartUI(message);
  closeDialog('product-dialog');
  product = null;
  if ($('#order-dialog').open && stage === 'cart') renderCart();
  toast(message);
}

function changeCart(index, delta, remove = false) {
  if (!Number.isInteger(index) || !cart[index] || busy) return;
  if (delta > 0 && summarizeCart(cart).quantity >= restaurant.ordering.maxCartItems) { toast(`Högst ${restaurant.ordering.maxCartItems} produkter per beställning.`); return; }
  if (remove) cart.splice(index, 1);
  else {
    cart[index].quantity = Math.min(restaurant.ordering.maxQuantityPerLine, cart[index].quantity + delta);
    if (cart[index].quantity <= 0) cart.splice(index, 1);
  }
  pendingKey = null;
  if (stage === 'cart') renderCart();
  refreshCartUI(`Varukorgen uppdaterad. ${summarizeCart(cart).quantity} produkter, ${money(summarizeCart(cart).total)}.`);
}

function delivery() {
  $('#info-content').innerHTML = `<span class="eyebrow">BURGARE TILL DÖRREN</span><h2 id="info-title">SOFFHÄNG?<br>VI FATTAR.</h2><p>Välj din restaurang. När hemleverans är tillgänglig fortsätter du till restaurangens meny hos <strong>foodora</strong>.</p><div class="delivery-options">${restaurant.locations.map(item => `<div class="delivery-option"><div><h3>${esc(item.name)}</h3><p>${esc(item.address)}</p></div>${foodoraLink(item) ? `<a class="button button-green" href="${esc(foodoraLink(item))}" target="_blank" rel="noopener noreferrer">TILL FOODORA ↗</a>` : '<span class="delivery-unavailable">Inte tillgängligt ännu</span>'}</div>`).join('')}</div><div class="info-takeaway"><p>Hellre en promenad? Ta med dig något gott direkt från oss.</p><button class="button button-green" data-action="order">BESTÄLL TAKEAWAY ↗</button></div>`;
  openDialog('info-dialog');
}

function privacy() {
  $('#info-content').innerHTML = `<span class="eyebrow">DINA UPPGIFTER</span><h2 id="info-title">EN LITEN<br>INTEGRITETSKOLL.</h2><p>Varukorgen och ditt restaurangval sparas lokalt i din webbläsare så att du kan fortsätta där du slutade. Du kan ta bort dem genom att rensa webbplatsens lagring.</p><h3>BESTÄLLNINGSUPPGIFTER</h3><p>${restaurant.ordering.mode === 'demo' ? 'I den här demon behandlas namn, telefonnummer, e-post och kommentar endast i webbläsarens minne. De skickas inte till en restaurang eller betalpartner, lagras inte i varukorgen och försvinner när du lämnar eller laddar om sidan.' : 'Namn, telefonnummer, eventuell e-post och beställningskommentar skickas till restaurangens beställningssystem för att hantera din beställning. Restaurangens fullständiga integritetspolicy ska publiceras här innan den skarpa tjänsten aktiveras.'}</p><h3>EXTERNA TJÄNSTER</h3><p>När du väljer Foodora eller Google Maps öppnas respektive tjänst och deras villkor och integritetspolicy gäller där. Den här mallen använder inga analysverktyg och laddar typsnitt och bilder från den egna webbplatsen.</p>`;
  openDialog('info-dialog');
}

function draftFromForm(form) {
  const data = new FormData(form);
  return { name: String(data.get('name') || '').trim(), phone: String(data.get('phone') || '').trim(), email: String(data.get('email') || '').trim(), pickupAt: data.get('pickupAt'), notes: String(data.get('notes') || '').trim(), accepted: data.has('accepted') };
}
function showCheckoutError(message) {
  const element = $('#checkout-error');
  element.textContent = message;
  element.hidden = false;
  element.focus();
}

async function placeOrder(form) {
  if (busy) return;
  checkoutDraft = draftFromForm(form);
  activeSlots = pickupSlots(location());
  const error = validateCheckout(checkoutDraft, activeSlots);
  if (error) { showCheckoutError(error); return; }
  const { total } = summarizeCart(cart);
  if (!cart.length || total < restaurant.ordering.minimumOrder) { showCheckoutError('Kontrollera din varukorg innan du fortsätter.'); return; }
  const receiptItems = cart.map(line => ({ ...line, extraIds: [...line.extraIds], removed: [...line.removed] }));
  const item = location();
  const slot = activeSlots.find(slot => slot.value === checkoutDraft.pickupAt);
  const payload = {
    restaurantId: restaurant.id, locationId: item.id, contentVersion: restaurant.contentVersion,
    items: receiptItems,
    customer: { name: checkoutDraft.name, phone: checkoutDraft.phone, email: checkoutDraft.email || null },
    notes: checkoutDraft.notes, fulfillment, requestedAt: checkoutDraft.pickupAt, timeZone: restaurant.timeZone, paymentMethod: 'pay_at_restaurant',
  };
  const fingerprint = JSON.stringify(payload);
  pendingKey = orderAttempts.get(fingerprint) || crypto.randomUUID();
  orderAttempts.set(fingerprint, pendingKey);
  busy = true;
  $('#checkout-error').hidden = true;
  const fieldset = form.querySelector('fieldset');
  fieldset.disabled = true;
  const submit = form.querySelector('[type=submit]');
  const oldLabel = submit.innerHTML;
  submit.textContent = 'BEKRÄFTAR…';
  try {
    const result = await submitOrder(payload, pendingKey);
    if (result.status === 'payment_required') { window.location.assign(result.paymentUrl); return; }
    lastReceipt = {
      id: result.id, demo: result.status === 'demo', locationName: `${restaurant.brand.name} ${item.name}`, address: item.address,
      pickupLabel: slot.label, fulfillmentName: orderMethod().name, timeLabel: orderMethod().receiptLabel, items: receiptItems, total: Number.isSafeInteger(result.total) ? result.total : total,
    };
    cart = [];
    checkoutDraft = {};
    pendingKey = null;
    refreshCartUI('Din beställning är klar.');
    orderAttempts.clear();
    stage = 'confirmation';
    renderOrder();
    $('#order-dialog').scrollTop = 0;
    $('#order-content .confirmation h3').setAttribute('tabindex', '-1');
    $('#order-content .confirmation h3').focus();
  } catch (error) {
    fieldset.disabled = false;
    submit.innerHTML = oldLabel;
    showCheckoutError(error.message || 'Något gick fel. Din varukorg finns kvar, försök igen.');
  } finally { busy = false; }
}

document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]');
  if (close) { if (!busy) closeDialog(close.dataset.close); return; }
  const productButton = event.target.closest('[data-product]');
  if (productButton) { openProduct(productButton.dataset.product); return; }
  const category = event.target.closest('[data-category]');
  if (category) {
    if (category.dataset.scope === 'home') { homeCategory = category.dataset.category; renderHomeMenu(); }
    else { orderCategory = category.dataset.category; $('#order-categories').innerHTML = categoryButtons(orderCategory, 'order'); renderOrderFoods(); }
    document.getElementById(`${category.dataset.scope}-tab-${category.dataset.category}`)?.focus({ preventScroll: true });
    return;
  }
  const methodButton = event.target.closest('[data-fulfillment]');
  if (methodButton) {
    if (!fulfillmentMethods.some(method => method.id === methodButton.dataset.fulfillment)) return;
    fulfillment = methodButton.dataset.fulfillment;
    checkoutDraft.pickupAt = '';
    pendingKey = null;
    persistCart();
    renderOrder();
    document.querySelector(`[data-fulfillment="${fulfillment}"]`)?.focus({ preventScroll: true });
    return;
  }
  const locationButton = event.target.closest('[data-location]');
  if (locationButton) {
    if (!restaurant.locations.some(item => item.id === locationButton.dataset.location)) return;
    selectedLocationId = locationButton.dataset.location;
    if (!location().fulfillmentMethods.includes(fulfillment)) fulfillment = location().fulfillmentMethods[0];
    checkoutDraft.pickupAt = '';
    pendingKey = null;
    persistCart();
    openOrder('menu');
    return;
  }
  const stageButton = event.target.closest('[data-stage]');
  if (stageButton) {
    if (busy) return;
    if ($('#checkout-form')) checkoutDraft = draftFromForm($('#checkout-form'));
    stage = stageButton.dataset.stage;
    renderOrder();
    $('#order-dialog').scrollTop = 0;
    return;
  }
  const quantityButton = event.target.closest('[data-quantity]');
  if (quantityButton) { changeCart(Number(quantityButton.dataset.index), Number(quantityButton.dataset.quantity)); return; }
  const removeButton = event.target.closest('[data-remove]');
  if (removeButton) { changeCart(Number(removeButton.dataset.remove), 0, true); return; }
  const productQuantity = event.target.closest('[data-product-quantity]');
  if (productQuantity && product) { product.quantity = Math.max(1, Math.min(restaurant.ordering.maxQuantityPerLine, product.quantity + Number(productQuantity.dataset.productQuantity))); updateProduct(); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'navigation') openDialog('nav-dialog');
  if (action === 'order') openOrder();
  if (action === 'cart') openOrder('cart');
  if (action === 'delivery') delivery();
  if (action === 'privacy') privacy();
  if (action === 'checkout') {
    if (!cart.length) { toast('Lägg något gott i varukorgen först.'); return; }
    openOrder(selectedLocationId ? 'checkout' : 'location');
  }
  if (action === 'clear-search') { orderSearch = ''; orderVeg = false; $('#order-search').value = ''; $('#order-veg').checked = false; renderOrderFoods(); }
  if (action === 'new-order') { lastReceipt = null; openOrder(); }
  if (event.target.closest('#nav-dialog a[href^="#"]')) closeDialog('nav-dialog');
});

document.addEventListener('keydown', event => {
  const tab = event.target.closest('[role=tab][data-category]');
  if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const index = categories.findIndex(category => category.id === tab.dataset.category);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? categories.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + categories.length) % categories.length;
    document.getElementById(`${tab.dataset.scope}-tab-${categories[next].id}`).click();
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'order-search') { orderSearch = event.target.value; renderOrderFoods(); }
  if (event.target.closest('#checkout-form')) pendingKey = null;
});
document.addEventListener('change', event => {
  if (event.target.id === 'home-veg') renderHomeMenu();
  if (event.target.id === 'order-veg') { orderVeg = event.target.checked; renderOrderFoods(); }
  if (event.target.closest('#product-form')) updateProduct();
});
document.addEventListener('submit', event => {
  if (event.target.id === 'product-form') { event.preventDefault(); updateProduct(); addProduct(); }
  if (event.target.id === 'checkout-form') { event.preventDefault(); placeOrder(event.target); }
});

for (const [key, value] of Object.entries(restaurant.brand.colors)) document.documentElement.style.setProperty(`--${key}`, value);
document.querySelectorAll('[data-brand]').forEach(element => {
  const key = element.dataset.brand;
  if (key === 'email') element.href = `mailto:${restaurant.brand.email}`;
  else if (restaurant.brand[key]) element.textContent = restaurant.brand[key];
});
$('.announcement').setAttribute('aria-label', restaurant.brand.announcement);
document.querySelectorAll('.announcement-track span').forEach(element => element.innerHTML = `${esc(restaurant.brand.announcement)} <b>✦</b>`);
document.title = restaurant.brand.title;
$('meta[name=description]').content = restaurant.brand.description;
$('meta[property="og:title"]').content = restaurant.brand.title;
$('meta[property="og:description"]').content = restaurant.brand.description;
$('#year').textContent = new Date().getFullYear();
const countCopy = restaurant.locations.length === 1 ? 'Ett ställe' : `${restaurant.locations.length === 2 ? 'Två' : restaurant.locations.length} ställen`;
$('.story-copy p:nth-of-type(2)').textContent = `${restaurant.brand.name} är kvartershaket för en snabb lunch, ett långt häng eller något riktigt gott på vägen hem. ${countCopy}. Samma magkänsla.`;
$('.locations-section .eyebrow').textContent = `${countCopy.toUpperCase()}. SAMMA KÄRLEK.`;
renderHomeMenu();
renderLocations();
refreshCartUI();
setInterval(() => {
  if (document.hidden) return;
  document.querySelectorAll('#locations-grid .location-card').forEach((element, index) => {
    const current = element.querySelector('.location-status');
    const next = locationStatus(restaurant.locations[index]);
    if (current && current.textContent !== next.text) current.outerHTML = statusMarkup(restaurant.locations[index]);
  });
}, 60000);
