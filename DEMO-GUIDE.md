# Visa webbplats + kassa för en restaurang

Demons viktigaste löfte är enkelt att visa: gästen beställer från restaurangens egen sida, personalen får rätt order och gästen vet när maten är klar. Saltbae-inspirerad form väcker intresset; flödet till köket visar värdet av webbsidan som tillägg till kassan.

## Välj rätt demovariant

| Variant | Användning | Vad den faktiskt gör |
| --- | --- | --- |
| [Publik webbplats](https://burger-demo-site.vercel.app/) + [orderöversikt](https://burger-demo-site.vercel.app/demo/) | Skicka en länk, prova utan installation | Kundorder, menyändringar och status delas mellan flikar i **samma webbläsare och på samma domän**. Data ligger i IndexedDB på den egna enheten. |
| Lokal kombinationsdemo | Visa hela erbjudandet tillsammans med ert kassasystem | Startar **er befintliga kassakod** med en separat testdatabas. Accepterade webborders blir testnotor och köks-/barbongar. Kökets status kommer tillbaka till webbsidan. Starta enligt [POS-INTEGRATION.md](POS-INTEGRATION.md). |

Den publika demon ansluter inte till en lokal kassa. En order som skapas i mobilen dyker inte upp i en annan dators publika demo. Kombinationsdemon är endast åtkomlig på datorns loopback-adress. Ingen variant debiterar en kund eller skickar SMS/mejl.

## En presentation på ungefär två minuter

1. Öppna gästsidan och `/demo/` i två flikar i samma webbläsare. I den lokala varianten öppnar du även testkassan på port 5196, loggar in med testprofilen och väljer **Kök**.
2. Visa startsidan kort. Klicka **Beställ online**, välj **Äta här** eller **Hämta själv**, sedan restaurang.
3. Beställ The Original som meny med extra cheddar och utan pickles. Peka på den tydliga summan: **176 kr**. Välj tid och använd **Fyll i demouppgifter**. Bekräfta.
4. Visa att kunden först får **Mottagen**, utan att det står att köket redan tillagar maten.
5. Byt till orderöversikten och klicka **Acceptera & skicka till köket**. I kombinationsdemon visas kassans notanummer och en faktisk köksbong med samma tillval.
6. Börja tillaga och markera klar. Gör det gärna i **ert befintliga köksgränssnitt** när kombinationsdemon används. Gästens sida uppdateras automatiskt inom några sekunder.
7. Markera utlämnad/serverad. Visa att maten kan vara utlämnad medan betalningsläget fortfarande är **Betalas i kassan**. Utlämning är ingen betalningsbekräftelse.

Knappen **Gör en provorder** är en snabb reservväg om du bara vill visa personalens vy. Den skapar en uttryckligt märkt provorder, inte påhittad historik. Alla siffror i översikten beräknas från demoordrarna.

## Tre extra scenarier som visar nyttan

- **Slutsålt:** välj *Meny & drift*, markera en burgare slutsåld och spara. Den blir obeställbar på gästsidan. En redan mottagen orders innehåll och pris ligger kvar som en ögonblicksbild.
- **Lunchrusning:** ändra tillagningstid och antal order per 15 minuter. Fulla luckor försvinner. Pausa webborders om köket behöver komma ikapp; mottagna order finns kvar.
- **Två restauranger:** ändra en rätt på Södermalm och byt till Vasastan. Driftläge, pris, tillgänglighet och beställningar är separata per enhet.

Avböj en order från detaljvyn om den inte kan fullföljas. Kunden ser att ordern är avböjd och får orsaken. I kombinationsdemon skapar avbrytning efter accept en makulering i testkassan.

## Det som gör demon bra

Visa en enda tydlig beställning genom hela kedjan. Låt restaurangen känna igen sin vardag: tillval på bongen, fulla tidsluckor, slutsålt och en stressig lunch. Lägg mer tid på vad personalen slipper dubbelregistrera än på att klicka igenom varje menyflik.

Ett bra nästa försäljningssamtal handlar om restaurangens meny, öppettider, arbetssätt och beställningsvolym. Anpassa färger, namn, bilder och en eller två enheter i samma mall. Visa alltid vilken demovariant som används och lova bara de anslutningar som är på plats.

## Omstart och lagring

Webbläsardemon kan återställas med **Återställ demo** i sidfoten. Det påverkar endast den egna webbläsarens demodata. Order äldre än 24 timmar filtreras bort nästa gång demon läses; högst 100 order ryms i en visning. Kontaktfält och fria kommentarer sparas eller skickas inte.

Den lokala kassademon får en ny databas för varje start under `.demo-state/session-*`. Den ändrar inga ordinarie kassadata. Kassans journal återställs inte via webbgränssnittet. Stoppa med Ctrl+C och starta en ny runda för en tom visning.

## Nästa steg till restaurang i drift

Den lokala kopplingen bevisar tabbar, bongar, meny och status mot befintlig kassakod. En skarp tjänst behöver fortfarande en driftsatt ordermottagare med restaurangbehörigheter, varaktig kö och återförsök, skyddad statuslänk och larm när kassan inte tar emot order. Onlinebetalning kräver separat betalningsintegration. Foodora är i denna mall en konfigurerbar restauranglänk.

Se [POS-INTEGRATION.md](POS-INTEGRATION.md) för den konkreta gränsen mellan färdig demo och produktionsanslutning.
