// Kolejność kategorii ~ trasa po sklepie.
export const CATS: string[] = ["Warzywa i owoce", "Pieczywo", "Nabiał", "Mięso i ryby", "Produkty suche",
  "Mrożonki", "Napoje", "Chemia i higiena", "Inne"];

// Wzorce dopasowują POCZĄTEK słowa (JS-owe \b nie rozumie polskich liter).
// Kolejność ma znaczenie: bardziej szczegółowe reguły są wyżej
// (np. "sok pomarańczowy" -> Napoje, "sos pomidorowy" -> Produkty suche).
const w = (s: string) => new RegExp("(?:^|[\\s(\\-])(?:" + s + ")", "i");
const RULES: [string, RegExp][] = [
  ["Napoje", w("wod[aęy]|sok|soki|piwo|wino|napój|napoje|cola|lemoniad|energetyk")],
  ["Chemia i higiena", w("papier|mydł|szampon|proszek do (?:prania|zmywarki)|płyn|pasta do|gąbk|worki|tabletki|ręcznik|serwet|chusteczk|dezodorant|szczotk|detergent|kapsułk|odświeżacz")],
  ["Produkty suche", w("sos|konserw|puszk|puszc|przecier|koncentrat|ketchup|majonez|musztard|passata|do pieczenia|bulion|kostk|drożdże|drożdży")],
  ["Mrożonki", w("mrożon|lody|pizza|frytki")],
  ["Pieczywo", w("chleb|bułk|bagiet|rogal|drożdżówk|tost|chałk|pączk")],
  ["Mięso i ryby", w("kurczak|mięs|szynk|kiełbas|wędlin|łosoś|ryb|indyk|mielon|boczek|parówk|schab|karkówk|wołowin|wieprzow|krewetk|tuńczyk|serdelk")],
  ["Nabiał", w("mleko|mlek|ser|jogurt|masło|śmietan|jaj|twaróg|twarożek|kefir|margaryn|maślank|skyr|mozzarell|feta|parmezan")],
  ["Warzywa i owoce", w("pomidor|ogór|cebul|czosnek|ziemniak|marchew|sałat|jabłk|banan|cytryn|papryk|brokuł|owoc|warzyw|pietrusz|szpinak|awokado|gruszk|pomarańcz|mandarynk|winogron|truskawk|malin|borówk|kapust|seler|dyni|cukini|bakłażan|rzodkiew|kalafior|grzyb|pieczark|śliwk|brzoskwin|arbuz|kiwi|koper|natka|szczypiork|burak|batat")],
  ["Produkty suche", w("makaron|ryż|mąk|cukier|kasza|płatki|olej|oliw|sól|przypraw|herbat|kaw|orzech|bakalie|rodzynk|miód|dżem|nutell|czekolad|chips|ciastk|baton|fasol|soczewic|ciecierzyc|musli|owsian|cynamon|pieprz|ocet")],
];
export const guess = (n: string) => RULES.find(([, r]) => r.test(n.trim()))?.[0] ?? "Inne";
// Klucz do mapy poprawek w settings/shopping (bez znaków specjalnych w nazwie pola).
export const catKey = (n: string) => n.trim().toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "_");
