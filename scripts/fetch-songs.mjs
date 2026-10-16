// Builds songs.json from the xeno-canto API (v3). Run by the "Update bird songs" workflow.
// The API key comes from the XC_KEY repository secret and never ends up in the site.
import { readFileSync, writeFileSync } from "node:fs";

const KEY = process.env.XC_KEY;
if (!KEY) { console.error("Missing XC_KEY secret"); process.exit(1); }

const html = readFileSync("index.html", "utf8");
const species = [...html.matchAll(/s:"([A-Z][a-z]+) ([a-z]+)"/g)].map(m => [m[1], m[2]]);

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function search(query) {
  const url = "https://xeno-canto.org/api/3/recordings?per_page=100&query=" + encodeURIComponent(query) + "&key=" + KEY;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${query}`);
  const j = await res.json();
  return j.recordings || [];
}
const score = r => (r.q === "A" ? 0 : r.q === "B" ? 10 : 20) + (parseFloat(r.length) > 60 ? 5 : 0);
const pick = (recs, re) => recs.filter(r => re.test(r.type || "")).sort((a, b) => score(a) - score(b))[0];

const out = {};
for (const [gen, sp] of species) {
  const sci = `${gen} ${sp}`;
  let recs = [];
  try {
    recs = await search(`gen:${gen} sp:${sp} cnt:"United States" q:">C"`);
    if (recs.length < 3) recs = recs.concat(await search(`gen:${gen} sp:${sp} q:">C"`));
  } catch (e) { console.warn("skip", sci, e.message); }
  const keep = r => r && {
    id: r.id, type: r.type, file: r.file, len: r.length,
    who: r.rec, lic: r.lic, where: [r.loc, r.cnt].filter(Boolean).join(", ")
  };
  const song = pick(recs, /song/i), call = pick(recs.filter(r => r !== song), /call/i);
  out[sci] = { song: keep(song), call: keep(call) };
  console.log(sci, song ? "song " + song.id : "-", call ? "call " + call.id : "-");
  await sleep(1100);
}
writeFileSync("songs.json", JSON.stringify({ updated: new Date().toISOString().slice(0, 10), birds: out }, null, 1));
