import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

// ---- Small UI bits ----
const Section = ({ title, right, children }) => (
  <div className="w-full">
    <div className="flex items-center justify-between mb-2">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {right}
    </div>
    <div className="rounded-2xl border border-gray-200 p-3 shadow-sm bg-white">{children}</div>
  </div>
);

const Badge = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-900 border border-gray-200">{children}</span>
);

const Stat = ({ label, value }) => (
  <div className="flex flex-col min-w-[4.5rem] items-end">
    <span className="text-xs text-gray-500">{label}</span>
    <span className="text-sm font-semibold tabular-nums">{value}</span>
  </div>
);

const Row = ({ icon, title, subtitle, right }) => (
  <div className="flex items-center justify-between rounded-xl border p-3 gap-3">
    <div className="flex items-center gap-3 min-w-0">
      {icon}
      <div className="min-w-0">
        <div className="font-medium truncate pr-2">{title}</div>
        {subtitle ? <div className="text-xs text-gray-500 truncate">{subtitle}</div> : null}
      </div>
    </div>
    <div className="flex items-center gap-4">{right}</div>
  </div>
);

// ---- Helpers ----
const CD_BASE = "https://raw.communitydragon.org/latest";
const ITEMS_JSON = `${CD_BASE}/plugins/rcp-be-lol-game-data/global/default/v1/items.json`;
const ARENA_JSON = `${CD_BASE}/cdragon/arena/en_us.json`;

function parseCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data || []),
      error: (err) => reject(err),
    });
  });
}

function fmtPct(x) {
  const n = typeof x === "string" ? parseFloat(x) : (x ?? 0);
  if (!isFinite(n)) return "–";
  return (n * 100).toFixed(1) + "%";
}

function fmtInt(x) {
  const n = typeof x === "string" ? parseFloat(x) : (x ?? 0);
  if (!isFinite(n)) return "0";
  return Math.round(n).toString();
}

function normKey(str) {
  let s = (str || "").toString().trim().toLowerCase();
  let out = "";
  let lastSpace = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = ch.charCodeAt(0);
    const isNum = code >= 48 && code <= 57;
    const isLow = code >= 97 && code <= 122;
    if (isNum || isLow) {
      out += ch;
      lastSpace = false;
    } else {
      if (!lastSpace) { out += " "; lastSpace = true; }
    }
  }
  return out.trim();
}

function iconFromPath(path) {
  if (!path) return "";
  const raw = String(path).replace(/\\/g, "/").split(/[?#]/)[0];
  if (/^https?:\/\//i.test(raw)) return raw;

  const BASE = "https://raw.communitydragon.org/latest";

  // Helper: take everything AFTER the **last** '/assets/' (case-insensitive)
  const tailAfterLastAssets = (s) => {
    const i = s.toLowerCase().lastIndexOf("/assets/");
    if (i === -1) return null;
    return s.slice(i + "/assets/".length).replace(/^\/+/, "");
  };

  // Case: any path that already contains '/assets/...'
  const t1 = tailAfterLastAssets(raw);
  if (t1) {
    // ensure exactly one 'assets/' prefix, lowercase tail for plugins path
    return `${BASE}/plugins/rcp-be-lol-game-data/global/default/assets/${t1.toLowerCase()}`;
  }

  // Case: '/lol-game-data/...'
  const lgdIdx = raw.toLowerCase().indexOf("/lol-game-data/");
  if (lgdIdx !== -1) {
    const rest = raw.slice(lgdIdx + "/lol-game-data/".length).replace(/^\/+/, "");
    const t2 = tailAfterLastAssets("/" + rest) || rest; // try to find assets/ inside rest
    const clean = t2.replace(/^assets\//i, "");          // drop any leading 'assets/'
    return `${BASE}/plugins/rcp-be-lol-game-data/global/default/assets/${clean.toLowerCase()}`;
  }

  // Fallback: treat as relative; normalize to one 'assets/' prefix
  let rel = raw.replace(/^\/+/, "");
  rel = rel.replace(/^assets\//i, ""); // drop if already starts with assets/
  return `${BASE}/plugins/rcp-be-lol-game-data/global/default/assets/${rel.toLowerCase()}`;
}

function getItemIcon(name, itemMap) {
  if (!name || !itemMap) return "";
  // exact (our main path)
  const nk = normKey(name);
  if (itemMap.has(nk)) return itemMap.get(nk);

  // super-loose fallback: compare alnum-only strings
  const flat = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = flat(name);
  for (const [k, v] of itemMap.entries()) {
    if (flat(k) === target) return v;          // strict equal (no spaces/punc)
  }
  for (const [k, v] of itemMap.entries()) {
    const fk = flat(k);
    if (fk.includes(target) || target.includes(fk)) return v; // contains
  }
  return "";
}




// Simple fallback tile for missing icons
function PlaceholderIcon({ name }) {
  const letter = ((name || "?") + "").trim().charAt(0).toUpperCase();
  return (
    <div
      style={{
        width: 32,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        background: "#f3f4f6",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {letter}
    </div>
  );
}

function AugIcon({ tier = "silver", src, name }) {
  const bg =
    tier === "gold"
      ? "linear-gradient(180deg, #FEF3C7, #F59E0B)"
      : tier === "prismatic"
      ? "linear-gradient(135deg, #60A5FA, #A78BFA, #F472B6)"
      : "linear-gradient(180deg, #E5E7EB, #94A3B8)";

  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 6,
        padding: 2,
        background: bg,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.08)",
      }}
      title={name}
    >
      <CDImg src={src} name={name} plain size={28} />
    </div>
  );
}


function getAugIcon(name, augMap) {
  const nk = normKey(name);
  if (augMap.has(nk)) return augMap.get(nk);
  // fuzzy: allow minor name differences
  for (const [k, v] of augMap.entries()) {
    if (k.includes(nk) || nk.includes(k)) return v;
  }
  return "";
}

window.__getAugIcon = (name) => {
  const m = (window.AE_ICONS && window.AE_ICONS.augs) || new Map();
  return getAugIcon(name, m);
};

function CDImg({ src, name, plain = false, size = 32 }) {
  const [url, setUrl] = React.useState(src || "");
  React.useEffect(() => { setUrl(src || ""); }, [src]);

  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      decoding="async"
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "block",
        // only add border/background when NOT plain
        ...(plain ? {} : { borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff" }),
      }}
      onError={() => { /* leave the broken-image icon visible */ }}
    />
  );
}



export default function ArenaExplorer() {
  const [files, setFiles] = useState([]);
  const [champQuery, setChampQuery] = useState("");
  const [minN, setMinN] = useState(10);
  const [sortKey, setSortKey] = useState("wr");

  const [data, setData] = useState({ pris: [], leg: [], aug: [], vshop: [] });
  const [icons, setIcons] = useState({ items: new Map(), augs: new Map() });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [itemsRes, arenaRes] = await Promise.all([
          fetch(ITEMS_JSON),
          fetch(ARENA_JSON),
        ]);
        const itemsJson = await itemsRes.json();
        const arenaJson = await arenaRes.json();

        const itemMap = new Map();
        if (Array.isArray(itemsJson)) {
          for (const it of itemsJson) {
            const name = it && (it.name || it.nameLocalized);
            const key = normKey(name);
            const icon = iconFromPath(it && (it.iconPath || it.icon) || "");
            if (key && icon) itemMap.set(key, icon);
          }
        }
        const arenaItems = (!Array.isArray(arenaJson) && arenaJson && (arenaJson.items || arenaJson.Items))
          ? (arenaJson.items || arenaJson.Items)
          : [];
        for (const it of arenaItems) {
          const nm = it?.name ?? it?.Name ?? it?.displayName ?? it?.DisplayName ?? it?.apiName ?? it?.ApiName;
          const key = normKey(nm);
          const rawIcon = it?.iconSmall ?? it?.IconSmall ?? it?.icon ?? it?.Icon ?? it?.iconLarge ?? it?.IconLarge ?? it?.iconPath ?? it?.IconPath ?? "";
          const icon = iconFromPath(rawIcon);
          if (key && icon) itemMap.set(key, icon);
        }

        const augList = Array.isArray(arenaJson) ? arenaJson : (arenaJson?.augments || arenaJson?.Augments || []);
        const augMap = new Map();
        for (const a of augList) {
          const nm = a?.name ?? a?.Name ?? a?.apiName ?? a?.ApiName;
          const key = normKey(nm);
          const rawIcon = a?.iconSmall ?? a?.IconSmall ?? a?.icon ?? a?.Icon ?? a?.iconLarge ?? a?.IconLarge ?? a?.iconPath ?? a?.IconPath ?? "";
          const icon = iconFromPath(rawIcon);
          if (key && icon) augMap.set(key, icon);
        }
        
        console.log("icons loaded", { items: itemMap.size, augments: augMap.size });
        console.log("sample urls", {
          dragonheart: itemMap.get(normKey("Dragonheart")),
          duskblade: itemMap.get(normKey("Duskblade of Draktharr")),
          fulmination: itemMap.get(normKey("Fulmination")),
        });

        window.AE_ICONS = { items: itemMap, augs: augMap };
        console.log("icons map sizes", { items: itemMap.size, augments: augMap.size });
        console.log("sample urls", {
          blackHole: itemMap.get(normKey("Black Hole Gauntlet")),
          cruelty:   itemMap.get(normKey("Cruelty")),
          lightning: itemMap.get(normKey("Lightning Rod")),
        });

        window.AE_ICONS = window.AE_ICONS || {};
        window.AE_ICONS.items = itemMap;
        console.log("check prismatics", {
          regicide:  getItemIcon("Regicide", itemMap),
          duskblade: getItemIcon("Duskblade of Draktharr", itemMap),
          prowlers:  getItemIcon("Prowler's Claw", itemMap),
        });

        if (alive) setIcons({ items: itemMap, augs: augMap });
      } catch (e) {
        console.warn("Failed to load CDragon metadata", e);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function handleFiles(inputFiles) {
    if (!inputFiles || !inputFiles.length) return;
    const arr = Array.from(inputFiles);
    setFiles(arr);
    let pris = [], leg = [], aug = [], vshop = [];
    for (const f of arr) {
      const name = f.name.toLowerCase();
      const rows = await parseCsv(f);
      if (name.includes("item_present_power_by_champion_prismatic")) pris = rows;
      else if (name.includes("item_present_power_by_champion_legendary")) leg = rows;
      else if (name.includes("augment_power_by_champion_no_order")) aug = rows;
      else if (name.includes("legendary_2000_vs_2500_by_champion")) vshop = rows;
    }
    setData({ pris, leg, aug, vshop });
  }

  const champions = useMemo(() => {
    const s = new Set();
    data.pris.forEach((r) => r && r.champion_name && s.add(r.champion_name));
    data.leg.forEach((r) => r && r.champion_name && s.add(r.champion_name));
    data.aug.forEach((r) => r && r.champion_name && s.add(r.champion_name));
    data.vshop.forEach((r) => r && r.champion_name && s.add(r.champion_name));
    return Array.from(s).sort();
  }, [data]);

  const champion = useMemo(() => {
    if (!champQuery.trim()) return "";
    const q = champQuery.trim().toLowerCase();
    return champions.find((c) => c.toLowerCase() === q) || champions.find((c) => c.toLowerCase().includes(q)) || "";
  }, [champQuery, champions]);

  const prisRows = useMemo(() => {
    const rows = data.pris.filter((r) => r.champion_name === champion);
    const filtered = rows.filter((r) => Number(r.n_present) >= minN);
    const sorted = [...filtered].sort((a, b) => {
      return sortKey === "wr"
        ? Number(b.win_rate_present) - Number(a.win_rate_present)
        : Number(b.n_present) - Number(a.n_present);
    });
    return sorted;
  }, [data.pris, champion, minN, sortKey]);

  const legRows = useMemo(() => {
    const rows = data.leg.filter((r) => r.champion_name === champion);
    const filtered = rows.filter((r) => Number(r.n_present) >= minN);
    const sorted = [...filtered].sort((a, b) => {
      return sortKey === "wr"
        ? Number(b.win_rate_present) - Number(a.win_rate_present)
        : Number(b.n_present) - Number(a.n_present);
    });
    return sorted;
  }, [data.leg, champion, minN, sortKey]);

  const augByTier = useMemo(() => {
    const rows = data.aug.filter((r) => r.champion_name === champion && r.tier_norm);
    const keep = rows.filter((r) => Number(r.n) >= minN);
    const buckets = { silver: [], gold: [], prismatic: [] };
    for (const r of keep) {
      const t = (r.tier_norm || "").toString().toLowerCase();
      if (t === "silver" || t === "gold" || t === "prismatic") buckets[t].push(r);
    }
    for (const k of Object.keys(buckets)) {
      buckets[k] = buckets[k].sort((a, b) => {
        return sortKey === "wr" ? Number(b.win_rate) - Number(a.win_rate) : Number(b.n) - Number(a.n);
      });
    }
    return buckets;
  }, [data.aug, champion, minN, sortKey]);

  const vshopRow = useMemo(() => data.vshop.find((r) => r.champion_name === champion), [data.vshop, champion]);

  const SortControl = (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600">Min N</label>
      <input type="number" className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm" value={minN} min={1} onChange={(e) => setMinN(Number(e.target.value) || 1)} />
      <label className="text-sm text-gray-600 ml-2">Sort</label>
      <select className="rounded-md border border-gray-300 px-2 py-1 text-sm" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
        <option value="wr">Win rate</option>
        <option value="n">Sample size</option>
      </select>
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Arena Explorer</h1>
        {SortControl}
      </div>

      <Section title="Upload CSVs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <input
            type="file"
            multiple
            accept=".csv,text/csv"
            onChange={(e) => handleFiles(e.target.files)}
            className="block w-full text-sm text-gray-900 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-100 hover:file:bg-gray-200"
          />
          <div className="flex flex-wrap gap-2">
            {files.map((f) => (
              <Badge key={f.name}>{f.name}</Badge>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">Works offline in your browser. Icons load from CommunityDragon.</p>
      </Section>

      <Section title="Champion lookup" right={<Badge>{champion || "no match"}</Badge>}>
        <input
          placeholder="Start typing a champion name… (e.g., Vayne)"
          className="w-full rounded-md border border-gray-300 px-3 py-2"
          value={champQuery}
          onChange={(e) => setChampQuery(e.target.value)}
        />
      </Section>

      {champion && (
        <>
{/* === Items side-by-side (always 2 cols) === */}
<div className="grid grid-cols-2 gap-6">
  {/* PRISMATIC (left) */}
  <Section title="Prismatic items — full list">
    {prisRows.length ? (
      <div className="space-y-2">
        {prisRows.map((r) => {
          const url = getItemIcon(r.item_name, icons.items);
          return (
            <Row
              key={r.item_name + "-p"}
              icon={<CDImg src={url} name={r.item_name} />}
              title={r.item_name}
              right={
                <>
                  <Stat label="WR" value={fmtPct(r.win_rate_present)} />
                  <Stat label="N" value={fmtInt(r.n_present)} />
                </>
              }
            />
          );
        })}
      </div>
    ) : (
      <div className="text-sm text-gray-500">No prismatic rows with N ≥ {minN}.</div>
    )}
  </Section>

  {/* LEGENDARY (right) */}
  <Section title="Legendary items — full list">
    {legRows.length ? (
      <div className="space-y-2">
        {legRows.map((r) => {
          const url = getItemIcon(r.item_name, icons.items);
          return (
            <Row
              key={r.item_name + "-l"}
              icon={<CDImg src={url} name={r.item_name} />}
              title={r.item_name}
              right={
                <>
                  <Stat label="WR" value={fmtPct(r.win_rate_present)} />
                  <Stat label="N" value={fmtInt(r.n_present)} />
                </>
              }
            />
          );
        })}
      </div>
    ) : (
      <div className="text-sm text-gray-500">No legendary rows with N ≥ {minN}.</div>
    )}
  </Section>
</div>



          <Section title="Augments — full lists by tier">
            <div className="overflow-x-auto">
            <div className="grid grid-cols-3 gap-3 min-w-[780px]"></div>
              <div className="grid grid-cols-3 gap-3 min-w-[780px]">
              {/* SILVER */}
              <div className="rounded-xl border p-3">
                <div className="mb-2 font-semibold flex items-center gap-2">
                  <Badge>silver</Badge>
                  <span className="text-xs text-gray-500">{(augByTier.silver || []).length} rows</span>
                </div>
                <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                  {(augByTier.silver || []).map((r) => {
                    const url = getAugIcon(r.augment_name, icons.augs);
                    return (
                      <Row
                        key={`silver-${r.augment_name}`}
                        icon={<AugIcon tier={r.tier_norm} src={url} name={r.augment_name} />}
                        title={r.augment_name}
                        right={<>
                          <Badge>{fmtPct(r.win_rate)}</Badge>
                          <Badge>N {fmtInt(r.n)}</Badge>
                        </>}
                      />
                    );
                  })}
                </div>
              </div>

              {/* GOLD */}
              <div className="rounded-xl border p-3">
                <div className="mb-2 font-semibold flex items-center gap-2">
                  <Badge>gold</Badge>
                  <span className="text-xs text-gray-500">{(augByTier.gold || []).length} rows</span>
                </div>
                <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                  {(augByTier.gold || []).map((r) => {
                    const url = getAugIcon(r.augment_name, icons.augs);
                    return (
                      <Row
                        key={`gold-${r.augment_name}`}
                        icon={<AugIcon tier={r.tier_norm} src={url} name={r.augment_name} />}
                        title={r.augment_name}
                        right={<>
                          <Badge>{fmtPct(r.win_rate)}</Badge>
                          <Badge>N {fmtInt(r.n)}</Badge>
                        </>}
                      />
                    );
                  })}
                </div>
              </div>

              {/* PRISMATIC */}
              <div className="rounded-xl border p-3">
                <div className="mb-2 font-semibold flex items-center gap-2">
                  <Badge>prismatic</Badge>
                  <span className="text-xs text-gray-500">{(augByTier.prismatic || []).length} rows</span>
                </div>
                <div className="space-y-2 max-h={[520]} overflow-auto pr-1">
                  {(augByTier.prismatic || []).map((r) => {
                    const url = getAugIcon(r.augment_name, icons.augs);
                    return (
                      <Row
                        key={`prismatic-${r.augment_name}`}
                        icon={<AugIcon tier={r.tier_norm} src={url} name={r.augment_name} />}
                        title={r.augment_name}
                        right={<>
                          <Badge>{fmtPct(r.win_rate)}</Badge>
                          <Badge>N {fmtInt(r.n)}</Badge>
                        </>}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            </div>
          </Section>



                    <Section title="2000g Legendary Voucher vs 2500g Direct Purchase (per champion)">
                      {vshopRow ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Row
                            icon={<div className="w-8 h-8 rounded-md bg-amber-50 border flex items-center justify-center text-xs">2000</div>}
                            title="Voucher roll (Legendary X Item)"
                            right={<>
                              <Stat label="WR" value={fmtPct(vshopRow.wr_voucher2000)} />
                              <Stat label="N" value={fmtInt(vshopRow.n_voucher2000)} />
                            </>}
                          />
                          <Row
                            icon={<div className="w-8 h-8 rounded-md bg-emerald-50 border flex items-center justify-center text-xs">2500</div>}
                            title="Direct shop legendary"
                            right={<>
                              <Stat label="WR" value={fmtPct(vshopRow.wr_shop2500)} />
                              <Stat label="N" value={fmtInt(vshopRow.n_shop2500)} />
                            </>}
                          />
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">No voucher vs shop data for this champion.</div>
                      )}
                    </Section>
                  </>
                )}

                <div className="text-xs text-gray-500 text-center pt-4">Drop in your CSVs above. All processing happens locally in your browser. Icons courtesy of CommunityDragon.</div>
              </div>
            );
          }
