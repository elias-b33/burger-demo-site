/**
 * BYT RESTAURANG HÄR. Priser är heltal i öre. Inga hemligheter i denna fil.
 * Läs IMPLEMENTATION.md innan ordering.mode ändras till "api".
 */
export const restaurant = {
  id: 'smashverket',
  contentVersion: 1,
  locale: 'sv-SE',
  currency: 'SEK',
  timeZone: 'Europe/Stockholm',
  brand: {
    name: 'Smashverket',
    wordmark: '#smashverket',
    tagline: 'BURGERS & GOOD TIMES',
    title: 'Smashverket — småskaligt, storslaget gott.',
    description: 'Smashade burgare, krispiga pommes och riktigt gott häng. Välj din restaurang och beställ takeaway direkt hos oss.',
    email: 'hej@smashverket.example',
    instagramUrl: null,
    colors: { cream: '#f9e6d2', green: '#254b3e', red: '#bc302c', lime: '#27ec59' },
    announcement: 'SMASHAT PÅ BESTÄLLNING. HÄMTA VARMT. ÄT GOTT.',
  },
  demo: true,
  ordering: {
    mode: 'demo',
    apiEndpoint: '/api/orders',
    maxQuantityPerLine: 20,
    maxCartItems: 50,
    minimumOrder: 0,
    slotMinutes: 15,
    scheduledDays: 3,
  },
  locations: [
    {
      id: 'sodermalm', name: 'Södermalm', area: 'STOCKHOLM',
      address: 'Skånegatan 84', postalCode: '116 37 Stockholm',
      phone: '08-000 00 01', phoneHref: '+4680000001',
      image: 'assets/restaurant-soder.jpg',
      imageAlt: 'Varmt upplyst restaurang med träbord och avslappnad atmosfär',
      pickupMinutes: 20,
      fulfillmentMethods: ['pickup', 'dine_in'],
      hours: { 0: ['12:00', '21:00'], 1: ['11:00', '21:00'], 2: ['11:00', '21:00'], 3: ['11:00', '21:00'], 4: ['11:00', '21:00'], 5: ['11:00', '22:00'], 6: ['12:00', '22:00'] },
      exceptions: {},
      foodoraUrl: null,
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Sk%C3%A5negatan+84+Stockholm',
    },
    {
      id: 'vasastan', name: 'Vasastan', area: 'STOCKHOLM',
      address: 'Odengatan 38', postalCode: '113 51 Stockholm',
      phone: '08-000 00 02', phoneHref: '+4680000002',
      image: 'assets/restaurant-vasa.jpg',
      imageAlt: 'Ombonad kvartersrestaurang med gröna växter och mjukt ljus',
      pickupMinutes: 25,
      fulfillmentMethods: ['pickup', 'dine_in'],
      hours: { 0: ['12:00', '20:00'], 1: ['11:00', '21:00'], 2: ['11:00', '21:00'], 3: ['11:00', '21:00'], 4: ['11:00', '21:00'], 5: ['11:00', '22:00'], 6: ['12:00', '22:00'] },
      exceptions: {},
      foodoraUrl: null,
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Odengatan+38+Stockholm',
    },
  ],
};

export const categories = [
  { id: 'burgers', name: 'Burgare', short: 'Burgare' },
  { id: 'sides', name: 'Sides & dips', short: 'Sides & dips' },
  { id: 'drinks', name: 'Shakes & dryck', short: 'Shakes & dryck' },
];

export const fulfillmentMethods = [
  { id: 'pickup', name: 'Hämta själv', shortName: 'Takeaway', heading: 'NÄR VILL DU HÄMTA?', timeLabel: 'Upphämtningstid', receiptLabel: 'Upphämtning', paymentLabel: 'Betala vid hämtning', note: 'Din beställning packas för att tas med. Uppge ordernumret när du hämtar.' },
  { id: 'dine_in', name: 'Äta här', shortName: 'Äta här', heading: 'NÄR VILL DU ÄTA?', timeLabel: 'Ankomst & servering', receiptLabel: 'Ankomst & servering', paymentLabel: 'Betala i restaurangen', note: 'Du äter på restaurangen och hämtar maten vid disken. Beställningen reserverar inget bord.' },
];

export const extras = [
  { id: 'cheese', name: 'Extra cheddar', price: 1200, allergens: ['mjölk'] },
  { id: 'bacon', name: 'Krispigt bacon', price: 2000, allergens: [] },
  { id: 'dip', name: 'House dip', price: 1500, allergens: ['ägg', 'senap'] },
];

export const meal = {
  price: 4500,
  name: 'Gör den till en meny',
  description: 'Krispiga pommes + valfri läsk 33 cl',
  drinks: ['Coca-Cola', 'Coca-Cola Zero', 'Fanta', 'Sprite', 'Bubbelvatten'],
};

export const menu = [
  {
    id: 'original', category: 'burgers', name: 'The Original', price: 11900,
    description: 'Dubbel smash, smält cheddar, pickles, silverlök och vår alldeles egna house dressing. En klassiker av en anledning.',
    shortDescription: 'Dubbel smash, cheddar, pickles & house dressing.',
    image: 'assets/original.jpg', imageAlt: 'Dubbel cheeseburgare med cheddar och sallad',
    badge: 'FAVORITEN', vegetarian: false, allergens: ['gluten', 'mjölk', 'ägg', 'senap'],
    removable: ['Pickles', 'Silverlök', 'House dressing'], extras: ['cheese', 'bacon', 'dip'], meal: true,
  },
  {
    id: 'cheesy', category: 'burgers', name: 'Cheesy Business', price: 13900,
    description: 'Dubbel smash med extra mycket cheddar, karamelliserad lök och tryffelmajonnäs. För dig som aldrig säger nej till ost.',
    shortDescription: 'Extra cheddar, karamelliserad lök & tryffelmajo.',
    image: 'assets/hero-closeup.jpg', imageAlt: 'Närbild av smashburgare med rikligt med smält cheddar',
    badge: 'SAY CHEESE', vegetarian: false, allergens: ['gluten', 'mjölk', 'ägg'],
    removable: ['Karamelliserad lök', 'Tryffelmajonnäs'], extras: ['cheese', 'bacon', 'dip'], meal: true,
  },
  {
    id: 'hot', category: 'burgers', name: 'Hot Little Thing', price: 13900,
    description: 'Dubbel smash, cheddar, jalapeños, krispig lök och rökig chipotlemajo. Precis lagom mycket attityd.',
    shortDescription: 'Jalapeños, krispig lök & rökig chipotlemajo.',
    image: 'assets/hot.jpg', imageAlt: 'Saftig burgare med ost, grönsaker och rostat bröd',
    badge: 'LITE HETARE', vegetarian: false, allergens: ['gluten', 'mjölk', 'ägg', 'senap'],
    removable: ['Jalapeños', 'Krispig lök', 'Chipotlemajo'], extras: ['cheese', 'bacon', 'dip'], meal: true,
  },
  {
    id: 'green', category: 'burgers', name: 'Green Machine', price: 12900,
    description: 'Krispig halloumi, avokadokräm, picklad rödlök, sallad och grön örtmajonnäs. Grön, krispig och full av smak.',
    shortDescription: 'Halloumi, avokadokräm, picklad rödlök & örtmajo.',
    image: 'assets/green.jpg', imageAlt: 'Vegetarisk burgare med grönsaker i gyllene bröd',
    badge: 'HELT VEGGO', vegetarian: true, allergens: ['gluten', 'mjölk', 'ägg'],
    removable: ['Picklad rödlök', 'Sallad', 'Örtmajonnäs'], extras: ['cheese', 'dip'], meal: true,
  },
  {
    id: 'fries', category: 'sides', name: 'Skin-on Fries', price: 3900,
    description: 'Gyllene, krispiga pommes med skalet kvar. Saltade precis som vi gillar dem.',
    shortDescription: 'Krispiga pommes. Rätt mängd salt.',
    image: 'assets/fries.jpg', imageAlt: 'Gyllene pommes frites med havssalt',
    badge: 'KRISPIGT', vegetarian: true, allergens: [], removable: [], extras: ['dip'], meal: false,
  },
  {
    id: 'loaded-fries', category: 'sides', name: 'Dirty Fries', price: 6900,
    description: 'Våra krispiga pommes med varm cheddarsås, picklad jalapeño, krispig lök och house dressing.',
    shortDescription: 'Cheddarsås, jalapeños & krispig lök.',
    image: 'assets/fries.jpg', imageAlt: 'Krispiga pommes som bas till Dirty Fries',
    badge: 'EXTRA ALLT', vegetarian: true, allergens: ['mjölk', 'ägg', 'gluten', 'senap'], removable: ['Jalapeños', 'Krispig lök'], extras: ['bacon', 'dip'], meal: false,
  },
  {
    id: 'house-dip', category: 'sides', name: 'House Dip', price: 1500,
    description: 'Vår krämiga signaturdressing med pickles, senap och en liten syrlig kick.',
    shortDescription: 'En liten burk stor burgarkärlek.',
    image: 'assets/dip.svg', imageAlt: 'Illustration av vår gröna dipburk',
    vegetarian: true, allergens: ['ägg', 'senap'], removable: [], extras: [], meal: false,
  },
  {
    id: 'shake', category: 'drinks', name: 'Vanilla Dream', price: 5900,
    description: 'En tjock milkshake på vaniljglass, toppad med vispgrädde. 40 cl ren och skär nostalgi.',
    shortDescription: 'Vaniljglass, mjölk & vispad grädde. 40 cl.',
    image: 'assets/shake.jpg', imageAlt: 'Krämig milkshake i ett högt glas',
    badge: 'SWEET STUFF', vegetarian: true, allergens: ['mjölk'], removable: [], extras: [], meal: false,
  },
  ...['Coca-Cola', 'Coca-Cola Zero', 'Fanta', 'Bubbelvatten'].map((name, i) => ({
    id: `drink-${i}`, category: 'drinks', name, price: 2500,
    description: 'Serveras väl kyld. 33 cl.', shortDescription: 'Iskall. 33 cl.',
    image: 'assets/drink.svg', imageAlt: 'Illustration av en kall dryck',
    vegetarian: true, allergens: [], removable: [], extras: [], meal: false,
  })),
];
