// Fasta ämnesfilter – bygger in vad appen ska visa. Redigera här och kör om workflowet.
// Varje grupp: namn (visas som etikett i appen) + sökord. Sökorden matchas från ordstart,
// så "bränsl" träffar bränsle, bränslen, bränslecell... Skiftlägesokänsligt.
// Ett ord som slutar med $ måste matcha hela ordet (för korta ord som "kol").
export const TOPICS = [
  { name: "Energi", words: ["energi", "energy", "elektrifier", "electrification", "kraftvärme", "fjärrvärme", "district heating", "energy efficien"] },
  { name: "Hög temperatur", words: ["högtemperatur", "höga temperatur", "hög temperatur", "high temperature", "high-temperature", "high temp", "ugn", "furnace", "kiln", "smältning", "smelt", "melting"] },
  { name: "Plasma", words: ["plasma"] },
  { name: "Vätgas", words: ["vätgas", "väte", "vätet", "hydrogen", "h2$", "elektrolys", "electroly", "ammoniak", "ammonia"] },
  { name: "Bränslen", words: ["bränsl", "fuel", "biogas", "biodrivmedel", "biofuel", "e-fuel", "elektrobränsle", "drivmedel", "förbränning", "combustion", "burner", "brännare"] },
  { name: "Biomassa & sameldning", words: ["biomassa", "biomass", "sameldning", "co-firing", "cofiring", "co-combustion", "pellets", "biokol", "biochar", "torrefi", "kol$", "kolet$", "kolförbränning", "kolkraft", "coal"] },
  { name: "Utsläpp", words: ["utsläpp", "emission", "koldioxid", "co2", "ccs$", "ccus$", "carbon capture", "koldioxidavskiljning", "bio-ccs", "beccs", "fossilfri", "fossil-free", "decarbon", "avkarbon", "net-zero", "net zero", "nollutsläpp"] },
  { name: "Industriprocesser", words: ["industriell process", "industriella process", "industrial process", "processindustri", "process industr", "energiintensiv", "energy-intensive", "energy intensive", "tung industri", "heavy industry", "stålindustri", "stål", "steel", "cement", "kalkindustri", "glasindustri", "pulp", "massa- och papper"] },
  { name: "Värme", words: ["värmeöverför", "värmetransport", "värmeväx", "värmelager", "värmepump", "heat transfer", "heat exchang", "heat pump", "thermal", "termisk", "spillvärme", "waste heat", "värmeåtervinn", "heat recovery"] },
];

function toRegex(w) {
  const exact = w.endsWith("$");
  const base = (exact ? w.slice(0, -1) : w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${base}${exact ? "(?![\\p{L}\\p{N}])" : ""}`, "iu");
}
const COMPILED = TOPICS.map(t => ({ name: t.name, res: t.words.map(toRegex) }));

// Returnerar lista med matchande ämnesnamn (tom = ingen träff → utlysningen slängs)
export function matchTopics(text) {
  if (!text) return [];
  return COMPILED.filter(t => t.res.some(r => r.test(text))).map(t => t.name);
}
