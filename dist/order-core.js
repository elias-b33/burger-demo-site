import { restaurant, menu, extras, meal } from './restaurant.config.js';

export const money = value => new Intl.NumberFormat(restaurant.locale, { style: 'currency', currency: restaurant.currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value / 100);
export const itemById = (id, catalog = menu) => catalog.find(item => item.id === id);

export function normalizeLine(raw, catalog = menu, combo = meal) {
  const item = itemById(raw?.itemId, catalog);
  if (!item) return null;
  const quantity = Number(raw.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  return {
    itemId: item.id,
    quantity: Math.min(quantity, restaurant.ordering.maxQuantityPerLine),
    extraIds: [...new Set(Array.isArray(raw.extraIds) ? raw.extraIds : [])].filter(id => item.extras.includes(id)).sort(),
    removed: [...new Set(Array.isArray(raw.removed) ? raw.removed : [])].filter(name => item.removable.includes(name)).sort(),
    isMeal: !!(raw.isMeal && item.meal),
    drink: raw.isMeal && item.meal && combo.drinks.includes(raw.drink) ? raw.drink : combo.drinks[0],
  };
}

export function unitPrice(line, catalog = menu, addOns = extras, combo = meal) {
  const item = itemById(line.itemId, catalog);
  if (!item) return 0;
  return item.price + (line.isMeal ? combo.price : 0) + line.extraIds.reduce((sum, id) => sum + (addOns.find(extra => extra.id === id)?.price || 0), 0);
}

export function lineKey(line) {
  return JSON.stringify([line.itemId, [...line.extraIds].sort(), [...line.removed].sort(), line.isMeal, line.isMeal ? line.drink : null]);
}

export function summarizeCart(cart, priceForLine = unitPrice) {
  return {
    quantity: cart.reduce((sum, line) => sum + line.quantity, 0),
    total: cart.reduce((sum, line) => sum + priceForLine(line) * line.quantity, 0),
  };
}

export function lineDetails(line) {
  return [line.isMeal ? `Meny · pommes + ${line.drink}` : '', ...line.extraIds.map(id => extras.find(extra => extra.id === id)?.name), ...line.removed.map(name => `Utan ${name.toLowerCase()}`)].filter(Boolean).join(' · ');
}

function localParts(date) {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: restaurant.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

const mins = time => time.split(':').reduce((h, m) => Number(h) * 60 + Number(m));

/** All slot calculations use the restaurant's timezone, including DST transitions. */
export function pickupSlots(location, now = new Date()) {
  const nowParts = localParts(now);
  const today = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;
  const output = [];
  for (let day = 0; day < restaurant.ordering.scheduledDays; day++) {
    const calendar = new Date(Date.UTC(Number(nowParts.year), Number(nowParts.month) - 1, Number(nowParts.day) + day, 12));
    const dateKey = calendar.toISOString().slice(0, 10);
    const dayOfWeek = calendar.getUTCDay();
    const hours = Object.hasOwn(location.exceptions, dateKey) ? location.exceptions[dateKey] : location.hours[dayOfWeek];
    if (!hours) continue;
    const earliest = day === 0 ? Number(nowParts.hour) * 60 + Number(nowParts.minute) + location.pickupMinutes : 0;
    const start = Math.ceil(Math.max(mins(hours[0]), earliest) / restaurant.ordering.slotMinutes) * restaurant.ordering.slotMinutes;
    for (let minute = start; minute <= mins(hours[1]) - restaurant.ordering.slotMinutes; minute += restaurant.ordering.slotMinutes) {
      const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
      const dayName = dateKey === today ? 'Idag' : day === 1 ? 'Imorgon' : new Intl.DateTimeFormat(restaurant.locale, { weekday: 'long', timeZone: 'UTC' }).format(calendar);
      output.push({ value: `${dateKey}T${time}`, label: `${dayName} ${time}`, date: dateKey, time, day: dayName });
    }
  }
  return output;
}

export function locationStatus(location, now = new Date()) {
  const parts = localParts(now);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
  const hours = Object.hasOwn(location.exceptions, date) ? location.exceptions[date] : location.hours[dayOfWeek];
  const current = Number(parts.hour) * 60 + Number(parts.minute);
  if (hours && current >= mins(hours[0]) && current < mins(hours[1])) return { open: true, text: `Öppet till ${hours[1].replace(':', '.')}` };
  if (hours && current < mins(hours[0])) return { open: false, text: `Öppnar ${hours[0].replace(':', '.')}` };
  return { open: false, text: 'Stängt just nu · förbeställ gärna' };
}

export function validateCheckout(values, slots) {
  if (String(values.name || '').trim().length < 2) return 'Fyll i ditt namn, minst två tecken.';
  if (!/^[+\d\s()\-]{7,20}$/.test(String(values.phone || '').trim()) || String(values.phone).replace(/\D/g, '').length < 7) return 'Fyll i ett giltigt telefonnummer.';
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return 'Kontrollera e-postadressen.';
  if (!slots.some(slot => slot.value === values.pickupAt)) return 'Välj en tillgänglig tid för din beställning.';
  if (!values.accepted) return 'Bekräfta dina beställningsuppgifter för att fortsätta.';
  return null;
}
