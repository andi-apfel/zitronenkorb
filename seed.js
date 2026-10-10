// Startausstattung: Kategorien in typischer Laufweg-Reihenfolge und ein vegetarischer Grundfundus.
// Diese Einträge sind auf beiden Handys gleich (feste IDs) und werden nur übernommen,
// solange es dazu noch keinen eigenen Stand gibt. Änderungen und Löschungen werden ganz normal abgeglichen.
window.ZK_UNITS = ['Stk', 'g', 'kg', 'ml', 'l', 'Pck', 'Bund', 'Dose', 'Glas', 'Flasche', 'Tube', 'Becher', 'Schale', 'Topf', 'Rolle'];

window.ZK_SEED_CATS = [
  ['c-obst', 'Obst & Gemüse'],
  ['c-brot', 'Brot & Backwaren'],
  ['c-kuehl', 'Kühlregal'],
  ['c-veggie', 'Tofu & Fleischersatz'],
  ['c-nudeln', 'Nudeln, Reis & Getreide'],
  ['c-konserven', 'Konserven & Gläser'],
  ['c-backen', 'Backen'],
  ['c-gewuerze', 'Öl, Essig & Gewürze'],
  ['c-fruehstueck', 'Frühstück & Aufstriche'],
  ['c-snacks', 'Süßes & Snacks'],
  ['c-getraenke', 'Getränke'],
  ['c-tk', 'Tiefkühl'],
  ['c-drogerie', 'Drogerie'],
  ['c-haushalt', 'Haushalt'],
  ['c-sonst', 'Besorgungen & Sonstiges'],
];

// [Name, Kategorie, Standardmenge, Einheit]
window.ZK_SEED_ITEMS = [
  ['Zitronen', 'c-obst', 3, 'Stk'], ['Äpfel', 'c-obst', 6, 'Stk'], ['Bananen', 'c-obst', 5, 'Stk'],
  ['Orangen', 'c-obst', 4, 'Stk'], ['Beeren', 'c-obst', 1, 'Schale'], ['Tomaten', 'c-obst', 500, 'g'],
  ['Gurke', 'c-obst', 1, 'Stk'], ['Paprika', 'c-obst', 2, 'Stk'], ['Zucchini', 'c-obst', 1, 'Stk'],
  ['Karotten', 'c-obst', 1, 'kg'], ['Kartoffeln', 'c-obst', 2, 'kg'], ['Zwiebeln', 'c-obst', 1, 'kg'],
  ['Knoblauch', 'c-obst', 1, 'Stk'], ['Ingwer', 'c-obst', 1, 'Stk'], ['Salat', 'c-obst', 1, 'Stk'],
  ['Spinat', 'c-obst', 250, 'g'], ['Brokkoli', 'c-obst', 1, 'Stk'], ['Champignons', 'c-obst', 250, 'g'],
  ['Avocado', 'c-obst', 2, 'Stk'], ['Frühlingszwiebeln', 'c-obst', 1, 'Bund'], ['Petersilie', 'c-obst', 1, 'Bund'],
  ['Basilikum', 'c-obst', 1, 'Topf'], ['Süßkartoffeln', 'c-obst', 500, 'g'],

  ['Brot', 'c-brot', 1, 'Stk'], ['Brötchen', 'c-brot', 4, 'Stk'], ['Toastbrot', 'c-brot', 1, 'Pck'], ['Wraps', 'c-brot', 1, 'Pck'],

  ['Milch', 'c-kuehl', 1, 'l'], ['Hafermilch', 'c-kuehl', 1, 'l'], ['Butter', 'c-kuehl', 250, 'g'], ['Eier', 'c-kuehl', 10, 'Stk'],
  ['Joghurt', 'c-kuehl', 500, 'g'], ['Quark', 'c-kuehl', 500, 'g'], ['Sahne', 'c-kuehl', 200, 'ml'],
  ['Schmand', 'c-kuehl', 200, 'g'], ['Frischkäse', 'c-kuehl', 200, 'g'], ['Käse in Scheiben', 'c-kuehl', 1, 'Pck'],
  ['Parmesan', 'c-kuehl', 100, 'g'], ['Mozzarella', 'c-kuehl', 2, 'Stk'], ['Feta', 'c-kuehl', 200, 'g'],
  ['Halloumi', 'c-kuehl', 1, 'Pck'], ['Gnocchi', 'c-kuehl', 1, 'Pck'],

  ['Tofu', 'c-veggie', 400, 'g'], ['Räuchertofu', 'c-veggie', 200, 'g'], ['Veggie-Hack', 'c-veggie', 1, 'Pck'], ['Tempeh', 'c-veggie', 1, 'Pck'],

  ['Spaghetti', 'c-nudeln', 500, 'g'], ['Penne', 'c-nudeln', 500, 'g'], ['Reis', 'c-nudeln', 1, 'kg'],
  ['Couscous', 'c-nudeln', 500, 'g'], ['Bulgur', 'c-nudeln', 500, 'g'], ['Rote Linsen', 'c-nudeln', 500, 'g'],

  ['Passierte Tomaten', 'c-konserven', 500, 'g'], ['Gehackte Tomaten', 'c-konserven', 1, 'Dose'],
  ['Kichererbsen', 'c-konserven', 1, 'Dose'], ['Kidneybohnen', 'c-konserven', 1, 'Dose'], ['Mais', 'c-konserven', 1, 'Dose'],
  ['Kokosmilch', 'c-konserven', 1, 'Dose'], ['Tomatenmark', 'c-konserven', 1, 'Tube'], ['Gemüsebrühe', 'c-konserven', 1, 'Glas'],
  ['Pesto', 'c-konserven', 1, 'Glas'], ['Oliven', 'c-konserven', 1, 'Glas'],

  ['Mehl', 'c-backen', 1, 'kg'], ['Zucker', 'c-backen', 1, 'kg'], ['Backpulver', 'c-backen', 1, 'Pck'],
  ['Vanillezucker', 'c-backen', 1, 'Pck'], ['Trockenhefe', 'c-backen', 1, 'Pck'], ['Speisestärke', 'c-backen', 1, 'Pck'],

  ['Olivenöl', 'c-gewuerze', 1, 'Flasche'], ['Rapsöl', 'c-gewuerze', 1, 'Flasche'], ['Balsamico', 'c-gewuerze', 1, 'Flasche'],
  ['Salz', 'c-gewuerze', 1, 'Pck'], ['Pfeffer', 'c-gewuerze', 1, 'Pck'], ['Paprikapulver', 'c-gewuerze', 1, 'Pck'],
  ['Currypulver', 'c-gewuerze', 1, 'Pck'], ['Sojasauce', 'c-gewuerze', 1, 'Flasche'], ['Senf', 'c-gewuerze', 1, 'Tube'],
  ['Ketchup', 'c-gewuerze', 1, 'Flasche'],

  ['Haferflocken', 'c-fruehstueck', 500, 'g'], ['Müsli', 'c-fruehstueck', 1, 'Pck'], ['Marmelade', 'c-fruehstueck', 1, 'Glas'],
  ['Honig', 'c-fruehstueck', 1, 'Glas'], ['Erdnussbutter', 'c-fruehstueck', 1, 'Glas'], ['Kaffee', 'c-fruehstueck', 500, 'g'],
  ['Tee', 'c-fruehstueck', 1, 'Pck'],

  ['Schokolade', 'c-snacks', 1, 'Stk'], ['Chips', 'c-snacks', 1, 'Pck'], ['Nüsse', 'c-snacks', 200, 'g'], ['Kekse', 'c-snacks', 1, 'Pck'],

  ['Mineralwasser', 'c-getraenke', 6, 'Flasche'], ['Orangensaft', 'c-getraenke', 1, 'l'], ['Bier', 'c-getraenke', 6, 'Flasche'],
  ['Wein', 'c-getraenke', 1, 'Flasche'],

  ['TK-Erbsen', 'c-tk', 1, 'Pck'], ['TK-Spinat', 'c-tk', 1, 'Pck'], ['TK-Beeren', 'c-tk', 1, 'Pck'],
  ['Pizza', 'c-tk', 2, 'Stk'], ['Pommes', 'c-tk', 1, 'Pck'], ['Eis', 'c-tk', 1, 'Pck'],

  ['Zahnpasta', 'c-drogerie', 1, 'Tube'], ['Duschgel', 'c-drogerie', 1, 'Flasche'], ['Shampoo', 'c-drogerie', 1, 'Flasche'],
  ['Deo', 'c-drogerie', 1, 'Stk'], ['Toilettenpapier', 'c-drogerie', 1, 'Pck'], ['Taschentücher', 'c-drogerie', 1, 'Pck'],
  ['Wattepads', 'c-drogerie', 1, 'Pck'],

  ['Spülmittel', 'c-haushalt', 1, 'Flasche'], ['Spülmaschinentabs', 'c-haushalt', 1, 'Pck'], ['Waschmittel', 'c-haushalt', 1, 'Pck'],
  ['Müllbeutel', 'c-haushalt', 1, 'Rolle'], ['Küchenrolle', 'c-haushalt', 1, 'Pck'], ['Alufolie', 'c-haushalt', 1, 'Rolle'],
  ['Backpapier', 'c-haushalt', 1, 'Rolle'], ['Schwämme', 'c-haushalt', 1, 'Pck'], ['Batterien', 'c-haushalt', 1, 'Pck'],

  ['Apotheke', 'c-sonst', 1, 'Stk'], ['Paket abholen', 'c-sonst', 1, 'Stk'],
];

// Stichwörter, mit denen neue Artikel automatisch einer Kategorie zugeordnet werden
window.ZK_CAT_HINTS = {
  'c-obst': 'apfel aepfel birne banane zitrone limette orange mandarine beere erdbeere himbeere heidelbeere traube kiwi mango ananas melone pfirsich pflaume tomate gurke paprika zucchini aubergine karotte moehre moehren kartoffel zwiebel knoblauch ingwer salat rucola spinat brokkoli blumenkohl kohl lauch porree sellerie fenchel pilz champignon avocado kraeuter petersilie basilikum schnittlauch koriander minze dill radieschen rote bete kuerbis spargel mais kolben suesskartoffel lauchzwiebel fruehlingszwiebel',
  'c-brot': 'brot broetchen toast wrap baguette brezel croissant semmel tortilla fladenbrot knaeckebrot',
  'c-kuehl': 'milch butter ei eier joghurt quark sahne schmand creme fraiche frischkaese kaese gouda emmentaler parmesan mozzarella feta halloumi burrata ricotta skyr kefir buttermilch margarine gnocchi tortellini maultaschen blaetterteig pizzateig',
  'c-veggie': 'tofu tempeh seitan veggie vegan vegetarisch hack schnitzel nuggets soja falafel',
  'c-nudeln': 'nudel spaghetti penne fusilli farfalle lasagne reis risotto couscous bulgur quinoa linsen hirse polenta graupen',
  'c-konserven': 'dose konserve passiert tomatenmark kichererbsen bohnen kidney mais kokosmilch bruehe fond pesto oliven kapern gurken glas sauce',
  'c-backen': 'mehl zucker backpulver hefe vanille staerke kakao puderzucker natron gelatine agar',
  'c-gewuerze': 'oel olivenoel essig balsamico salz pfeffer gewuerz paprikapulver curry kreuzkuemmel zimt muskat oregano thymian chili sojasauce senf ketchup mayo mayonnaise sriracha',
  'c-fruehstueck': 'haferflocken muesli cornflakes marmelade konfituere honig nutella aufstrich erdnussbutter kaffee tee kakao sirup',
  'c-snacks': 'schokolade chips nuesse kekse gummibaerchen riegel cracker salzstangen popcorn suessigkeit',
  'c-getraenke': 'wasser sprudel saft schorle limo cola bier wein sekt',
  'c-tk': 'tk tiefkuehl gefroren pizza pommes eis erbsen',
  'c-drogerie': 'zahnpasta zahnbuerste duschgel shampoo spuelung deo seife creme rasierer toilettenpapier klopapier taschentuecher watte pflaster tampons binden sonnencreme',
  'c-haushalt': 'spuelmittel tabs waschmittel weichspueler muell beutel kuechenrolle alufolie frischhaltefolie backpapier schwamm lappen batterie gluehbirne kerzen reiniger',
  'c-sonst': 'apotheke post paket reinigung schuster geschenk',
};
