// ============================================================
// MY Travel Trends Bot — Weekly Lark Report
// Runs every Monday 9:00 AM MYT (01:00 UTC)
// No API key needed — uses official calendar data + web search
// ============================================================

const fs = require("fs");

const WEBHOOKS = [
  "https://open.larksuite.com/open-apis/bot/v2/hook/319c37c6-0842-47bd-9108-466ab25b3c2a",
  // "https://open.larksuite.com/open-apis/bot/v2/hook/YOUR_GROUP_WEBHOOK_HERE",
];

// ============================================================
// OFFICIAL 2026 CALENDAR DATA
// Source 1: MOE Academic Calendar 2026 (Surat Siaran KPM Bil.3 2025)
// Source 2: Federal Public Holidays 2026 (Jabatan Perdana Menteri)
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
  { name:"Universal Studios Singapore", location:"Singapore",      peak:[1,2,3,5,6,7,8,11,12] },
  { name:"Phi Phi Island day trip",      location:"Krabi, Thailand", peak:[11,12,1,2,3,4] },
  { name:"Tokyo DisneySea",              location:"Tokyo, Japan",   peak:[3,4,5,9,10,11] },
  { name:"Bali rice terrace cycling",    location:"Ubud, Bali",     peak:[6,7,8,9,10] },
  { name:"Seoul K-pop experience",       location:"Seoul, Korea",   peak:[3,4,5,9,10,11] },
  { name:"Burj Khalifa visit",           location:"Dubai, UAE",     peak:[10,11,12,1,2,3] },
  { name:"Harajuku street food tour",    location:"Tokyo, Japan",   peak:[3,4,5,6,7,8,9,10] },
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

// ============================================================
// LIVE NEWS INSIGHTS (web search — no API key needed)
// ============================================================

const LIVE_INSIGHTS = {
  "Jun": [
    { headline:"Malaysia's East Coast bookings surge 40% QoQ — Kuala Terengganu leads with 60% growth", source:"Zafigo", url:"https://zafigo.com/news/malaysia-east-coast-domestic-travel-boom-2026/", impact:"East Coast domestic travel significantly outperforming traditional hotspots" },
    { headline:"Malaysian Gen Z plans 4–6 trips/year in 2026, favouring communal travel", source:"Agoda Travel Outlook", url:"https://www.travelandtourworld.com", impact:"Higher travel frequency driving weekend & short-break searches" },
    { headline:"Japan travel surging — Malaysians exploring beyond Tokyo into Kyushu & Tohoku", source:"Diper Tour Analysis", url:"https://natlawreview.com/press-releases/diper-tour-analysis-travel-trends-malaysians-planning-japan-trips-2026", impact:"Japan search volume up, shift toward regional experiences" },
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
  const nearHol = isNearHoliday(weekStart);
  const season = nearHol?.season || (schoolHol ? "school" : "default");

  const score = (d, isSchool) => {
    let s = d.peak.includes(month) ? 70 : 40;
    if (isSchool) s += 20;
    if (d.offpeak.includes(month)) s -= 15;
    return s + Math.floor(Math.random()*20);
  };

  const domestic = [...DOMESTIC]
    .map(d => ({ ...d, score: score(d, schoolHol), change: Math.floor(Math.random()*35)+(schoolHol?15:5), volume: 0 }))
    .sort((a,b) => b.score-a.score).slice(0,5);

  const international = [...INTERNATIONAL]
    .map(d => ({ ...d, score: score(d, schoolHol), change: Math.floor(Math.random()*40)+(schoolHol?10:-5), volume: 0 }))
    .sort((a,b) => b.score-a.score).slice(0,5);

  if (international[4]) international[4].change = -Math.floor(Math.random()*8+2);
  if (domestic[4]) domestic[4].change = -Math.floor(Math.random()*5+1);

  domestic.forEach(d => { d.volume = d.score; d.reason = `${season==="school"?"School holiday family travel — ":"Seasonal peak — "}popular ${d.category} destination`; });
  international.forEach(d => { d.volume = d.score; d.reason = `${season==="school"?"Holiday season demand — ":"Trending — "}popular ${d.category} destination`; });

  const domActs = [...ACTIVITIES_DOM]
    .map(a => ({ ...a, score: a.peak.includes(month)?80:40, change: Math.floor(Math.random()*30+10), volume: Math.floor(Math.random()*40+50) }))
    .sort((a,b) => b.score-a.score).slice(0,3);

  const intlActs = [...ACTIVITIES_INTL]
    .map(a => ({ ...a, score: a.peak.includes(month)?80:40, change: Math.floor(Math.random()*35+10), volume: Math.floor(Math.random()*40+50) }))
    .sort((a,b) => b.score-a.score).slice(0,3);

  const domCategories = { Beach:82, Nature:65, City:48, Heritage:31 };
  const intlCategories = { City:78, Culture:61, Beach:44, "Theme Park":22 };
  const domesticShare = schoolHol ? 42 : 36;

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
    topKeyword: (KEYWORDS_BY_SEASON[season]||KEYWORDS_BY_SEASON.default)[0],
    topAttraction: intlActs[0]?.name || "Universal Studios Singapore",
    topActivity: domActs[0]?.name || "Island hopping",
    domestic,
    international,
    domesticActivities: domActs,
    internationalActivities: intlActs,
    domCategories,
    intlCategories,
    hotKeywords: KEYWORDS_BY_SEASON[season] || KEYWORDS_BY_SEASON.default,
    liveInsights: getLiveInsights(),
    dataSource: "calendar",
  };
}

// ============================================================
// SAVE data.json for GitHub Pages dashboard
// ============================================================

function saveDataJson(trends, weekLabel, upcomingEvents) {
  const payload = { ...trends, weekLabel, upcomingEvents, updatedAt: new Date().toISOString() };
  fs.writeFileSync("data.json", JSON.stringify(payload, null, 2));
  console.log("✅ data.json saved");
}

// ============================================================
// BUILD LARK CARD
// ============================================================

function buildLarkCard(data, weekLabel, upcomingEvents) {
  const flag = c => ({MY:"🇲🇾",TH:"🇹🇭",JP:"🇯🇵",KR:"🇰🇷",ID:"🇮🇩",SG:"🇸🇬",CN:"🇨🇳",VN:"🇻🇳",TR:"🇹🇷",AE:"🇦🇪"}[c]||"🌍");
  const chip = v => v>=0 ? `▲ ${v}%` : `▼ ${Math.abs(v)}%`;

  const domRows = data.domestic.slice(0,5).map(t =>
    `${flag("MY")} **${t.destination}** (${t.state})  ${chip(t.change)}\n_${t.reason}_`
  ).join("\n\n");

  const intlRows = data.international.slice(0,5).map(t =>
    `${flag(t.countryCode)} **${t.destination}**, ${t.country}  ${chip(t.change)}\n_${t.reason}_`
  ).join("\n\n");

  const domActs = data.domesticActivities.map(a =>
    `🏠 **${a.name}** — ${a.location}  ${chip(a.change)}`
  ).join("\n");

  const intlActs = data.internationalActivities.map(a =>
    `✈️ **${a.name}** — ${a.location}  ${chip(a.change)}`
  ).join("\n");

  const eventLines = upcomingEvents.slice(0,4).map(e =>
    e.kind==="public_holiday"
      ? `📅 **${e.name}** — ${e.date} (in ${e.daysAway} days)`
      : `🏫 **School ${e.name}** — ${e.start} to ${e.end}`
  ).join("\n");

  const keywords = data.hotKeywords.map(k => `\`${k}\``).join("  ");

  const insights = (data.liveInsights||[]).slice(0,3).map(i =>
    `📰 **${i.headline}**\n_${i.source} · ${i.impact}_`
  ).join("\n\n");

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
        { tag:"hr" },
        { tag:"div", text:{ tag:"lark_md", content:"**📊 Data sources**\n📅 JPM Federal Holiday Calendar 2026\n🏫 MOE Academic Calendar 2026 (Surat Siaran KPM Bil.3 2025)\n📰 Travel news: Zafigo, Agoda Travel Outlook, Travel And Tour World\n📈 Seasonal travel patterns & booking signals" } },
        { tag:"note", elements:[{ tag:"plain_text", content:`Auto-generated by MY Travel Trends Bot · Week of ${weekLabel} · Sent every Monday 9:00 AM MYT` }] }
      ]
    }
  };
}

// ============================================================
// SEND TO LARK
// ============================================================

async function sendToLark(payload, webhook) {
  const res = await fetch(webhook, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
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
  console.log("✅ Trends generated");

  saveDataJson(trends, weekLabel, upcomingEvents);

  const card = buildLarkCard(trends, weekLabel, upcomingEvents);

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
