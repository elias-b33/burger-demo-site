# Implementera mallen för en restaurang

## Filer att börja med

| Fil | Ansvar |
| --- | --- |
| `dist/restaurant.config.js` | Varumärke, restauranger, öppettider, meny, tillval och orderinställningar |
| `dist/order-core.js` | Prisberäkning, varukorg, tidsluckor och validering |
| `dist/order-adapter.js` | Gränsen mellan demo och egen ordertjänst |
| `dist/demo-engine.js` | Ordervalidering, sparade orderrader, status, kapacitet och driftläge |
| `dist/demo-store.js` | IndexedDB, fliksynk och transport till lokal kassademo |
| `dist/demo-dashboard.js` | Restaurangens mottagning, historik och meny-/driftvy |
| `integrations/eleva-pos/` | Lokal anslutning till ert befintliga kassaprojekt |
| `dist/app.js` | Vyer och interaktioner |
| `dist/styles.css` | Layout, typografi och responsiva varianter |
| `vercel.json` | Vercels bygginställningar och HTTP-headers |

Alla bilder och typsnitt ligger lokalt i `dist/assets/`. Inga externa bild- eller typsnittstjänster anropas när en gäst besöker sidan.

## Ny restaurang

Byt `restaurant.id` för separat lokal varukorg. Byt namn, färger och kontaktuppgifter i `brand`. Ändra restaurangerna i `locations`: ID, namn, adress, bild, telefon, kartlänk, ledtid och öppettider. En restaurang fungerar utan en extra valdialog. För en kedja med två restauranger får gästen välja enhet.

Öppettider är samma dags lokala klockslag i `restaurant.timeZone`. Veckodag `0` är söndag. `exceptions` har datum som nyckel: `null` för stängt eller `['12:00','18:00']` för avvikande öppettider. Formatet stöder öppet fram till midnatt med sluttid `24:00`; restauranger som håller öppet efter midnatt behöver utökad tidslogik. `pickupMinutes` och `ordering.slotMinutes` styr framförhållning och tidsintervall. Sista tidsluckan ligger ett intervall före stängning.

Menypriser anges i öre. Behåll stabila produkt- och tillvals-ID:n när du ändrar texter. Öka `contentVersion` vid en menyändring som ska tömma gamla lokala varukorgar. Alla sidor läser samma menydata.

Byt de redaktionella texterna i `dist/index.html` när konceptet kräver det. Bildtexter, hero-rubrik, FAQ och berättelsen är innehåll, inte allmän orderlogik. Kontrollera riktiga ingredienser och allergener med restaurangen.

## Hämta själv och Äta här

`locations[].fulfillmentMethods` anger om en restaurang stödjer `pickup`, `dine_in` eller båda. Texterna för respektive läge finns i `fulfillmentMethods`. Gästen kan välja på restaurangsteget eller ändra i beställningsmenyn. Varukorg, kassa och bekräftelse visar samma val. För Äta här anges ankomst och serveringstid; maten hämtas vid disken och inget bord reserveras. Servern får `fulfillment` och `requestedAt`, och ska validera att enheten stöder valt läge.

## Foodora — enklaste kopplingen

Sätt varje restaurangs **riktiga Foodora-menyadress** i `locations[].foodoraUrl`. Därefter visas en aktiv knapp för den restaurangen i leveransdialogen. Endast HTTPS-adresser på `foodora.se` eller dess underdomäner accepteras. `null` ger ett tydligt otillgängligt läge.

Gästen gör Foodora-beställningen hos Foodora. Den lokala varukorgen förs inte över, och denna länkbaserade koppling synkroniserar inte meny, priser, lager eller ordrar. En djupare integration kopplas separat i serverlagret till den orderpartner som restaurangen använder. Lägg inga API-nycklar i konfigurationsfilen eller webbläsaren.

## Fungerande demo och egen ordermottagning

Webbläsardemon tar emot testordrar i IndexedDB och synkar meny, driftläge och status mellan flikar i samma webbläsare. `/demo/` är restaurangens orderöversikt. Status går från mottagen till bekräftad, tillagas, klar och utlämnad; avböj/avbryt har en synlig orsak. Det finns ingen servergemensam orderdatabas i den publika statiska versionen.

Den lokala kombinationsdemon går längre och använder ert befintliga kassaprojekts tjänster. Accepterade order blir testnotor och riktiga testbongar i en separat databas. Se [POS-INTEGRATION.md](POS-INTEGRATION.md) för start, verifiering och exakta begränsningar. Låt demoflaggorna vara aktiva även i denna isolerade visning.

För skarp drift ansluts en driftsatt serverfunktion genom `ordering.apiEndpoint`, exempelvis `/api/orders`. Behåll `ordering.mode = 'demo'` och `restaurant.demo = true` under arbetet. När den riktiga ordertjänsten är verifierad ändras båda tillsammans till `ordering.mode = 'api'` och `restaurant.demo = false`. Bygget stoppar motstridiga inställningar.

Adaptern skickar `POST` med `Content-Type: application/json` och ett `Idempotency-Key`-headerfält:

```json
{
  "restaurantId": "smashverket",
  "locationId": "sodermalm",
  "contentVersion": 1,
  "expectedTotal": 17600,
  "items": [{
    "itemId": "original",
    "quantity": 1,
    "extraIds": ["cheese"],
    "removed": ["Pickles"],
    "isMeal": true,
    "drink": "Coca-Cola"
  }],
  "customer": {"name": "Exempel", "phone": "0700000000", "email": null},
  "notes": "En extra servett, tack",
  "fulfillment": "dine_in",
  "requestedAt": "2026-10-21T18:00",
  "timeZone": "Europe/Stockholm",
  "paymentMethod": "pay_at_restaurant"
}
```

Beräkna pris, tillgänglighet, öppettider och kapacitet på servern från betrodda produktdata. Lita inte på inkommande priser eller klientens kontroll. Validera fält och antal, begränsa anrop och använd samma order-ID när samma idempotensnyckel skickas igen. Spara ordern varaktigt innan du returnerar godkänt. Kontakta restaurangens ordermottagare via den överenskomna kanalen. Klienten skickar inga mejl eller meddelanden själv.

Ett godkänt svar ser ut så här. `total` är i öre:

```json
{"id":"SV-1042","status":"accepted","total":17600}
```

Vid slutsåld rätt eller otillgänglig tid returnerar servern `409`. Övriga fel ger ett felmeddelande samtidigt som varukorgen finns kvar. Upprepning efter ett nätverksfel använder samma idempotensnyckel när samma order skickas oförändrad.

Grundflödet använder **betalning i restaurangen**, vid hämtning eller vid besöket beroende på beställningssätt. Adaptern har även en utökningspunkt för ett svar med `status: "payment_required"` och en HTTPS-`paymentUrl`. För att använda onlinebetalning krävs dessutom en verifierad betalningssession, returvy, webhook och serverbaserad orderstatus. Dessa delar ingår inte i mallen och får inte ersättas av en påhittad betalningsbekräftelse.

Vercel-konfigurationen tillåter nätverksanrop till samma origin. Placera API-rutten under samma domän eller ändra CSP och CORS avsiktligt för ditt system. Vercels statiska deploy skapar inte `/api/orders` automatiskt.

## Personuppgifter

Varukorg, restaurangval och genväg till senaste demoorder sparas i `localStorage`. Orderrader, tider, driftläge och status sparas i IndexedDB i webbläsardemon. Kontaktfält och fria kommentarer hålls i minnet och tas bort från demotransporten. Order äldre än 24 timmar filtreras bort vid nästa läsning. Den lokala kassademon använder i stället en separat testdatabas; kassans journal behålls i den testomgångens mapp.

För en riktig tjänst behöver restaurangen publicera sin egen integritetstext, retention och information om personuppgiftsansvarig och underleverantörer. Byt även exempeladresser, exempeltelefonnummer, innehåll och bilder före en verklig restauranglansering.
