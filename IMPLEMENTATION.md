# Implementera mallen för en restaurang

## Filer att börja med

| Fil | Ansvar |
| --- | --- |
| `dist/restaurant.config.js` | Varumärke, restauranger, öppettider, meny, tillval och orderinställningar |
| `dist/order-core.js` | Prisberäkning, varukorg, tidsluckor och validering |
| `dist/order-adapter.js` | Gränsen mellan demo och egen ordertjänst |
| `dist/app.js` | Vyer och interaktioner |
| `dist/styles.css` | Layout, typografi och responsiva varianter |
| `vercel.json` | Vercels bygginställningar och HTTP-headers |

Alla bilder och typsnitt ligger lokalt i `dist/assets/`. Inga externa bild- eller typsnittstjänster anropas när en gäst besöker sidan.

## Ny restaurang

Byt `restaurant.id` för separat lokal varukorg. Byt namn, färger och kontaktuppgifter i `brand`. Ändra restaurangerna i `locations`: ID, namn, adress, bild, telefon, kartlänk, ledtid och öppettider. En restaurang fungerar utan en extra valdialog. För en kedja med två restauranger får gästen välja enhet.

Öppettider är samma dags lokala klockslag i `restaurant.timeZone`. Veckodag `0` är söndag. `exceptions` har datum som nyckel: `null` för stängt eller `['12:00','18:00']` för avvikande öppettider. Formatet stöder öppet fram till midnatt med sluttid `24:00`; restauranger som håller öppet efter midnatt behöver utökad tidslogik. `pickupMinutes` och `ordering.slotMinutes` styr framförhållning och tidsintervall. Sista tidsluckan ligger ett intervall före stängning.

Menypriser anges i öre. Behåll stabila produkt- och tillvals-ID:n när du ändrar texter. Öka `contentVersion` vid en menyändring som ska tömma gamla lokala varukorgar. Alla sidor läser samma menydata.

Byt de redaktionella texterna i `dist/index.html` när konceptet kräver det. Bildtexter, hero-rubrik, FAQ och berättelsen är innehåll, inte allmän orderlogik. Kontrollera riktiga ingredienser och allergener med restaurangen.

## Foodora — enklaste kopplingen

Sätt varje restaurangs **riktiga Foodora-menyadress** i `locations[].foodoraUrl`. Därefter visas en aktiv knapp för den restaurangen i leveransdialogen. Endast HTTPS-adresser på `foodora.se` eller dess underdomäner accepteras. `null` ger ett tydligt otillgängligt läge.

Gästen gör Foodora-beställningen hos Foodora. Den lokala varukorgen förs inte över, och denna länkbaserade koppling synkroniserar inte meny, priser, lager eller ordrar. En djupare integration kopplas separat i serverlagret till den orderpartner som restaurangen använder. Lägg inga API-nycklar i konfigurationsfilen eller webbläsaren.

## Egen ordermottagning

Demon är komplett att klicka igenom men saknar skarp ordermottagning, kassasystem och betalningsleverantör. Anslut en serverfunktion genom att sätta `ordering.mode = 'api'` och `ordering.apiEndpoint` till exempelvis `/api/orders`. Ha `restaurant.demo = true` tills hela integrationen är verifierad; därefter sätts flaggan till `false`.

Adaptern skickar `POST` med `Content-Type: application/json` och ett `Idempotency-Key`-headerfält:

```json
{
  "restaurantId": "smashverket",
  "locationId": "sodermalm",
  "contentVersion": 1,
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
  "pickupAt": "2026-10-21T18:00",
  "timeZone": "Europe/Stockholm",
  "paymentMethod": "pickup"
}
```

Beräkna pris, tillgänglighet, öppettider och kapacitet på servern från betrodda produktdata. Lita inte på inkommande priser eller klientens kontroll. Validera fält och antal, begränsa anrop och använd samma order-ID när samma idempotensnyckel skickas igen. Spara ordern varaktigt innan du returnerar godkänt. Kontakta restaurangens ordermottagare via den överenskomna kanalen. Klienten skickar inga mejl eller meddelanden själv.

Ett godkänt svar ser ut så här. `total` är i öre:

```json
{"id":"SV-1042","status":"accepted","total":17600}
```

Vid slutsåld rätt eller otillgänglig tid returnerar servern `409`. Övriga fel ger ett felmeddelande samtidigt som varukorgen finns kvar. Upprepning efter ett nätverksfel använder samma idempotensnyckel när samma order skickas oförändrad.

Grundflödet använder **betalning vid hämtning**. Adaptern har även en utökningspunkt för ett svar med `status: "payment_required"` och en HTTPS-`paymentUrl`. För att använda onlinebetalning krävs dessutom en verifierad betalningssession, returvy, webhook och serverbaserad orderstatus. Dessa delar ingår inte i mallen och får inte ersättas av en påhittad betalningsbekräftelse.

Vercel-konfigurationen tillåter nätverksanrop till samma origin. Placera API-rutten under samma domän eller ändra CSP och CORS avsiktligt för ditt system. Vercels statiska deploy skapar inte `/api/orders` automatiskt.

## Personuppgifter

Endast varukorg och restaurangval sparas i `localStorage`. Demokassans kontaktfält hålls i minnet och lämnar inte webbläsaren. För en riktig tjänst behöver restaurangen publicera sin egen integritetstext, retention och information om personuppgiftsansvarig och underleverantörer. Byt även exempeladresser, exempeltelefonnummer, innehåll och bilder före en verklig restauranglansering.
