# Smashverket · Burger restaurant template

En färdig svensk restaurangmall för en mindre burgarkedja. Saltbae Burger är huvudreferensen för gräddfärg, skogsgrönt, stora rubriker, handskrivna detaljer och sneda matbilder. Namn, restauranger, adresser, priser och innehåll är exempel.

Mallen har responsiv startsida, digital meny, vegetariskt filter, produktanpassning, varukorg, tidbokning för upphämtning och en komplett demokassa. Foodora-länkar och adapter för riktig ordermottagning är förberedda.

**Beställningar körs i demoläge. Inga pengar dras och inga beställningar skickas.**

## Starta lokalt

Använd Node.js 24. Inga tredjepartsberoenden behövs för webbplatsen.

```sh
npm ci
npm run dev
```

Öppna <http://127.0.0.1:5187>. `PORT` kan ändra porten. `npm run build` kontrollerar orderlogik och resurser och bygger till `build/`. `dist/` innehåller de redigerbara källfilerna, även om katalognamnet heter dist.

## Publicera på Vercel

1. Importera GitHub-repot `elias-b33/burger-demo-site` på Vercel.
2. Använd repots rot som **Root Directory** och **Other** som framework.
3. `vercel.json` anger **Build Command** `npm run build`, **Output Directory** `build` och **Install Command** `npm ci --ignore-scripts`.
4. Tryck **Deploy**. Demon behöver inga miljövariabler eller nycklar.

Valfri `SITE_URL=https://din-domän.se` ger absoluta delningsbilder för egen domän. Annars använder bygget Vercels automatiska URL-variabler. Demoversionen har `noindex`; sätt `restaurant.demo` till `false` först när den riktiga restauranginformationen och ordermottagningen är klara.

Vercel serverar de statiska filerna. `server.mjs` är endast för lokal utveckling. En eventuell API-adapter kräver en riktig serverfunktion eller ett eget ordersystem; en sådan tjänst ingår inte i demon.

## Anpassa för en ny restaurang

Ändra `dist/restaurant.config.js`: varumärke, färger, restauranger, öppettider, ledtid, meny, priser, tillval och Foodora-länkar. Ta bort eller lägg till restaurangobjekt för en eller två enheter. Priser anges i **öre**, exempelvis `11900` för 119 kr. Byt även matbilder och redaktionell text i `dist/index.html` efter behov.

Se [IMPLEMENTATION.md](IMPLEMENTATION.md) för orderintegration och [DESIGN-RESEARCH.md](DESIGN-RESEARCH.md) för designbesluten. Bildkällor och genereringsprompter finns i [ASSETS.md](ASSETS.md).

## Verifiering

```sh
npm run check
npm run build
```

Kontrollerna täcker tillval och totalsummor, rimliga antal, öppettider och sommartid, kassavalidering, Foodora-adresser och lokala bild- och typsnittsfiler. Beställningsflödet har också provats i webbläsare.
