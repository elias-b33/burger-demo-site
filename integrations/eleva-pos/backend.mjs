import { randomUUID } from 'node:crypto';
import { restaurant } from '../../dist/restaurant.config.js';
import { initialState, normalizeState, baseCatalog, createDemoOrder, transitionOrder, updateOperation, samplePayload, activeStatuses } from '../../dist/demo-engine.js';
import { posItemId, toPosMenu, toPosAdd } from './mapping.mjs';

/** This adapter only accepts a private, freshly created training instance. */
export function createPosBackend(instance,{ posUrl,deviceCode = 'KASSA-TEST' }) {
  const { service,store } = instance;
  const actor = service.session(service.login('admin','1234',deviceCode,'127.0.0.1').token);
  const namespace = 'website-combination-demo';
  if (!store.get(namespace,'identity')) {
    const knownIds = new Set(restaurant.locations.flatMap(location => baseCatalog.map(item => posItemId(location.id,item.id))));
    for (const item of service.menu()) if (!knownIds.has(item.id)) service.saveMenu(actor,{ ...item,available:false });
    for (const location of restaurant.locations) for (const item of baseCatalog) service.saveMenu(actor,toPosMenu(item,location));
    const settings = service.settings();
    service.saveSettings(actor,{ ...settings,company:{ ...settings.company,name:`${restaurant.brand.name} · Webbdemo` } });
    store.put(namespace,{ id:'identity',createdAt:new Date().toISOString() });
  }
  if (!service.currentDay()) service.openDay(actor,{ key:`web-demo-day-${randomUUID()}`,floatOre:0 });
  function save(state) { store.put(namespace,{ ...state,id:'state' }); }
  function read() {
    return store.atomic(() => {
      const stored = store.get(namespace,'state');
      const state = normalizeState(stored);
      let changed = stored?.orders?.length !== state.orders.length;
      const posMenu = service.menu();
      for (const location of restaurant.locations) for (const item of baseCatalog) {
        const current = posMenu.find(candidate => candidate.id === posItemId(location.id,item.id));
        if (!current) continue;
        const product = { price:current.takeawayPriceOre ?? current.priceOre,available:current.available };
        const previous = state.operations[location.id].products[item.id];
        if (JSON.stringify(previous) !== JSON.stringify(product)) { state.operations[location.id].products[item.id] = product; changed = true; }
      }
      for (const order of state.orders.filter(order => order.pos)) {
        const tab = service.tab(order.pos.tabId);
        if (tab.status === 'paid' && order.paymentStatus !== 'paid_in_pos') {
          order.paymentStatus = 'paid_in_pos'; order.updatedAt = new Date().toISOString();
          order.events.push({ status:order.status,at:order.updatedAt,label:'Betalning registrerad i testkassan. Ingen riktig betalning.' });
          changed = true;
        }
        if (!activeStatuses.includes(order.status)) continue;
        const tickets = store.all('ticket').filter(ticket => ticket.tabId === tab.id && ticket.kind === 'order');
        let status = order.status;
        if (tab.status === 'void') status = 'cancelled';
        else if (tickets.length && tickets.every(ticket => ticket.status === 'served')) status = 'completed';
        else if (tickets.length && tickets.every(ticket => ['ready','served'].includes(ticket.status))) status = 'ready';
        else if (tickets.some(ticket => ['started','ready','served'].includes(ticket.status))) status = 'preparing';
        if (status !== order.status) {
          order.status = status; order.updatedAt = new Date().toISOString();
          if (status === 'cancelled') order.reason = 'Avbruten i testkassan';
          order.events.push({ status,at:order.updatedAt,label:'Status uppdaterad från er befintliga kassa/köksskärm.' });
          changed = true;
        }
      }
      if (changed) { state.revision++; state.updatedAt = new Date().toISOString(); save(state); }
      return state;
    });
  }
  function create(payload,key) {
    return store.atomic(() => {
      const state = read(); const order = createDemoOrder(state,payload,key); save(state); return order;
    });
  }
  function transition(id,status,reason) {
    return store.atomic(() => {
      const state = read();
      const order = state.orders.find(order => order.id === id);
      if (!order) throw new Error('Beställningen finns inte.');
      if (order.status === status) return order;
      transitionOrder(state,id,status,reason);
      if (status === 'accepted') {
        let tab = service.createTab(actor,{ key:`${order.id}:tab`,tableId:null,guestCount:1,serviceMode:order.fulfillment === 'dine_in' ? 'dine_in' : 'takeaway' });
        order.items.forEach((line,index) => { tab = service.updateTab(actor,tab.id,toPosAdd(order,line,index,tab.version)); });
        const total = tab.lines.filter(line => line.status !== 'void').reduce((sum,line) => sum + line.unitPriceOre * line.quantity,0);
        if (total !== order.total) throw new Error('Priserna i kassan skiljer sig från webbordern. Ingen order har skickats till köket.');
        tab = service.updateTab(actor,tab.id,{ key:`${order.id}:send`,version:tab.version,action:'send' });
        const tickets = store.all('ticket').filter(ticket => ticket.tabId === tab.id && ticket.kind === 'order');
        order.pos = { tabId:tab.id,tabNumber:tab.number,ticketIds:tickets.map(ticket => ticket.id) };
        order.events.at(-1).label = `Accepterad · nota ${tab.number} och köks-/barbong skapad i er testkassa.`;
      } else if (order.pos && ['preparing','ready','completed'].includes(status)) {
        const target = { preparing:'started',ready:'ready',completed:'served' }[status];
        const progression = ['queued','started','ready','served'];
        for (const ticketId of order.pos.ticketIds) {
          let ticket = store.get('ticket',ticketId);
          while (progression.indexOf(ticket.status) < progression.indexOf(target)) ticket = service.updateTicket(actor,ticket.id,progression[progression.indexOf(ticket.status) + 1]);
        }
      } else if (order.pos && status === 'cancelled') {
        let tab = service.tab(order.pos.tabId);
        if (tab.status !== 'open') throw new Error('Notan är redan avslutad i kassan. Kontrollera den där.');
        for (const line of tab.lines.filter(line => line.status !== 'void')) tab = service.updateTab(actor,tab.id,{ key:`${order.id}:cancel:${line.id}`,version:tab.version,action:'remove',lineId:line.id,reason });
        service.updateTab(actor,tab.id,{ key:`${order.id}:void`,version:tab.version,action:'void' });
      }
      save(state); return order;
    });
  }
  function operation(locationId,patch) {
    return store.atomic(() => {
      const state = read(); const result = updateOperation(state,locationId,patch);
      if (patch.product) {
        const item = service.menu().find(item => item.id === posItemId(locationId,patch.product.id));
        service.saveMenu(actor,{ ...item,priceOre:patch.product.price ?? item.priceOre,takeawayPriceOre:patch.product.price ?? item.takeawayPriceOre,available:patch.product.available ?? item.available });
      }
      save(state); return result;
    });
  }
  return {
    runtime:() => ({ mode:'pos',label:'Ansluten till er testkassa',description:'Webbordrar går till er befintliga kassakod och köks-/barbongar. Separat lokal demodatabas, inga riktiga betalningar.',posUrl,deviceCode }),
    read,create,transition,operation,
    sample:locationId => { const state = read(); return create(samplePayload(state,locationId),randomUUID()); },
  };
}
