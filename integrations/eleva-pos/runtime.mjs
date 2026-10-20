import path from 'node:path';
import os from 'node:os';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { mkdir,mkdtemp,rm,access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createSiteServer } from '../../server.mjs';
import { createPosBackend } from './backend.mjs';
import { posItemId } from './mapping.mjs';
import { samplePayload } from '../../dist/demo-engine.js';

const args = process.argv.slice(2);
const posRoot = path.resolve(args[args.indexOf('--pos-project') + 1]);
const verify = args.includes('--verify');
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const roundsRoot = path.resolve(project,'.demo-state');
const round = verify ? await mkdtemp(path.join(os.tmpdir(),'eleva-website-verify-')) : path.join(roundsRoot,`session-${Date.now()}-${randomUUID().slice(0,8)}`);
if (!verify && (path.dirname(round) !== roundsRoot || !path.basename(round).startsWith('session-'))) throw new Error('Demodatabasen måste ligga i projektets egen testmapp.');
await mkdir(round,{ recursive:true });
Object.assign(process.env,{ APP_MODE:'training',PAYMENT_ADAPTER:'simulator',FISCAL_ADAPTER:'simulator',PRINT_ADAPTER:'preview',TEST_ENVIRONMENT:'safe-test' });
delete process.env.ADMIN_RUNTIME_TOKEN;
const { createApp } = await import(pathToFileURL(path.join(posRoot,'server/app.ts')).href);
const webDir = path.join(posRoot,'dist/web');
if (!verify) await access(path.join(webDir,'index.html')).catch(() => { throw new Error('Bygg kassans webbgränssnitt först i kassaprojektet: npm run build. Inga befintliga kassadata behöver ändras.'); });
const instance = await createApp({
  profile:'template',database:path.join(round,'website-demo.sqlite'),backupDir:path.join(round,'backups'),
  webDir:verify ? undefined : webDir,sessionCookieName:'eleva_website_demo',
  safeTest:{ instanceId:'website-combination-demo',launchId:String(process.pid),sessionId:path.basename(round) },
});
const deviceCode = instance.store.get('meta','installation-profile')?.profile === 'template' ? 'KASSA-TEST' : 'LAGUSTOSA-TEST';
const posPort = Number(process.env.WEBSITE_POS_PORT || 5196);
const sitePort = Number(process.env.WEBSITE_DEMO_PORT || 5197);
const backend = createPosBackend(instance,{ posUrl:`http://127.0.0.1:${posPort}`,deviceCode });

async function verifyIntegration() {
  const { service,store,app } = instance;
  const initialTabs = store.all('tab').length;
  const payload = samplePayload(backend.read(),'sodermalm');
  payload.items.push({ itemId:'drink-0',quantity:1,extraIds:[],removed:[],isMeal:false,drink:'Coca-Cola' });
  const key = randomUUID();
  const order = backend.create(payload,key);
  assert.equal(order.status,'received');
  assert.equal(store.all('tab').length,initialTabs,'Unaccepted orders must not enter the kitchen');
  assert.equal(backend.create(payload,key).id,order.id,'Retry must not create another order');
  const accepted = backend.transition(order.id,'accepted');
  const tab = service.tab(accepted.pos.tabId);
  assert.equal(tab.serviceMode,'takeaway');
  assert.equal(tab.lines.length,2);
  assert.equal(tab.lines[0].unitPriceOre,17600);
  assert.ok(tab.lines[0].modifiers.some(option => option.name === 'Extra cheddar'));
  assert.ok(tab.lines[0].modifiers.some(option => option.name === 'Utan pickles'));
  assert.ok(tab.lines[0].notes.includes(order.id));
  const tickets = store.all('ticket').filter(ticket => ticket.tabId === tab.id && ticket.kind === 'order');
  assert.equal(tickets.length,2,'Kitchen and bar must receive their own tickets');
  assert.deepEqual(new Set(tickets.map(ticket => ticket.station)),new Set(['kitchen','bar']));
  assert.equal(backend.transition(order.id,'accepted').pos.tabId,tab.id);
  assert.equal(store.all('tab').length,initialTabs + 1);
  const login = await app.inject({ method:'POST',url:'/api/v1/auth/login',payload:{ staffId:'admin',pin:'1234',deviceCode } });
  assert.equal(login.statusCode,200,login.body);
  const cookies = login.cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  for (const ticket of tickets) {
    const response = await app.inject({ method:'POST',url:`/api/v1/tickets/${ticket.id}/status`,headers:{ cookie:cookies },payload:{ status:'started' } });
    assert.equal(response.statusCode,200,response.body);
  }
  assert.equal(backend.read().orders.find(item => item.id === order.id).status,'preparing','Native POS API status must reach the guest');
  for (const ticket of tickets) {
    const response = await app.inject({ method:'POST',url:`/api/v1/tickets/${ticket.id}/status`,headers:{ cookie:cookies },payload:{ status:'ready' } });
    assert.equal(response.statusCode,200,response.body);
  }
  assert.equal(backend.read().orders.find(item => item.id === order.id).status,'ready');
  backend.transition(order.id,'completed');
  assert.equal(backend.read().orders.find(item => item.id === order.id).paymentStatus,'pay_at_restaurant','Serving food must never mark it paid');
  assert.ok(store.all('ticket').filter(ticket => ticket.tabId === tab.id).every(ticket => ticket.status === 'served'));
  const dinePayload = { ...samplePayload(backend.read(),'vasastan'),fulfillment:'dine_in' };
  const dine = backend.transition(backend.create(dinePayload,randomUUID()).id,'accepted');
  assert.equal(service.tab(dine.pos.tabId).serviceMode,'dine_in');
  backend.transition(dine.id,'cancelled','Kunden avbeställer');
  assert.equal(service.tab(dine.pos.tabId).status,'void');
  assert.ok(store.all('ticket').some(ticket => ticket.tabId === dine.pos.tabId && ticket.kind === 'cancel'));
  const actor = service.session(service.login('admin','1234',deviceCode,'127.0.0.1').token);
  const mapped = service.menu().find(item => item.id === posItemId('sodermalm','original'));
  service.saveMenu(actor,{ ...mapped,available:false });
  assert.equal(backend.read().operations.sodermalm.products.original.available,false,'Native POS sold-out flag must reach guest menu');
  assert.throws(() => backend.create(payload,randomUUID()),/slutsåld/);
  service.saveMenu(actor,{ ...mapped,available:true });
  const stale = backend.create(samplePayload(backend.read(),'sodermalm'),randomUUID());
  service.saveMenu(actor,{ ...mapped,priceOre:14900,takeawayPriceOre:14900,available:true });
  assert.equal(backend.read().operations.sodermalm.products.original.price,14900);
  const tabsBeforeRejectedAcceptance = store.all('tab').length;
  assert.throws(() => backend.transition(stale.id,'accepted'),/Priserna i kassan skiljer/);
  assert.equal(store.all('tab').length,tabsBeforeRejectedAcceptance,'Failed acceptance must roll back the whole tab, lines and tickets');
  assert.equal(backend.read().orders.find(item => item.id === stale.id).status,'received');
  assert.equal(store.all('payment').length,0,'The website demo must never start a payment');
  assert.ok(store.verifyJournal(),'Existing POS journal must remain intact');
  console.log('POS integration verified: idempotent web order → actual tab → kitchen/bar tickets → native POS status → guest; takeaway/dine-in, sold-out/price sync, cancellation, atomic rollback, no payments, intact journal.');
}
if (verify) {
  try { await verifyIntegration(); }
  finally {
    await instance.app.close();
    const resolved = path.resolve(round);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('eleva-website-verify-')) throw new Error('Unexpected verification directory.');
    await rm(resolved,{ recursive:true,force:true });
  }
} else {
  await instance.app.listen({ host:'127.0.0.1',port:posPort });
  const website = createSiteServer({ backend });
  await new Promise((resolve,reject) => { website.once('error',reject); website.listen(sitePort,'127.0.0.1',resolve); });
  console.log(`Website: http://127.0.0.1:${sitePort}/`);
  console.log(`Webborder: http://127.0.0.1:${sitePort}/demo/`);
  console.log(`Existing POS: http://127.0.0.1:${posPort}/`);
  console.log(`Training login: Ansvarig / 1234 / ${deviceCode}`);
  console.log(`Separate demo database: ${round}`);
  let stopping = false;
  const stop = async () => {
    if (stopping) return; stopping = true;
    website.closeAllConnections(); await new Promise(resolve => website.close(resolve));
    await instance.app.close(); process.exitCode = 0;
  };
  process.on('SIGINT',stop); process.on('SIGTERM',stop);
}
