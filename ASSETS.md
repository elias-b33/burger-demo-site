# Bilder och typsnitt

## Egna genererade huvudbilder

Verktyg: inbyggda **Imagegen**, ingen CLI eller egen API-nyckel. Originalbilderna har kopierats till projektet och komprimerats till JPEG för webb. Inga referensbilder eller Saltbae-logotyper användes som bildindata.

`dist/assets/hero-meal.jpg` — slutlig prompt:

> Use case: ads-marketing. Asset type: portrait restaurant website editorial photograph, aspect ratio 4:5. Create an intensely appetizing real food photograph for a small Swedish craft smash burger restaurant. A spectacular double smashed beef cheeseburger with glossy toasted sesame brioche bun, melted yellow American cheddar, crisp seared beef edges, pickles and caramelized onions in foreground, golden thin fries alongside, and a tall vanilla milkshake with whipped cream slightly behind. On a rich dark forest-green diner table and wall, moody warm flash photography, analog film grain, direct camera flash, premium magazine food photography, close and tactile. Burgundy-red drinking straw. The burger fills much of the frame. Realistic imperfect delicious food, no artificial floating objects. No text, no watermark, no logos, no brand names. High-quality photograph, not a website screenshot.

`dist/assets/hero-closeup.jpg` — slutlig prompt:

> Use case: ads-marketing. Asset type: portrait burger restaurant website editorial photograph, aspect ratio 4:5. Extreme macro close-up of a juicy double smash cheeseburger, beautifully glossy golden toasted brioche bun with a few sesame seeds, cascading melted orange cheddar with intricate texture, thick caramelized onion, two deeply seared smashed beef patties with crispy edges, burger sauce and pickles. Cropped so burger almost fills entire frame, food details sharply focused, warm sunlight highlights, appetizing honest natural texture, dark forest-green blurred background at top corners. Premium flash food photography, editorial film texture, warm tan and deep golden colors, highly realistic. No text, no watermark, no logos. Not a website, just the photograph.

## Illustrativa demofoton

Bilderna är lokala kopior från Unsplash, med följande originalresurser. De visar inte verkliga Smashverket-restauranger eller garanterat de angivna recepten. Byt till restaurangens egna foton vid skarp implementation.

| Lokal fil | Källa |
| --- | --- |
| `original.jpg` | [Unsplash-bild](https://images.unsplash.com/photo-1568901346375-23c9450c58cd) |
| `hot.jpg` | [Unsplash-bild](https://images.unsplash.com/photo-1550547660-d9450f859349) |
| `green.jpg` | [Unsplash-bild](https://images.unsplash.com/photo-1520072959219-c595dc870360) |
| `fries.jpg` | [Unsplash-bild](https://images.unsplash.com/photo-1639024471283-03518883512d) |
| `shake.jpg` | [Unsplash-bild](https://images.unsplash.com/photo-1572490122747-3968b75cc699) |
| `restaurant-soder.jpg` | [Unsplash-bild](https://images.unsplash.com/photo-1517248135467-4c7edcad34c4) |
| `restaurant-vasa.jpg` | [Unsplash-bild](https://images.unsplash.com/photo-1552566626-52f8b828add9) |

Se [Unsplashs licens](https://unsplash.com/license). `scripts/fetch-assets.py` dokumenterar hämtningen; det behövs inte för bygg eller deploy.

## Typsnitt och vektorer

Barlow Condensed, Bree Serif, Caveat och DM Sans kommer från Google Fonts och ligger lokalt tillsammans med CSS-filen i `dist/assets/`. Typsnitten använder SIL Open Font License. Licenstexter finns i `licenses/`. SVG-filerna för favicon, dip och dryck är egen enkel vektorgrafik.
