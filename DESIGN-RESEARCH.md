# Designreferenser och beslut

Granskad 20 oktober 2026. Referenserna har använts för form och interaktionsmönster. Inga kundomdömen, popularitetssiffror eller betyg har kopierats eller hittats på.

| Referens | Det som togs med i mallen |
| --- | --- |
| [Saltbae Burger](https://www.saltbaeburger.com/en) | Huvudreferens: varm gräddfärg, mörkgrönt, grönt beställningsfokus, stor kompakt JUICY-rubrik, handskrivna röda accenter, sneda matbilder och en flytande nedre navigering. Eget arbetsvarumärke och egna huvudbilder. |
| [Bastard Burgers](https://bastardburgers.com/se/) | Tydliga separata ingångar för meny, restauranger och beställning. Vegetariska alternativ behöver vara enkla att hitta. |
| [Flippin’ Burgers](https://flippinburgers.se/) | Ett relevant småkedjeexempel: två restauranger, tydliga adresser och öppettider samt takeaway per enhet. |
| [The Burger, Framer](https://www.framer.com/marketplace/templates/the-burger/) | Kategoriserad meny med bilder och priser från gemensamma data, restauranger och leveranslänkar. Här implementerat i vanliga JavaScript-moduler för portabilitet. |
| [Burgers Walker’s, Dorik](https://dorik.com/template/burgers-walkers-burger-takeaway-website-template) | En återkommande och lättåtkomlig beställningsingång samt återanvändbara delar för meny, kontakt och öppettider. |

Syntesen är Saltbaes visuella uttryck med ett kort beställningsflöde för ett eller två lokala hak: restaurangval, meny och anpassning, varukorg, tid och kontaktuppgifter, bekräftelse. Foodora visas som ett separat leveransalternativ med en länk per restaurang. Den egna varukorgen behålls när gästen navigerar på sidan.

Startsidan prioriterar matbilder, meny och vägen till restaurangen. Påhittade stjärnbetyg, stora kedjors organisationssidor och onödiga kontokrav har inte lagts till. Alla restauranguppgifter är uttryckligen exempeldata.

## Förbättringar för webbplats som kassatillägg

Ytterligare granskning 20 oktober 2026. Följande är vår tillämpning av etablerade mönster på en mindre restaurang, inte en uppmätt konverteringsstudie av just denna demo.

| Källa | Relevant mönster | Genomfört i demon |
| --- | --- | --- |
| [Lightspeed: Online ordering](https://k-series-support.lightspeedhq.com/hc/en-us/articles/4686224687259-Online-ordering) | Integrerade webborders går till kassan, kan skickas till köket och flyttas mellan produktionssteg. | Mottagning, accept, tillagning, klar och utlämning; lokal anslutning till befintliga kassatjänster och bongar. |
| [Square: Pickup options](https://api.squareup.com/help/us/en/article/8608-set-up-pickup-options-for-your-online-ordering-profile) | Tillagningstid, tider, pauser och begränsning per upphämtningsfönster behöver kunna styras av restaurangen. | Ledtid, paus och orderkapacitet per 15 minuter, separat per enhet. |
| [Nielsen Norman Group: Usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) | Visa aktuell systemstatus, förebygg fel och ge begripliga vägar vidare när något går fel. | Automatisk gäststatus, slutsålda rätter spärras, prisändring kräver ny bekräftelse, fel behåller varukorgen och omförsök återanvänder samma order. |

Det gör kärndemon mer relevant för erbjudandet **webbplats + egen kassa**. En restaurang kan se hur beställningen kommer fram och vad personalen gör efteråt. Formgivningen är fortsatt Saltbae-inspirerad. Personalens vy har kompaktare rubriker, större arbetsyta och tydliga nästa steg.

Prioriteringen för en första produkt är: meny och tillgänglighet från samma källa, beställning utan konto, korrekta tillval och totalsummor, realistiska tider, säker mottagning, köksstatus och tydlig betalningsstatus. Kampanjer, lojalitetsprogram, bokning och separat leveranslogistik kan vänta tills detta flöde fungerar i drift. Detta är vår produktbedömning utifrån restaurangens vardag och det som den här demon faktiskt visar.

[DEMO-GUIDE.md](DEMO-GUIDE.md) beskriver en kort säljpresentation och tre vardagsscenarier. [POS-INTEGRATION.md](POS-INTEGRATION.md) skiljer verifierad lokal koppling från det som återstår för internetdrift.
