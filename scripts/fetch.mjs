// Hämtar utlysningar från flera källor, filtrerar på fasta ämnen och skriver data/calls.json.
// Node 20+, inga beroenden. Varje källa är isolerad: om en faller behålls övriga.
import { readFile, writeFile } from "node:fs/promises";
import { matchTopics } from "./keywords.mjs";

const OUT = new URL("../data/calls.json", import.meta.url);
const TODAY = new Date().toISOString().slice(0, 10);
const UA = { "User-Agent": "grants-pwa/1.0 (personal use)", Accept: "application/json" };

const clean = (s) => (s ?? "").toString().replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const day = (s) => {
  if (!s) return null;
  const d = String(s).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < "1990-01-02") return null; // 1900-01-01 = "ej satt"
  return d;
};
const short = (s, n = 500) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

async function getJson(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { ...UA, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`HTTP ${r.status} för ${url}`);
  return r.json();
}

// Gemensamt: filtrera bort passerade, matcha ämnen
function finish(c) {
  if (c.deadline && c.deadline < TODAY && !c.rolling) return null;
  const tags = matchTopics(`${c.title} ${c.summary} ${c.extra || ""}`);
  if (!tags.length) return null;
  delete c.extra;
  c.summary = short(c.summary);
  c.tags = tags;
  return c;
}

/* ---------- Energimyndigheten + alla källor på GDP-datamodellen ---------- */
export function normalizeGdp(json, source, fallbackUrl) {
  const out = [];
  for (const u of json?.utlysningar ?? []) {
    const prog = (u.program ?? []).map((p) => p.titel).filter(Boolean).join("; ");
    const link = u.lank || u.publiceringsplatser?.find((p) => p.webbadress)?.webbadress || fallbackUrl;
    const status = clean(u.status);
    const c = finish({
      id: `${source}:${u.finansiarOrganisationsnummer || ""}:${u.diarienummer}`,
      source: u.finansiarNamn && source === "GDP" ? u.finansiarNamn : source,
      title: clean(u.titel),
      summary: clean(u.beskrivning) || clean(prog),
      extra: `${prog} ${clean(u.titelEng)} ${clean(u.beskrivningEng)}`,
      opens: day(u.oppningsdatum),
      deadline: day(u.stangningsdatum),
      rolling: false,
      status: /avslut/i.test(status) ? "closed" : "open",
      budget: u.budgetBelopp ? `${Math.round(u.budgetBelopp).toLocaleString("sv-SE")} ${u.budgetValuta || ""}`.trim() : null,
      url: link,
    });
    if (c && c.status !== "closed") out.push(c);
  }
  return out;
}
async function energimyndigheten() {
  const url = "https://www.energimyndigheten.se/49824d/globalassets/sharepoint-dokument/gdp/dokument/utlysningar.json";
  return normalizeGdp(await getJson(url), "Energimyndigheten", "https://www.energimyndigheten.se/utlysningar/");
}

/* ---------- Vinnova ---------- */
const firstUrl = (list) => {
  for (const it of list ?? []) {
    if (typeof it === "string" && /^https?:/.test(it)) return it;
    for (const v of Object.values(it ?? {})) if (typeof v === "string" && /^https?:\/\//.test(v)) return v;
  }
  return null;
};
export function normalizeVinnova(rounds, calls) {
  const parent = new Map((calls ?? []).map((c) => [c.Diarienummer, c]));
  const out = [];
  for (const r of rounds ?? []) {
    if (r.Publik !== 1) continue;
    const rolling = r.DagligAvlasning === 1;
    const p = parent.get(r.DiarienummerUtlysning);
    const c = finish({
      id: `Vinnova:${r.Diarienummer}`,
      source: "Vinnova",
      title: clean(r.Titel) || clean(p?.Titel),
      summary: clean(r.Beskrivning) || clean(p?.Beskrivning),
      extra: `${clean(p?.Titel)} ${clean(p?.Beskrivning)} ${clean(r.TitelEngelska)} ${clean(r.BeskrivningEngelska)}`,
      opens: day(r.Oppningsdatum),
      deadline: day(r.Stangningsdatum),
      rolling,
      status: "open",
      budget: null,
      url: firstUrl(r.LankLista) || firstUrl(p?.LankLista) || "https://www.vinnova.se/utlysningar/",
    });
    if (c) out.push(c);
  }
  return out;
}
async function vinnova() {
  // Datumet i URL:en är "ändrat sedan" – ett tidigt datum ger allt, vi filtrerar själva.
  const [rounds, calls] = await Promise.all([
    getJson("https://data.vinnova.se/api/ansokningsomgangar/2000-01-01"),
    getJson("https://data.vinnova.se/api/utlysningar/2000-01-01"),
  ]);
  return normalizeVinnova(rounds, calls);
}

/* ---------- EU: Funding & Tenders (SEDIA) ---------- */
const first = (v) => (Array.isArray(v) ? v[0] : v);
export function normalizeEu(json) {
  const out = [];
  for (const r of json?.results ?? []) {
    const m = r.metadata ?? {};
    const id = first(m.identifier) || r.reference;
    if (!id) continue;
    const st = String(first(m.status) ?? "");
    const c = finish({
      id: `EU:${id}`,
      source: "EU",
      title: clean(first(m.title) || r.title || r.summary),
      summary: clean(first(m.descriptionByte) || first(m.description) || r.content || ""),
      extra: `${clean(first(m.callTitle))} ${clean(first(m.tags))} ${(m.keywords || []).join(" ")}`,
      opens: day(first(m.startDate)),
      deadline: day(first(m.deadlineDate)),
      rolling: false,
      status: st === "31094501" ? "forthcoming" : "open",
      budget: null,
      url: `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${encodeURIComponent(id)}`,
    });
    if (c) out.push(c);
  }
  return out;
}
async function eu() {
  const base = "https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=***&pageSize=100&pageNumber=";
  const query = { bool: { must: [{ terms: { type: ["1", "2", "8"] } }, { terms: { status: ["31094501", "31094502"] } }] } };
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const form = new FormData();
    form.append("query", new Blob([JSON.stringify(query)], { type: "application/json" }));
    form.append("languages", new Blob([JSON.stringify(["en"])], { type: "application/json" }));
    form.append("sort", new Blob([JSON.stringify({ order: "DESC", field: "startDate" })], { type: "application/json" }));
    const json = await getJson(base + page, { method: "POST", body: form });
    const n = json?.results?.length ?? 0;
    all.push(...normalizeEu(json));
    if (n < 100) break;
  }
  return all;
}

/* ---------- GDP Hub (Formas, Forte, Vetenskapsrådet …) – valfritt ---------- */
// Kräver Actions-secret GDP_API_KEY och GDP_ENDPOINTS = JSON, t.ex.
// [{"name":"Formas","url":"https://…/utlysningar"},{"name":"Forte","url":"…"},{"name":"Vetenskapsrådet","url":"…"}]
function gdpHubSources() {
  const key = process.env.GDP_API_KEY;
  if (!key || !process.env.GDP_ENDPOINTS) return [];
  let list;
  try { list = JSON.parse(process.env.GDP_ENDPOINTS); } catch { return [{ name: "GDP Hub", fn: async () => { throw new Error("GDP_ENDPOINTS är inte giltig JSON"); } }]; }
  return list.map(({ name, url }) => ({
    name,
    fn: async () => normalizeGdp(await getJson(url, { headers: { "Ocp-Apim-Subscription-Key": key } }), name, url),
  }));
}

/* ---------- Körning ---------- */
async function main() {
  const sources = [
    { name: "Energimyndigheten", fn: energimyndigheten },
    { name: "Vinnova", fn: vinnova },
    { name: "EU", fn: eu },
    ...gdpHubSources(),
  ];
  let prev = { calls: [], sources: {} };
  try { prev = JSON.parse(await readFile(OUT, "utf8")); } catch {}

  const status = {};
  let calls = [];
  for (const s of sources) {
    const fetchedAt = new Date().toISOString();
    try {
      const items = await s.fn();
      calls.push(...items);
      status[s.name] = { ok: true, count: items.length, fetchedAt };
      console.log(`✔ ${s.name}: ${items.length} relevanta`);
    } catch (e) {
      // Behåll senaste lyckade data för källan som föll
      const kept = (prev.calls ?? []).filter((c) => c.source === s.name && (!c.deadline || c.deadline >= TODAY || c.rolling));
      calls.push(...kept);
      status[s.name] = { ok: false, count: kept.length, error: String(e.message || e).slice(0, 300), fetchedAt, lastGood: prev.sources?.[s.name]?.lastGood ?? prev.sources?.[s.name]?.fetchedAt ?? null };
      console.error(`✘ ${s.name}: ${e.message} (behåller ${kept.length} tidigare)`);
    }
  }
  const seen = new Set();
  calls = calls.filter((c) => !seen.has(c.id) && seen.add(c.id));
  const prevIds = new Set((prev.calls ?? []).map((c) => c.id));
  const firstRun = !prev.updatedAt;
  for (const c of calls) c.firstSeen = prevIds.has(c.id) ? (prev.calls.find((p) => p.id === c.id)?.firstSeen ?? TODAY) : TODAY;
  calls.sort((a, b) => (a.deadline ?? "9999") < (b.deadline ?? "9999") ? -1 : 1);

  const out = { updatedAt: new Date().toISOString(), sources: status, calls };
  const text = JSON.stringify(out, null, 1);
  // Skriv bara om innehållet ändrats (utöver tidsstämpeln) så commit-historiken hålls ren
  const strip = (j) => JSON.stringify({ s: j.sources && Object.fromEntries(Object.entries(j.sources).map(([k, v]) => [k, { ok: v.ok, count: v.count, error: v.error }])), c: j.calls });
  if (firstRun || strip(out) !== strip(prev)) await writeFile(OUT, text);
  else console.log("Inga ändringar.");
  if (Object.values(status).every((s) => !s.ok)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
