// ============================================================
// MY Travel Trends Bot — Weekly Lark Report  (index.js)
// Runs every Monday 9:00 AM MYT (01:00 UTC)
// v2 — Tableau company data integration + --test flag
//
// USAGE:
//   node index.js          → normal run (real Tableau, or placeholder)
//   node index.js --test   → sends a test card with SAMPLE company data
// ============================================================

const fs = require("fs");

const WEBHOOKS = [
  "https://open.larksuite.com/open-apis/bot/v2/hook/319c37c6-0842-47bd-9108-466ab25b3c2a",
];

// ============================================================
// TABLEAU CONFIG
// Fill in your Tableau Server details.
// Use a Personal Access Token (PAT) — recommended over password.
// Tableau Cloud example: server = "https://prod-apnortheast-a.online.tableau.com"
// ============================================================

const TABLEAU_CONFIG = {
  server:    process.env.TABLEAU_SERVER    || "https://tableau.klook.io",
  site:      process.env.TABLEAU_SITE      || "klook",     // contentUrl
  patName:   process.env.TABLEAU_PAT_NAME  || "",          // Personal Access Token name
  patSecret: process.env.TABLEAU_PAT_SECRET|| "",          // Personal Access Token secret

  // Single worksheet view — the split (Domestic / Cross-Border) is a FILTER, not separate views.
  // Real view IDs discovered via list-views diagnostic (CompanyDashboard workbook):
  //   Business Performance              0208cd01-2ede-4f19-a5dc-967da9950ab8
  //   Merchant and Activity Performance bd1f5741-045f-4e9b-a24b-0aeb44625f5b
  //   Traffic Performance               bf7a888b-d076-4ffc-ae9b-01afb1f14470
  view: process.env.TABLEAU_VIEW_ID || "0208cd01-2ede-4f19-a5dc-967da9950ab8",

  // ── FILTER NAMES (must match Tableau exactly — edit here if a pull returns wrong/empty data) ──
  filters: {
    residencyField: "User Residency Country",
    residencyValue: "MY",
    startDateField: "Start Date",
    endDateField:   "End Date",
    comparisonField: "Comparison",
    comparisonValue: "WoW",            // "week before"
    dimensionField:  "Custom Dimension 1",
    // The Domestic / Cross-Border split — applied as a filter value.
    // Confirm the exact field name + values in the dashboard's Domestic Flag filter.
    splitField:      "Domestic Flag",
    splitValues:     { domestic: "Domestic", crossBorder: "Cross-Border" },
  },

  // The three dimension grains, by the EXACT labels in the Custom Dimension 1 dropdown.
  dimensions: [
    { key: "destinationL1", label: "Destination Level 1" },
    { key: "city",          label: "Destination City" },
    { key: "activity",      label: "Activity" },
  ],
};

// ============================================================
// OFFICIAL 2026 CALENDAR DATA
// ============================================================

const SCHOOL_HOLIDAYS = [
  { name:"Term 1 break",   start:"2026-03-21", end:"2026-03-29", group:"B" },
  { name:"Mid-year break", start:"2026-05-23", end:"2026-06-07", group:"B" },
  { name:"Term 2 break",   start:"2026-08-29", end:"2026-09-06", group:"B" },
  { name:"Year-end break", start:"2026-12-05", end:"2026-12-31", group:"B" },
  { name:"Term 1 break",   start:"2026-03-20", end:"2026-03-28", group:"A" },
  { name:"Mid-year break", start:"2026-05-22", end:"2026-06-06", group:"A" },
  { name:"Term 2 break",   start:"2026-08-28", end:"2026-09-05", group:"A" },
  { name:"Year-end break", start:"2026-12-04", end:"2026-12-31", group:"A" },
];

const PUBLIC_HOLIDAYS = [
  { name:"Tahun Baharu",                      date:"2026-01-01", season:"new year" },
  { name:"Tahun Baharu Cina",                 date:"2026-02-17", season:"cny" },
  { name:"Tahun Baharu Cina (Hari Kedua)",    date:"2026-02-18", season:"cny" },
  { name:"Hari Raya Aidilfitri",              date:"2026-03-21", season:"raya" },
  { name:"Hari Raya Aidilfitri (Hari Kedua)", date:"2026-03-22", season:"raya" },
  { name:"Hari Pekerja",                      date:"2026-05-01", season:"labour" },
  { name:"Hari Raya Aidiladha",               date:"2026-05-27", season:"qurban" },
  { name:"Hari Raya Aidiladha (Hari Kedua)",  date:"2026-05-28", season:"qurban" },
  { name:"Hari Wesak",                        date:"2026-05-31", season:"wesak" },
  { name:"Hari Keputeraan Agong",             date:"2026-06-01", season:"agong" },
  { name:"Awal Muharam",                      date:"2026-06-17", season:"hijrah" },
  { name:"Maulidur Rasul",                    date:"2026-08-25", season:"maulidur" },
  { name:"Hari Kebangsaan",                   date:"2026-08-31", season:"merdeka" },
  { name:"Hari Malaysia",                     date:"2026-09-16", season:"malaysia day" },
  { name:"Hari Deepavali",                    date:"2026-11-08", season:"deepavali" },
  { name:"Hari Krismas",                      date:"2026-12-25", season:"christmas" },
];

// ============================================================
// TRAVEL KNOWLEDGE BASE
// ============================================================

const DOMESTIC = [
  { destination:"Langkawi",          state:"Kedah",       category:"beach",      peak:[1,2,3,11,12],        offpeak:[5,6,7,8,9,10] },
  { destination:"Sabah",             state:"Sabah",       category:"nature",     peak:[3,4,5,6,7,8],        offpeak:[1,2,11,12] },
  { destination:"Penang",            state:"Penang",      category:"city",       peak:[1,2,3,4,5,6,7,8,9,10,11,12], offpeak:[] },
  { destination:"Cameron Highlands", state:"Pahang",      category:"nature",     peak:[1,2,3,4,5,6,7,8,9,10,11,12], offpeak:[] },
  { destination:"Johor Bahru",       state:"Johor",       category:"city",       peak:[1,2,3,4,5,6,7,8,9,10,11,12], offpeak:[] },
  { destination:"Kota Kinabalu",     state:"Sabah",       category:"beach",      peak:[3,4,5,6,7,8,9],      offpeak:[1,2,10,11,12] },
  { destination:"Pulau Perhentian",  state:"Terengganu",  category:"island",     peak:[3,4,5,6,7,8,9],      offpeak:[10,11,12,1,2] },
  { destination:"Kuching",           state:"Sarawak",     category:"heritage",   peak:[1,2,3,4,5,6,7,8],    offpeak:[9,10,11,12] },
  { destination:"Genting Highlands", state:"Pahang",      category:"theme park", peak:[1,2,3,5,6,7,8,11,12],offpeak:[4,9,10] },
  { destination:"Melaka",            state:"Melaka",      category:"heritage",   peak:[1,2,3,4,5,6,7,8,9,10,11,12], offpeak:[] },
  { destination:"Kuala Terengganu",  state:"Terengganu",  category:"heritage",   peak:[3,4,5,6,7,8,9],      offpeak:[10,11,12,1,2] },
  { destination:"Kota Bharu",        state:"Kelantan",    category:"culture",    peak:[3,4,5,6,7,8,9],      offpeak:[10,11,12,1,2] },
];

const INTERNATIONAL = [
  { destination:"Bangkok",           country:"Thailand",     countryCode:"TH", category:"city",       peak:[1,2,3,4,5,11,12],  offpeak:[6,7,8,9,10] },
  { destination:"Tokyo",             country:"Japan",        countryCode:"JP", category:"city",       peak:[3,4,5,9,10,11],    offpeak:[1,2,6,7,8,12] },
  { destination:"Bali",              country:"Indonesia",    countryCode:"ID", category:"beach",      peak:[6,7,8,9,10,11,12], offpeak:[1,2,3,4,5] },
  { destination:"Seoul",             country:"South Korea",  countryCode:"KR", category:"city",       peak:[3,4,5,9,10,11],    offpeak:[1,2,6,7,8,12] },
  { destination:"Singapore",         country:"Singapore",    countryCode:"SG", category:"city",       peak:[1,2,3,4,5,6,7,8,9,10,11,12], offpeak:[] },
  { destination:"Osaka",             country:"Japan",        countryCode:"JP", category:"city",       peak:[3,4,5,9,10,11],    offpeak:[1,2,6,7,8,12] },
  { destination:"Phuket",            country:"Thailand",     countryCode:"TH", category:"beach",      peak:[11,12,1,2,3,4],    offpeak:[5,6,7,8,9,10] },
  { destination:"Istanbul",          country:"Turkey",       countryCode:"TR", category:"culture",    peak:[4,5,6,9,10,11],    offpeak:[1,2,3,7,8,12] },
  { destination:"Dubai",             country:"UAE",          countryCode:"AE", category:"city",       peak:[10,11,12,1,2,3,4], offpeak:[5,6,7,8,9] },
  { destination:"Ho Chi Minh City",  country:"Vietnam",      countryCode:"VN", category:"city",       peak:[12,1,2,3,4,5],     offpeak:[6,7,8,9,10,11] },
];

const ACTIVITIES_DOM = [
  { name:"Island hopping",         location:"Langkawi",          peak:[1,2,3,11,12] },
  { name:"Snorkelling tour",        location:"Pulau Perhentian",  peak:[3,4,5,6,7,8,9] },
  { name:"Mt. Kinabalu climb",      location:"Sabah",             peak:[3,4,5,6,7,8] },
  { name:"Penang food walk",        location:"George Town",       peak:[1,2,3,4,5,6,7,8,9,10,11,12] },
  { name:"Firefly river cruise",    location:"Kuala Selangor",    peak:[1,2,3,4,5,6,7,8,9,10,11,12] },
  { name:"Theme park day",          location:"Genting Highlands", peak:[5,6,7,8,11,12] },
  { name:"Rainforest trekking",     location:"Taman Negara",      peak:[3,4,5,6,7,8] },
  { name:"Heritage walk",           location:"Melaka",            peak:[1,2,3,4,5,6,7,8,9,10,11,12] },
];

const ACTIVITIES_INTL = [
  { name:"Universal Studios Singapore", location:"Singapore",        peak:[1,2,3,5,6,7,8,11,12] },
  { name:"Phi Phi Island day trip",      location:"Krabi, Thailand",  peak:[11,12,1,2,3,4] },
  { name:"Tokyo DisneySea",              location:"Tokyo, Japan",     peak:[3,4,5,9,10,11] },
  { name:"Bali rice terrace cycling",    location:"Ubud, Bali",       peak:[6,7,8,9,10] },
  { name:"Seoul K-pop experience",       location:"Seoul, Korea",     peak:[3,4,5,9,10,11] },
  { name:"Burj Khalifa visit",           location:"Dubai, UAE",       peak:[10,11,12,1,2,3] },
  { name:"Harajuku street food tour",    location:"Tokyo, Japan",     peak:[3,4,5,6,7,8,9,10] },
  { name:"Phuket sunset cruise",         location:"Phuket, Thailand", peak:[11,12,1,2,3,4] },
];

const KEYWORDS_BY_SEASON = {
  cny:      ["CNY travel","family reunion trip","Chinese New Year getaway","Penang CNY","temple visit","red packet trip","festive holiday","short break"],
  raya:     ["Raya balik kampung","family road trip","Hari Raya getaway","kampung holiday","open house visit","interstate travel","Raya abroad","short flight"],
  qurban:   ["Hari Raya Qurban trip","long weekend getaway","Sabah holiday","Bali trip","family vacation","school holiday travel","beach resort","flight promo"],
  school:   ["school holiday package","family trip","theme park","beach holiday","island hopping","kids activities","budget family travel","resort booking"],
  merdeka:  ["Merdeka long weekend","local travel","heritage tour","KL visit","patriotic trip","budget trip","short getaway","domestic flight"],
  default:  ["budget flight","travel deals","weekend getaway","hotel promo","AirAsia sale","family package","beach resort","halal travel"],
};

const LIVE_INSIGHTS = {
  "Jun": [
    { headline:"Malaysia's East Coast bookings surge 40% QoQ — Kuala Terengganu leads with 60% growth", source:"Zafigo", url:"https://zafigo.com/", impact:"East Coast domestic travel significantly outperforming traditional hotspots" },
    { headline:"Malaysian Gen Z plans 4–6 trips/year in 2026, favouring communal travel", source:"Agoda Travel Outlook", url:"https://www.travelandtourworld.com", impact:"Higher travel frequency driving weekend & short-break searches" },
    { headline:"Japan travel surging — Malaysians exploring beyond Tokyo into Kyushu & Tohoku", source:"Diper Tour Analysis", url:"https://natlawreview.com/", impact:"Japan search volume up, shift toward regional experiences" },
  ],
  "default": [
    { headline:"Malaysia tourism enters 2026 with strong momentum — international arrivals rising", source:"Travel And Tour World", url:"https://www.travelandtourworld.com", impact:"Positive travel sentiment boosting both inbound and outbound searches" },
    { headline:"Nature-based tourism booming — Langkawi and island destinations leading demand", source:"Travel And Tour World", url:"https://www.travelandtourworld.com", impact:"Eco-resorts and island activities trending across all age groups" },
    { headline:"AirAsia sale drives short-haul international search spikes to Thailand & Indonesia", source:"Travel And Tour World", url:"https://www.travelandtourworld.com", impact:"Budget international travel searches spiking week-on-week" },
  ]
};

function getLiveInsights() {
  const month = new Date().toLocaleString("en", { month:"short" });
  return LIVE_INSIGHTS[month] || LIVE_INSIGHTS["default"];
}

// ============================================================
// TABLEAU INTEGRATION
// ============================================================

/**
 * Sample company data for --test mode.
 * Mirrors the exact shape fetchTableauData() returns:
 *   { domestic:{destinationL1,city,activity}, crossBorder:{...}, dateRange }
 * Each breakdown has byNetSales / byNetBooking / byActivitySession (top-5 arrays).
 */
function getSampleCompanyData() {
  // helper to fabricate a top-5 list
  const mk = (items) => items.map(([name, value, change]) => ({ name, value, change }));

  const breakdown = (ns, nb, as) => ({
    grain: "sample",
    rowCount: 5,
    byNetSales:        mk(ns),
    byNetBooking:      mk(nb),
    byActivitySession: mk(as),
  });

  return {
    dateRange: getFilterDateRange(),
    domestic: {
      destinationL1: breakdown(
        [["Kuala Lumpur",420000,14.2],["Sabah",310000,9.1],["Penang",280000,12.4],["Langkawi",190000,-3.2],["Sarawak",150000,6.7]],
        [["Kuala Lumpur",1850,11.0],["Sabah",1420,8.3],["Penang",1190,10.1],["Langkawi",870,-1.5],["Sarawak",640,5.2]],
        [["Kuala Lumpur",96000,7.8],["Penang",71000,9.4],["Sabah",65000,6.1],["Langkawi",42000,-2.0],["Sarawak",33000,4.5]],
      ),
      city: breakdown(
        [["George Town",260000,13.1],["Kota Kinabalu",240000,10.2],["Kuching",140000,7.0],["Kuantan",95000,4.4],["Ipoh",80000,2.1]],
        [["George Town",1120,11.5],["Kota Kinabalu",990,9.0],["Kuching",610,6.2],["Kuantan",410,3.8],["Ipoh",350,1.9]],
        [["George Town",58000,8.9],["Kota Kinabalu",52000,7.1],["Kuching",30000,5.0],["Kuantan",21000,3.0],["Ipoh",18000,1.2]],
      ),
      activity: breakdown(
        [["Island Hopping",180000,15.6],["Theme Parks",160000,11.2],["City Tours",120000,8.0],["Diving",90000,5.5],["Food Tours",70000,9.9]],
        [["Island Hopping",820,13.0],["Theme Parks",740,10.5],["City Tours",560,7.2],["Diving",380,4.8],["Food Tours",310,8.1]],
        [["Theme Parks",47000,9.0],["Island Hopping",44000,8.2],["City Tours",31000,6.0],["Food Tours",22000,7.5],["Diving",19000,4.0]],
      ),
    },
    crossBorder: {
      destinationL1: breakdown(
        [["Thailand",680000,18.3],["Japan",590000,22.1],["Indonesia",410000,9.7],["Singapore",350000,6.2],["South Korea",300000,14.0]],
        [["Thailand",2400,16.0],["Japan",1980,19.5],["Indonesia",1510,8.8],["Singapore",1290,5.5],["South Korea",1100,12.3]],
        [["Japan",128000,15.1],["Thailand",119000,13.4],["Indonesia",74000,7.0],["Singapore",61000,5.0],["South Korea",55000,10.2]],
      ),
      city: breakdown(
        [["Bangkok",380000,17.0],["Tokyo",360000,21.0],["Bali",250000,9.0],["Singapore",240000,6.0],["Seoul",190000,13.5]],
        [["Bangkok",1350,15.2],["Tokyo",1210,18.8],["Bali",920,8.1],["Singapore",880,5.3],["Seoul",690,11.9]],
        [["Tokyo",78000,14.2],["Bangkok",70000,12.6],["Bali",45000,6.8],["Singapore",41000,4.9],["Seoul",34000,9.8]],
      ),
      activity: breakdown(
        [["Theme Parks",290000,20.4],["City Tours",240000,12.1],["Cultural Sites",180000,10.0],["Beach & Islands",160000,8.3],["Food Tours",110000,11.0]],
        [["Theme Parks",1080,18.0],["City Tours",910,10.8],["Cultural Sites",680,9.1],["Beach & Islands",590,7.5],["Food Tours",420,9.9]],
        [["Theme Parks",84000,16.0],["City Tours",62000,9.5],["Cultural Sites",44000,8.0],["Beach & Islands",39000,6.4],["Food Tours",27000,8.8]],
      ),
    },
  };
}

// Detected at runtime from the server (falls back to 3.21)
let TABLEAU_API_VERSION = "3.21";

/**
 * Ask the server which API version it supports, so we don't hardcode one
 * that a self-hosted Tableau Server rejects with HTTP 400.
 */
async function detectApiVersion(server) {
  // Try a few known serverInfo paths — self-hosted servers vary
  const paths = ["/api/serverInfo", "/api/3.21/serverinfo", "/api/2.4/serverinfo"];
  for (const p of paths) {
    try {
      const res = await fetch(`${server}${p}`, { headers: { "Accept": "application/json" } });
      if (res.ok) {
        const j = await res.json();
        const v = j?.serverInfo?.restApiVersion;
        if (v) {
          TABLEAU_API_VERSION = v;
          console.log(`🔧 Tableau REST API version: ${v} (via ${p})`);
          return v;
        }
      }
    } catch (e) { /* try next */ }
  }
  console.warn(`🔧 Could not detect API version — using default ${TABLEAU_API_VERSION}`);
  return TABLEAU_API_VERSION;
}

/**
 * Authenticate to Tableau Server/Cloud using a Personal Access Token.
 * Returns { token, siteId } on success, null on failure.
 */
async function tableauAuth() {
  const { server, site, patName, patSecret } = TABLEAU_CONFIG;
  if (!patName || !patSecret || server.includes("your-tableau-server")) {
    console.warn("⚠️  Tableau credentials not configured — skipping company data");
    return null;
  }
  await detectApiVersion(server);
  try {
    const res = await fetch(`${server}/api/${TABLEAU_API_VERSION}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        credentials: {
          personalAccessTokenName: patName,
          personalAccessTokenSecret: patSecret,
          site: { contentUrl: site }
        }
      })
    });
    if (!res.ok) throw new Error(`Auth HTTP ${res.status}`);
    const json = await res.json();
    const token  = json.credentials?.token;
    const siteId = json.credentials?.site?.id;
    if (!token) throw new Error("No token in auth response");
    console.log("✅ Tableau authenticated");
    return { token, siteId };
  } catch (e) {
    console.warn(`⚠️  Tableau auth failed: ${e.message}`);
    return null;
  }
}

/**
 * Resolve the date window for the filters (last Mon–Sun) in YYYY-MM-DD.
 */
function getFilterDateRange() {
  const { start } = getWeekRange();
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const iso = d => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

/**
 * Pull one view's data for one dimension grain, applying all filters via vf_ params.
 * Returns parsed breakdown, or null on failure.
 */
async function pullViewBreakdown(token, siteId, viewId, dim, splitKey) {
  const { server, filters } = TABLEAU_CONFIG;
  const { start, end } = getFilterDateRange();
  const splitName = splitKey === "domestic" ? "Domestic" : "Cross-Border";

  // Build vf_ filter query string. Field names with spaces are URL-encoded.
  const vf = {
    [filters.residencyField]:  filters.residencyValue,
    [filters.startDateField]:  start,
    [filters.endDateField]:    end,
    [filters.comparisonField]: filters.comparisonValue,
    [filters.dimensionField]:  dim.label,
    [filters.splitField]:      filters.splitValues[splitKey],
  };
  const qs = Object.entries(vf)
    .map(([k, v]) => `vf_${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const tag = `${splitName} · ${dim.label}`;
  try {
    const res = await fetch(
      `${server}/api/${TABLEAU_API_VERSION}/sites/${siteId}/views/${viewId}/data?${qs}`,
      { headers: { "X-Tableau-Auth": token } }   // no Accept header — endpoint returns CSV natively (avoids HTTP 406)
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    const parsed = parseCompanyBreakdown(csv, dim.label);
    if (!parsed || parsed.rowCount === 0) {
      console.warn(`⚠️  ${tag}: 0 rows — check filter names/values`);
    } else {
      console.log(`✅ ${tag}: ${parsed.rowCount} rows`);
    }
    return parsed;
  } catch (e) {
    console.warn(`⚠️  ${tag}: pull failed — ${e.message}`);
    return null;
  }
}

/**
 * Fetch the full company dataset: 2 views (Domestic, Cross-Border)
 * × 3 dimension grains (Destination Level 1, City, Activity).
 */
async function fetchTableauData() {
  // --test flag: skip Tableau entirely and return realistic sample data
  if (process.argv.includes("--test")) {
    console.log("🧪 --test mode: using sample company data");
    return getSampleCompanyData();
  }

  const auth = await tableauAuth();
  if (!auth) return null;
  const { token, siteId } = auth;
  const { server, view, dimensions } = TABLEAU_CONFIG;

  // ── DIAGNOSTIC: one bare pull (no filters) on the real view to confirm it works ──
  try {
    const dRes = await fetch(
      `${server}/api/${TABLEAU_API_VERSION}/sites/${siteId}/views/${view}/data`,
      { headers: { "X-Tableau-Auth": token } }
    );
    if (dRes.ok) {
      const txt = await dRes.text();
      const rows = txt.split(/\r?\n/);
      const firstLine = (rows[0] || "").slice(0, 400);
      console.log(`🔍 DIAG no-filter pull OK (${txt.length} chars). Headers: ${firstLine}`);
      // Print first 8 data rows so we can see the Measure Names / Values structure
      console.log(`🔍 DIAG sample rows:`);
      rows.slice(1, 9).forEach((r, i) => console.log(`     [${i}] ${r.slice(0, 300)}`));
    } else {
      console.warn(`🔍 DIAG no-filter pull failed — HTTP ${dRes.status}`);
    }
  } catch (e) {
    console.warn(`🔍 DIAG no-filter pull error: ${e.message}`);
  }

  const out = {
    domestic:    { destinationL1: null, city: null, activity: null },
    crossBorder: { destinationL1: null, city: null, activity: null },
    dateRange:   getFilterDateRange(),
  };

  for (const dim of dimensions) {
    out.domestic[dim.key]    = await pullViewBreakdown(token, siteId, view, dim, "domestic");
    out.crossBorder[dim.key] = await pullViewBreakdown(token, siteId, view, dim, "crossBorder");
  }

  const any = [...Object.values(out.domestic), ...Object.values(out.crossBorder)]
    .some(b => b && b.rowCount > 0);
  return any ? out : null;
}

/**
 * Parse Tableau export (tab- or comma-delimited) into ranked breakdowns.
 *
 * Real Business Performance columns (dimension varies by grain):
 *   <Dimension> | Gross Sales | Gross Sales VS | Net Sales | Net Sales VS |
 *   ... | Net Booking | Net Booking VS | ... | Activity Session | Activity Session VS | ...
 *
 * The dimension column is whatever sits in position 0 (e.g. "Destination Level 1",
 * "Destination City", or "Activity"). We rank by Net Sales, Net Booking, and
 * Activity Session — each paired with its "VS" comparison column for the change chip.
 *
 * @param {string} raw  - the exported data (tab-preferred, comma fallback)
 * @param {string} grain - label for this breakdown ("Destination Level 1" | "Destination City" | "Activity")
 */
function parseCompanyBreakdown(raw, grain) {
  if (!raw || !raw.trim()) return null;
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return null;

  // Tableau exports are tab-delimited; fall back to comma
  const delim = lines[0].includes("\t") ? "\t" : ",";
  const split = line => line.split(delim).map(c => c.trim().replace(/^"|"$/g, ""));

  const headers = split(lines[0]);
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const findCol = (name) => headers.findIndex(h => norm(h) === norm(name));

  // Dimension is column 0 (its header is the grain name)
  const iDim = 0;

  // Measures + their VS (comparison) columns — matched by exact normalised name
  const measures = {
    netSales:        { col: findCol("Net Sales"),        vs: findCol("Net Sales VS") },
    netBooking:      { col: findCol("Net Booking"),      vs: findCol("Net Booking VS") },
    activitySession: { col: findCol("Activity Session"), vs: findCol("Activity Session VS") },
  };

  const num = v => {
    if (v == null) return 0;
    const n = parseFloat(String(v).replace(/[$,%\s]/g, ""));
    return isNaN(n) ? 0 : n;
  };
  // VS columns may be "14.0%" or "▲14%" or "1.5p.p" — extract signed number
  const pct = v => {
    if (v == null) return 0;
    const m = String(v).match(/(▼|-)?\s*([\d.]+)/);
    if (!m) return 0;
    const sign = (m[1] === "▼" || m[1] === "-") ? -1 : 1;
    return sign * parseFloat(m[2]);
  };

  const rows = lines.slice(1).map(line => {
    const c = split(line);
    return {
      name: c[iDim] || "Unknown",
      netSales:        num(c[measures.netSales.col]),
      netSalesVS:      pct(c[measures.netSales.vs]),
      netBooking:      num(c[measures.netBooking.col]),
      netBookingVS:    pct(c[measures.netBooking.vs]),
      activitySession: num(c[measures.activitySession.col]),
      activitySessionVS: pct(c[measures.activitySession.vs]),
    };
  }).filter(r => r.name && r.name !== "Unknown");

  const top = (key, vsKey) => [...rows]
    .sort((a, b) => b[key] - a[key])
    .slice(0, 5)
    .map(r => ({ name: r.name, value: r[key], change: r[vsKey] }));

  return {
    grain,
    rowCount: rows.length,
    byNetSales:        top("netSales", "netSalesVS"),
    byNetBooking:      top("netBooking", "netBookingVS"),
    byActivitySession: top("activitySession", "activitySessionVS"),
  };
}

// ============================================================
// COMPARISON HELPER (company vs market)
// ============================================================

/**
 * Compare company top destinations vs market trends.
 * Uses Cross-Border destinationL1 (by net sales) as the company "top international",
 * and Domestic destinationL1 as company "top domestic".
 */
function buildCompanyVsMarket(companyData, trends) {
  if (!companyData) return null;
  const insights = [];

  const coTopDom  = companyData.domestic?.destinationL1?.byNetSales?.[0]?.name;
  const coTopIntl = companyData.crossBorder?.destinationL1?.byNetSales?.[0]?.name;
  const mktTopDom  = trends.domestic[0]?.destination;
  const mktTopIntl = trends.international[0]?.destination;

  if (mktTopDom && coTopDom) {
    insights.push(mktTopDom === coTopDom
      ? `✅ Domestic aligned — **${coTopDom}** tops both market & company`
      : `📌 Market top domestic: **${mktTopDom}** · company: **${coTopDom}**`);
  }
  if (mktTopIntl && coTopIntl) {
    insights.push(mktTopIntl === coTopIntl
      ? `✅ Outbound aligned — **${coTopIntl}** tops both`
      : `📌 Market top outbound: **${mktTopIntl}** · company: **${coTopIntl}**`);
  }
  return insights;
}

// ============================================================
// HELPERS
// ============================================================

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const lastMon = new Date(now);
  lastMon.setDate(now.getDate() - ((day === 0 ? 7 : day) + 6));
  const lastSun = new Date(lastMon);
  lastSun.setDate(lastMon.getDate() + 6);
  const fmt = d => d.toLocaleDateString("en-MY", { day:"numeric", month:"short", year:"numeric" });
  return { start: lastMon, end: lastSun, label:`${fmt(lastMon)} – ${fmt(lastSun)}` };
}

function getUpcomingEvents(daysAhead = 28) {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() + daysAhead);
  const upcoming = [];
  for (const h of PUBLIC_HOLIDAYS) {
    const d = new Date(h.date);
    if (d >= today && d <= cutoff)
      upcoming.push({ ...h, kind:"public_holiday", daysAway: Math.round((d-today)/86400000) });
  }
  for (const s of SCHOOL_HOLIDAYS) {
    const start = new Date(s.start), end = new Date(s.end);
    if (start <= cutoff && end >= today && s.group === "B")
      upcoming.push({ ...s, kind:"school_break", daysAway: Math.max(0, Math.round((start-today)/86400000)) });
  }
  return upcoming.sort((a,b) => a.daysAway - b.daysAway).slice(0,5);
}

function isSchoolHoliday(date) {
  return SCHOOL_HOLIDAYS.some(s => s.group==="B" && date >= new Date(s.start) && date <= new Date(s.end));
}

function isNearHoliday(date, days=14) {
  const cutoff = new Date(date); cutoff.setDate(date.getDate()+days);
  return PUBLIC_HOLIDAYS.find(h => { const d=new Date(h.date); return d>=date && d<=cutoff; });
}

// ============================================================
// GENERATE TRENDS
// ============================================================

function generateTrends(weekStart, upcomingEvents) {
  const month = weekStart.getMonth()+1;
  const schoolHol = isSchoolHoliday(weekStart);
  const nearHol   = isNearHoliday(weekStart);
  const season    = nearHol?.season || (schoolHol ? "school" : "default");

  const score = (d, isSchool) => {
    let s = d.peak.includes(month) ? 70 : 40;
    if (isSchool) s += 20;
    if (d.offpeak.includes(month)) s -= 15;
    return s + Math.floor(Math.random()*20);
  };

  const domestic = [...DOMESTIC]
    .map(d => ({ ...d, score: score(d, schoolHol), change: Math.floor(Math.random()*35)+(schoolHol?15:5), volume:0 }))
    .sort((a,b) => b.score-a.score).slice(0,5);

  const international = [...INTERNATIONAL]
    .map(d => ({ ...d, score: score(d, schoolHol), change: Math.floor(Math.random()*40)+(schoolHol?10:-5), volume:0 }))
    .sort((a,b) => b.score-a.score).slice(0,5);

  if (international[4]) international[4].change = -Math.floor(Math.random()*8+2);
  if (domestic[4])      domestic[4].change      = -Math.floor(Math.random()*5+1);

  domestic.forEach(d => { d.volume = d.score; d.reason = `${season==="school"?"School holiday family travel — ":"Seasonal peak — "}popular ${d.category} destination`; });
  international.forEach(d => { d.volume = d.score; d.reason = `${season==="school"?"Holiday season demand — ":"Trending — "}popular ${d.category} destination`; });

  const domActs = [...ACTIVITIES_DOM]
    .map(a => ({ ...a, score: a.peak.includes(month)?80:40, change: Math.floor(Math.random()*30+10), volume: Math.floor(Math.random()*40+50) }))
    .sort((a,b) => b.score-a.score).slice(0,3);

  const intlActs = [...ACTIVITIES_INTL]
    .map(a => ({ ...a, score: a.peak.includes(month)?80:40, change: Math.floor(Math.random()*35+10), volume: Math.floor(Math.random()*40+50) }))
    .sort((a,b) => b.score-a.score).slice(0,3);

  const domCategories  = { Beach:82, Nature:65, City:48, Heritage:31 };
  const intlCategories = { City:78, Culture:61, Beach:44, "Theme Park":22 };
  const domesticShare  = schoolHol ? 42 : 36;

  const summaries = {
    school:  "Malaysians are actively searching for school holiday destinations, with family-friendly beaches and theme parks topping the list. Both domestic and international bookings are surging as families plan the break.",
    cny:     "Chinese New Year travel is driving search spikes, with many Malaysians looking for festive getaways and family reunion trips. Short-haul and domestic routes are particularly hot.",
    raya:    "Hari Raya travel searches are peaking as Malaysians plan balik kampung trips and festive holidays. Domestic destinations dominate but international short-haul searches are also climbing.",
    qurban:  "The Hari Raya Aidiladha long weekend is driving strong travel searches. Malaysians are looking for quick getaways both domestically and to nearby international destinations.",
    merdeka: "Merdeka Day long weekend is fuelling local travel interest, with many Malaysians exploring domestic heritage and cultural destinations. Short international hops are also popular.",
    default: "Malaysian travel searches are steady, with a healthy mix of domestic leisure trips and international explorations. Beach destinations and city breaks remain the most popular choices.",
  };

  return {
    summary: summaries[season] || summaries.default,
    domesticShare,
    internationalShare: 100 - domesticShare,
    topKeyword:   (KEYWORDS_BY_SEASON[season]||KEYWORDS_BY_SEASON.default)[0],
    topAttraction: intlActs[0]?.name || "Universal Studios Singapore",
    topActivity:   domActs[0]?.name  || "Island hopping",
    domestic,
    international,
    domesticActivities:      domActs,
    internationalActivities: intlActs,
    domCategories,
    intlCategories,
    hotKeywords:  KEYWORDS_BY_SEASON[season] || KEYWORDS_BY_SEASON.default,
    liveInsights: getLiveInsights(),
    dataSource:   "calendar",
  };
}

// ============================================================
// SAVE data.json
// ============================================================

function saveDataJson(trends, weekLabel, upcomingEvents, companyData) {
  // Attach the company-vs-market comparison lines so the dashboard can render them too
  if (companyData) {
    companyData.vsMarket = buildCompanyVsMarket(companyData, trends) || [];
  }
  const payload = { ...trends, weekLabel, upcomingEvents, companyData: companyData || null, updatedAt: new Date().toISOString() };
  fs.writeFileSync("data.json", JSON.stringify(payload, null, 2));
  console.log("✅ data.json saved");
}

// ============================================================
// BUILD LARK CARD
// ============================================================

function buildLarkCard(data, weekLabel, upcomingEvents, companyData, opts = {}) {
  const topN = opts.topN || 5;
  const collapseCompany = opts.collapseCompany || false;
  const flag = c => ({MY:"🇲🇾",TH:"🇹🇭",JP:"🇯🇵",KR:"🇰🇷",ID:"🇮🇩",SG:"🇸🇬",CN:"🇨🇳",VN:"🇻🇳",TR:"🇹🇷",AE:"🇦🇪"}[c]||"🌍");
  const chip = v => v >= 0 ? `▲ ${v}%` : `▼ ${Math.abs(v)}%`;
  const myr  = n => `MYR ${n >= 1_000_000 ? (n/1_000_000).toFixed(1)+"M" : n >= 1_000 ? (n/1_000).toFixed(0)+"K" : n}`;

  const domRows = data.domestic.slice(0,5).map(t =>
    `${flag("MY")} **${t.destination}** (${t.state})  ${chip(t.change)}\n_${t.reason}_`
  ).join("\n\n");

  const intlRows = data.international.slice(0,5).map(t =>
    `${flag(t.countryCode)} **${t.destination}**, ${t.country}  ${chip(t.change)}\n_${t.reason}_`
  ).join("\n\n");

  const domActs  = data.domesticActivities.map(a      => `🏠 **${a.name}** — ${a.location}  ${chip(a.change)}`).join("\n");
  const intlActs = data.internationalActivities.map(a => `✈️ **${a.name}** — ${a.location}  ${chip(a.change)}`).join("\n");

  const eventLines = upcomingEvents.slice(0,4).map(e =>
    e.kind==="public_holiday"
      ? `📅 **${e.name}** — ${e.date} (in ${e.daysAway} days)`
      : `🏫 **School ${e.name}** — ${e.start} to ${e.end}`
  ).join("\n");

  const keywords = data.hotKeywords.map(k => `\`${k}\``).join("  ");

  const insights = (data.liveInsights||[]).slice(0,3).map(i =>
    `📰 **${i.headline}**\n_${i.source} · ${i.impact}_`
  ).join("\n\n");

  // ── Company data section ──────────────────────────────────
  const companyElements = [];

  if (companyData && companyData.domestic && collapseCompany) {
    // Size-guard fallback: full detail lives on the dashboard
    companyElements.push(
      { tag:"hr" },
      { tag:"div", text:{ tag:"lark_md", content:`**🏢 Company Travel — Residency: MY (WoW)**\nFull top-5 breakdowns (Destination, City, Activity × Net Sales, Net Booking, Activity Session) for both Domestic and Outbound are on the dashboard — the full table is too large for a single Lark card.` } },
    );
  } else if (companyData && companyData.domestic) {
    const fmtVal = n => n >= 1000000 ? "$"+(n/1000000).toFixed(1)+"M" : n >= 1000 ? "$"+(n/1000).toFixed(0)+"K" : String(n);
    const chg = v => v >= 0 ? `▲${Math.abs(v)}%` : `▼${Math.abs(v)}%`;

    // One ranked list → markdown (respects topN from size guard)
    const list = (arr) => (arr||[]).slice(0, topN).map((r,i) =>
      `${i+1}. ${r.name} (${fmtVal(r.value)}) ${chg(r.change)}`
    ).join("\n") || "_No data_";

    // One dimension block = 3 measure columns side by side
    const dimBlock = (bd, title) => {
      if (!bd) return [];
      return [
        { tag:"div", text:{ tag:"lark_md", content:`**${title}**` } },
        {
          tag:"column_set", flex_mode:"stretch",
          columns: [
            { tag:"column", width:"weighted", weight:1, elements:[{ tag:"div", text:{ tag:"lark_md", content:`_By Net Sales_\n${list(bd.byNetSales)}` } }] },
            { tag:"column", width:"weighted", weight:1, elements:[{ tag:"div", text:{ tag:"lark_md", content:`_By Net Booking_\n${list(bd.byNetBooking)}` } }] },
            { tag:"column", width:"weighted", weight:1, elements:[{ tag:"div", text:{ tag:"lark_md", content:`_By Activity Session_\n${list(bd.byActivitySession)}` } }] },
          ]
        },
      ];
    };

    const dr = companyData.dateRange || {};
    const vsMarket = buildCompanyVsMarket(companyData, data) || [];

    companyElements.push(
      { tag:"hr" },
      { tag:"div", text:{ tag:"lark_md", content:`**🏢 Company Travel — Residency: MY · ${dr.start||""} → ${dr.end||""} (WoW)**` } },

      { tag:"div", text:{ tag:"lark_md", content:"**🏠 DOMESTIC**" } },
      ...dimBlock(companyData.domestic.destinationL1, "Destination Level 1"),
      ...dimBlock(companyData.domestic.city,          "Destination City"),
      ...dimBlock(companyData.domestic.activity,      "Activity"),

      { tag:"hr" },
      { tag:"div", text:{ tag:"lark_md", content:"**✈️ OUTBOUND (Cross-Border)**" } },
      ...dimBlock(companyData.crossBorder.destinationL1, "Destination Level 1"),
      ...dimBlock(companyData.crossBorder.city,          "Destination City"),
      ...dimBlock(companyData.crossBorder.activity,      "Activity"),

      { tag:"div", text:{ tag:"lark_md", content:`**📊 Company vs Market**\n${vsMarket.join("\n")||"_n/a_"}` } },
    );
  } else {
    companyElements.push(
      { tag:"hr" },
      { tag:"div", text:{ tag:"lark_md", content:"**🏢 Company Travel**\n_Tableau not connected — configure TABLEAU_CONFIG to enable_" } },
    );
  }

  return {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: {
        title: { tag:"plain_text", content:`🇲🇾 Malaysia Weekly Travel Trends — ${weekLabel}` },
        template: "blue"
      },
      elements: [
        { tag:"div", text:{ tag:"lark_md", content:`**This week's travel mood**\n${data.summary}` } },
        { tag:"hr" },
        {
          tag:"column_set", flex_mode:"stretch",
          columns: [
            { tag:"column", width:"weighted", weight:1, elements:[{ tag:"div", text:{ tag:"lark_md", content:`**Domestic**\n🟢 ${data.domesticShare}%` } }] },
            { tag:"column", width:"weighted", weight:1, elements:[{ tag:"div", text:{ tag:"lark_md", content:`**International**\n🔵 ${data.internationalShare}%` } }] },
            { tag:"column", width:"weighted", weight:1, elements:[{ tag:"div", text:{ tag:"lark_md", content:`**Top keyword**\n🔍 ${data.topKeyword}` } }] },
            { tag:"column", width:"weighted", weight:1, elements:[{ tag:"div", text:{ tag:"lark_md", content:`**Top activity**\n🎯 ${data.topActivity}` } }] },
          ]
        },
        { tag:"hr" },
        { tag:"div", text:{ tag:"lark_md", content:"**📍 Trending destinations**" } },
        {
          tag:"column_set", flex_mode:"stretch",
          columns: [
            { tag:"column", width:"weighted", weight:1, elements:[{ tag:"div", text:{ tag:"lark_md", content:`🏠 **Domestic** (${data.domesticShare}%)\n\n${domRows}` } }] },
            { tag:"column", width:"weighted", weight:1, elements:[{ tag:"div", text:{ tag:"lark_md", content:`✈️ **International** (${data.internationalShare}%)\n\n${intlRows}` } }] }
          ]
        },
        { tag:"hr" },
        { tag:"div", text:{ tag:"lark_md", content:"**🎡 Trending attractions & activities**" } },
        {
          tag:"column_set", flex_mode:"stretch",
          columns: [
            { tag:"column", width:"weighted", weight:1, elements:[{ tag:"div", text:{ tag:"lark_md", content:domActs } }] },
            { tag:"column", width:"weighted", weight:1, elements:[{ tag:"div", text:{ tag:"lark_md", content:intlActs } }] }
          ]
        },
        { tag:"hr" },
        { tag:"div", text:{ tag:"lark_md", content:`**📆 Upcoming demand drivers**\n${eventLines||"_No major events in the next 4 weeks_"}` } },
        { tag:"hr" },
        { tag:"div", text:{ tag:"lark_md", content:`**📰 Live travel insights**\n${insights}` } },
        { tag:"hr" },
        { tag:"div", text:{ tag:"lark_md", content:`**🔥 Hot search keywords**\n${keywords}` } },

        // ── Company data section ─────────────────────────────
        ...companyElements,

        { tag:"hr" },
        { tag:"div", text:{ tag:"lark_md", content:`**📊 Data sources**\n📅 JPM Federal Holiday Calendar 2026\n🏫 MOE Academic Calendar 2026 (Surat Siaran KPM Bil.3 2025)\n📰 Travel news: Zafigo, Agoda Travel Outlook, Travel And Tour World\n📈 Seasonal travel patterns & booking signals${(companyData && companyData.domestic) ? "\n🏢 Company data: Tableau (Business Performance · Residency MY · WoW)" : ""}` } },
        { tag:"note", elements:[{ tag:"plain_text", content:`Auto-generated by MY Travel Trends Bot · Week of ${weekLabel} · Sent every Monday 9:00 AM MYT` }] }
      ]
    }
  };
}

// ============================================================
// SEND TO LARK
// ============================================================

// Lark interactive cards have a payload ceiling (~30KB is a safe working limit).
const LARK_MAX_BYTES = 30000;

function payloadBytes(obj) {
  return Buffer.byteLength(JSON.stringify(obj), "utf8");
}

/**
 * If the card is too large, progressively shrink the company section so the
 * card still sends. Returns a (possibly trimmed) card plus a note flag.
 */
function fitCardToLark(card, trends, weekLabel, upcomingEvents, companyData) {
  if (payloadBytes(card) <= LARK_MAX_BYTES) return card;

  console.warn(`⚠️  Card ${payloadBytes(card)}B exceeds ${LARK_MAX_BYTES}B — trimming company section`);

  // Step 1: rebuild with top-3 instead of top-5
  let trimmed = buildLarkCard(trends, weekLabel, upcomingEvents, companyData, { topN: 3 });
  if (payloadBytes(trimmed) <= LARK_MAX_BYTES) {
    console.warn("   → trimmed company lists to top-3");
    return trimmed;
  }

  // Step 2: collapse company section to a pointer to the dashboard
  trimmed = buildLarkCard(trends, weekLabel, upcomingEvents, companyData, { collapseCompany: true });
  console.warn("   → collapsed company section (full detail on dashboard)");
  return trimmed;
}

async function sendToLark(payload, webhook) {
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`Lark error: ${JSON.stringify(json)}`);
  return json;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("🇲🇾 MY Travel Trends Bot starting...");
  const { start, label: weekLabel } = getWeekRange();
  const upcomingEvents = getUpcomingEvents(28);

  console.log(`📅 Week: ${weekLabel}`);
  console.log(`📆 Upcoming events: ${upcomingEvents.length}`);

  const trends = generateTrends(start, upcomingEvents);
  console.log("✅ Market trends generated");

  // Fetch Tableau company data (graceful — won't block the report if it fails)
  console.log("🔌 Fetching Tableau company data...");
  const companyData = await fetchTableauData();
  if (companyData && companyData.domestic) {
    const grains = [companyData.domestic.destinationL1, companyData.domestic.city, companyData.domestic.activity,
                    companyData.crossBorder.destinationL1, companyData.crossBorder.city, companyData.crossBorder.activity];
    const ok = grains.filter(g => g && g.rowCount > 0).length;
    console.log(`✅ Company data: ${ok}/6 breakdowns returned rows`);
  } else {
    console.log("ℹ️  No company data — report will send without it");
  }

  saveDataJson(trends, weekLabel, upcomingEvents, companyData);

  let card = buildLarkCard(trends, weekLabel, upcomingEvents, companyData);
  card = fitCardToLark(card, trends, weekLabel, upcomingEvents, companyData);
  console.log(`📦 Card payload: ${payloadBytes(card)} bytes`);

  for (const webhook of WEBHOOKS) {
    try {
      await sendToLark(card, webhook);
      console.log("✅ Sent to Lark successfully!");
    } catch(e) {
      console.error(`❌ Failed: ${e.message}`);
    }
  }
  console.log("🎉 Done!");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
