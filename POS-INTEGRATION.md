# Koppling till ert befintliga kassasystem

Kombinationsdemon använder kassans befintliga `server/app.ts`, tjänster, databas, journal och byggda webbgränssnitt. Den skapar en ny instans med egna testdata. Kassaprojektets källkod och vanliga databas ändras inte.

## Starta

Använd Node.js 24. Kassaprojektet måste ha sina vanliga beroenden installerade (`tsx` och SQLite-modulen) samt byggt webbgränssnitt i `dist/web`. Webbprojektet har inga egna paketberoenden.

Kör från webbprojektets rot, med sökvägen till den lokala kassacheckouten:

```powershell
npm run demo:pos -- --pos-project 'C:\sökväg\till\lagustosa-kassa'
```

Alternativt kan `ELEVA_POS_PROJECT` innehålla sökvägen. Inga kassanycklar behöver läggas i webbsidans konfiguration.

| Del | Lokal adress |
| --- | --- |
| Gästsida | http://127.0.0.1:5197/ |
| Mottagning av webborder | http://127.0.0.1:5197/demo/ |
| Er befintliga kassa och köksskärm | http://127.0.0.1:5196/ |

Testinloggning i den nyskapade instansen: **Ansvarig**, PIN **1234**, enhetskod **KASSA-TEST**. För en äldre installationsprofil visar startutskriften rätt testkod. Detta är endast startdata i en separat träningsinstans.

Portarna kan bytas med `WEBSITE_POS_PORT` och `WEBSITE_DEMO_PORT`. Stoppa med Ctrl+C. Varje start får en egen mapp under `.demo-state/`; den är ignorerad av Git. Demoläget tvingar träningsläge, simulerade betalningar, simulerad fiskaladapter och förhandsvisning av utskrifter. Det genomför ingen betalning och skriver inte till en fysisk skrivare.

## Hur en order går igenom

1. Gästen skickar produkt-ID:n, tillval, antal, restaurang, serveringssätt och önskad tid. Demotransporten tar bort kontaktuppgifter och fri text.
2. Demomottagaren validerar mot aktuell meny, priser, öppettider, ledtid och kapacitet. Ett stabilt försöks-ID gör upprepade anrop idempotenta. Ordern sparas som **Mottagen**.
3. När personalen accepterar skapar adaptern en nota genom kassans `createTab` och `updateTab`. `pickup` blir kassans `takeaway`; `dine_in` behålls. Produkt-ID:n mappas stabilt per restaurang: `web-<restaurang>--<produkt>`.
4. Tillval och bortval går in som kassans modifierare. Ordernummer, restaurang, serveringssätt och tid står på orderraden. Skicka-kommandot skapar kassans vanliga köks-/barbongar.
5. Hela mottagningen körs i en SQLite-transaktion. Om priset ändrats innan accept eller någon rad inte kan läggas in rullas notan, kommandona och bongarna tillbaka. Webborden väntar på åtgärd och ingen halv nota blir kvar.
6. Kökets `started`, `ready` och `served` läses tillbaka och visas som **Tillagas**, **Klar** och **Utlämnad/serverad**. Alla bongar måste vara klara innan hela ordern blir klar. Status kontrolleras varannan sekund.

Självständig dryck går till baren; burgare och sides till köket. Menytillägget *pommes + vald läsk* är en modifierare på burgarraden och står på köksbongen. Det delas inte upp i separata lager- eller barrader. Ett skarpt koncept med separat packning av menyer behöver en explicit recept-/paketmodell i kassan.

Pris och säljbarhet kan ändras i webbens driftvy eller i kassans meny. Ändringar läses tillbaka till gästen. Webbens driftvy använder samma demo-pris för takeaway och servering; restauranger med olika priser per serveringssätt behöver en utökad prisprojektion före skarp anslutning. Redan mottagna order visar sitt sparade pris. Matens utlämning markerar aldrig ordern som betald. Om en betalning registreras i testkassan kan den projiceras separat.

## Filer och ansvar

| Fil | Ansvar |
| --- | --- |
| `dist/demo-engine.js` | Ordervalidering, prisögonblicksbild, tidsluckor, kapacitet, statusövergångar och driftläge |
| `dist/demo-store.js` | Webbläsarlagring eller lokal HTTP-transport; filtrerar bort personuppgifter i demon |
| `integrations/eleva-pos/mapping.mjs` | Webbprodukter och modifierare till kassans meny och kommandon |
| `integrations/eleva-pos/backend.mjs` | Befintliga kassatjänster, atomisk accept, menyprojektion, avbrytning och status |
| `integrations/eleva-pos/runtime.mjs` | Isolerad testinstans och verifiering mot verklig kassakod |
| `scripts/launch-pos.mjs` | Startar adaptern med kassans befintliga TypeScript-loader |
| `server.mjs` | Lokal statisk webbserver och snävt avgränsade `/api/demo/*`-rutter |

## Verifiera mot kassaprojektet

```powershell
npm run verify:pos -- --pos-project 'C:\sökväg\till\lagustosa-kassa'
```

Verifieringen startar en separat tillfällig databas och stänger den efteråt. Den kontrollerar riktiga notor, köks- och barbongar, tillval, idempotens, status via kassans autentiserade API, serveringssätt, slutsålt, prisändring, makulering, transaktionsåterställning och intakt journal. Den kontrollerar också att inga betalningar skapas. Den kräver kassans beroenden men ingen ändring av dess källkod.

Kompatibiliteten har provats mot den lokala `lagustosa-kassa`-versionens `createApp`/service-kontrakt den 20 oktober 2026. Kassans pågående ändringar och den separata Android-appen har inte skrivits om. Adaptern är en lokal demoanslutning, inte ett versionerat publikt POS-API.

## Driftsättning efter demon

Vercel serverar den publika statiska webbdemon. Den publicerar inga kassainloggningar, startar ingen SQLite-instans och kan inte anropa en dators `localhost`. Produktionsvägen är en separat serveranslutning mellan webbens ordermottagare och kassan.

| Del | Färdigt att visa | Återstår för skarp drift |
| --- | --- | --- |
| Varumärke, meny, varukorg | Responsiv mall och konfiguration | Riktig meny, bilder, priser och restauranguppgifter |
| Webborder till kassa | Verifierad lokal accept till nota och bong | Driftsatt ingress, enhets-/restaurangidentitet, behörigheter och kö |
| Pris och slutsålt | Synk i lokal testinstans | Versionshanterad menyprojektion samt recept och olika serveringspriser vid behov |
| Orderstatus | Tvåvägsstatus i den lokala instansen | Skyddade statuslänkar över internet och återanslutning över enheter |
| Betalning | Betala på restaurangen; ingen automatisk betalmarkering | Riktig betalningsleverantör och serverbekräftade betalhändelser om onlinebetalning ska erbjudas |
| Foodora | Säker länk per restaurang | Partneranslutning om order/meny ska synkas till kassan |
| Drift | Paus, ledtid, luckkapacitet, felbesked | Övervakning, kvittenser, larm, återförsök, stöd vid kassabortfall och datalivscykel |

Behåll kassans registrerings-, betalnings- och journalregler i serverlagret. Flytta inte administratörsinloggning från denna lokala testruntime till en publik klient. `/api/demo/state` innehåller demotokens och alla demoordrar och ska inte återanvändas som publikt kund-API. Produktionsstatus ska svara för en behörig order, medan personalvyer kräver restaurangbehörighet.
