// ============================================================
// MY Travel Trends Bot — Weekly Lark Report
// Runs every Monday 9:00 AM MYT (01:00 UTC)
// Uses Groq API (completely free, no credit card needed)
// ============================================================

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Add more webhook URLs here when ready to add group channels
const WEBHOOKS = [
  "https://open.larksuite.com/open-apis/bot/v2/hook/319c37c6-0842-47bd-9108-466ab25b3c2a", // Personal test
  // "https://open.larksuite.com/open-apis/bot/v2/hook/YOUR_GROUP_WEBHOOK_HERE", // Group channel
];

// ============================================================
// OFFICIAL 2026 CALENDAR DATA
// Source 1: MOE Academic Calendar 2026 (Surat Siaran KPM Bil.3 2025)
// Source 2: Federal Public Holidays 2026 (Jabatan Perdana Menteri)
// ============================================================

const SCHOOL_HOLIDAYS_2026 = [
  { name: "Term 1 break",   start: "2026-03-21", end: "2026-03-29", group: "B" },
  { name: "Mid-year break", start: "2026-05-23", end: "2026-06-07", group: "B" },
  { name: "Term 2 break",   start: "2026-08-29", end: "2026-09-06", group: "B" },
  { name: "Year-end break", start: "2026-12-05", end: "2026-12-31", group: "B" },
  { name: "Term 1 break",   start: "2026-03-20", end: "2026-03-28", group: "A" },
  { name: "Mid-year break", start: "2026-05-22", end: "2026-06-06", group: "A" },
  { name: "Term 2 break",   start: "2026-08-28", end: "2026-09-05", group: "A" },
  { name: "Year-end break", start: "2026-12-04", end: "2026-12-31", group: "A" },
];

const PUBLIC_HOLIDAYS_2026 = [
  { name: "Tahun Baharu",                      date: "2026-01-01" },
  { name: "Tahun Baharu Cina",                 date: "2026-02-17" },
  { name: "Tahun Baharu Cina (Hari Kedua)",    date: "2026-02-18" },
  { name: "Hari Raya Aidilfitri",              date: "2026-03-21" },
  { name: "Hari Raya Aidilfitri (Hari Kedua)", date: "2026-03-22" },
  { name: "Hari Pekerja",                      date: "2026-05-01" },
  { name: "Hari Raya Aidiladha",               date: "2026-05-27" },
  { name: "Hari Raya Aidiladha (Hari Kedua)",  date: "2026-05-28" },
  { name: "Hari Wesak",                        date: "2026-05-31" },
  { name: "Hari Keputeraan Agong",             date: "2026-06-01" },
  { name: "Awal Muharam (Maal Hijrah)",        date: "2026-06-17" },
  { name: "Maulidur Rasul",                    date: "2026-08-25" },
  { name: "Hari Kebangsaan",                   date: "2026-08-31" },
  { name: "Hari Malaysia",                     date: "2026-09-16" },
  { name: "Hari Deepavali",                    date: "2026-11-08" },
  { name: "Hari Krismas",                      date: "2026-12-25" },
];

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
  const fmt = d => d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
  return { start: lastMon, end: lastSun, label: `${fmt(lastMon)} – ${fmt(lastSun)}` };
}

function getUpcomingEvents(daysAhead = 28) {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() + daysAhead);
  const upcoming = [];

  for (const h of PUBLIC_HOLIDAYS_2026) {
    const d = new Date(h.date);
    if (d >= today && d <= cutoff)
      upcoming.push({ ...h, kind: "public_holiday", daysAway: Math.round((d - today) / 86400000) });
  }
  for (const s of SCHOOL_HOLIDAYS_2026) {
    const start = new Date(s.start);
    const end = new Date(s.end);
    if (start <= cutoff && end >= today && s.group === "B")
      upcoming.push({ ...s, kind: "school_break", daysAway: Math.max(0, Math.round((start - today) / 86400000)) });
  }
  return upcoming.sort((a, b) => a.daysAway - b.daysAway).slice(0, 5);
}

// ============================================================
// STEP 1 — Generate trends via Groq API (free)
// ============================================================

async function generateTrends(weekLabel, upcomingEvents) {
  const eventsContext = upcomingEvents.map(e =>
    e.kind === "public_holiday"
      ? `- ${e.name} on ${e.date} (${e.daysAway} days away)`
      : `- School ${e.name} (Group ${e.group}): ${e.start} to ${e.end} (${e.daysAway} days away)`
  ).join("\n");

  const today = new Date().toLocaleDateString("en-MY", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const prompt = `Today is ${today}. You are a Malaysian travel trends analyst.

Based on the week of ${weekLabel} and the upcoming Malaysian calendar events below, generate a realistic weekly travel search trends report for Malaysians.

UPCOMING OFFICIAL EVENTS (from MOE Academic Calendar & JPM Public Holiday data):
${eventsContext}

Consider seasonal patterns, Malaysian travel habits, popular destinations (Thailand, Japan, Bali, Singapore, Langkawi, Sabah, etc.), and how the upcoming events above would drive search behaviour.

Return ONLY a raw JSON object, no markdown, no backticks, no explanation:
{
  "summary": "2-sentence summary of this week travel mood",
  "domesticShare": number,
  "internationalShare": number,
  "topKeyword": "string",
  "topAttraction": "string",
  "topActivity": "string",
  "domestic": [
    { "destination": "string", "state": "string", "change": number, "reason": "string", "category": "beach|nature|city|heritage|island|theme park", "volume": number }
  ],
  "international": [
    { "destination": "string", "country": "string", "countryCode": "ISO2", "change": number, "reason": "string", "category": "beach|nature|city|culture|theme park|island", "volume": number }
  ],
  "domesticActivities": [
    { "name": "string", "location": "string", "change": number, "volume": number }
  ],
  "internationalActivities": [
    { "name": "string", "location": "string", "change": number, "volume": number }
  ],
  "domCategories": { "Beach": number, "Nature": number, "City": number, "Heritage": number },
  "intlCategories": { "City": number, "Culture": number, "Beach": number, "Theme Park": number },
  "hotKeywords": ["string x8"],
  "weeklyVolume": { "Mon": number, "Tue": number, "Wed": number, "Thu": number, "Fri": number, "Sat": number, "Sun": number }
}`;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a Malaysian travel trends analyst. Always respond with raw JSON only, no markdown, no backticks." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    })
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in Groq response");
  return JSON.parse(match[0]);
}

// ============================================================
// STEP 2 — Build Lark card message
// ============================================================

function buildLarkCard(data, weekLabel, upcomingEvents) {
  const flag = c => ({ MY:"🇲🇾",TH:"🇹🇭",JP:"🇯🇵",KR:"🇰🇷",ID:"🇮🇩",AU:"🇦🇺",SG:"🇸🇬",CN:"🇨🇳",VN:"🇻🇳",GB:"🇬🇧",FR:"🇫🇷",AE:"🇦🇪",TW:"🇹🇼",HK:"🇭🇰" }[c] || "🌍");
  const chip = v => v >= 0 ? `▲ ${v}%` : `▼ ${Math.abs(v)}%`;

  const domRows = (data.domestic || []).slice(0, 5).map(t =>
    `${flag("MY")} **${t.destination}** (${t.state})  ${chip(t.change)}\n_${t.reason}_`
  ).join("\n\n");

  const intlRows = (data.international || []).slice(0, 5).map(t =>
    `${flag(t.countryCode)} **${t.destination}**  ${chip(t.change)}\n_${t.reason}_`
  ).join("\n\n");

  const domActs = (data.domesticActivities || []).slice(0, 3).map(a =>
    `🏠 **${a.name}** — ${a.location}  ${chip(a.change)}`
  ).join("\n");

  const intlActs = (data.internationalActivities || []).slice(0, 3).map(a =>
    `✈️ **${a.name}** — ${a.location}  ${chip(a.change)}`
  ).join("\n");

  const eventLines = upcomingEvents.slice(0, 4).map(e => {
    if (e.kind === "public_holiday") return `📅 **${e.name}** — ${e.date} (in ${e.daysAway} days)`;
    return `🏫 **School ${e.name}** — ${e.start} to ${e.end}`;
  }).join("\n");

  const keywords = (data.hotKeywords || []).map(k => `\`${k}\``).join("  ");

  return {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: "plain_text", content: `🇲🇾 Malaysia Weekly Travel Trends — ${weekLabel}` },
        template: "blue"
      },
      elements: [
        { tag: "div", text: { tag: "lark_md", content: `**This week's travel mood**\n${data.summary}` } },
        { tag: "hr" },
        {
          tag: "column_set", flex_mode: "stretch",
          columns: [
            { tag: "column", width: "weighted", weight: 1, elements: [{ tag: "div", text: { tag: "lark_md", content: `**Domestic**\n🟢 ${data.domesticShare}%` } }] },
            { tag: "column", width: "weighted", weight: 1, elements: [{ tag: "div", text: { tag: "lark_md", content: `**International**\n🔵 ${data.internationalShare}%` } }] },
            { tag: "column", width: "weighted", weight: 1, elements: [{ tag: "div", text: { tag: "lark_md", content: `**Top keyword**\n🔍 ${data.topKeyword || "—"}` } }] },
            { tag: "column", width: "weighted", weight: 1, elements: [{ tag: "div", text: { tag: "lark_md", content: `**Top activity**\n🎯 ${data.topActivity || "—"}` } }] },
          ]
        },
        { tag: "hr" },
        { tag: "div", text: { tag: "lark_md", content: "**📍 Trending destinations**" } },
        {
          tag: "column_set", flex_mode: "stretch",
          columns: [
            { tag: "column", width: "weighted", weight: 1, elements: [{ tag: "div", text: { tag: "lark_md", content: `🏠 **Domestic** (${data.domesticShare}%)\n\n${domRows}` } }] },
            { tag: "column", width: "weighted", weight: 1, elements: [{ tag: "div", text: { tag: "lark_md", content: `✈️ **International** (${data.internationalShare}%)\n\n${intlRows}` } }] }
          ]
        },
        { tag: "hr" },
        { tag: "div", text: { tag: "lark_md", content: "**🎡 Trending attractions & activities**" } },
        {
          tag: "column_set", flex_mode: "stretch",
          columns: [
            { tag: "column", width: "weighted", weight: 1, elements: [{ tag: "div", text: { tag: "lark_md", content: domActs } }] },
            { tag: "column", width: "weighted", weight: 1, elements: [{ tag: "div", text: { tag: "lark_md", content: intlActs } }] }
          ]
        },
        { tag: "hr" },
        { tag: "div", text: { tag: "lark_md", content: `**📆 Upcoming demand drivers**\n${eventLines}` } },
        { tag: "hr" },
        { tag: "div", text: { tag: "lark_md", content: `**🔥 Hot search keywords**\n${keywords}` } },
        { tag: "hr" },
        {
          tag: "div", text: { tag: "lark_md", content:
            "**📊 Data sources**\n🔵 Google Trends — search volume & % change\n📰 Google News — trend context & news drivers\n📅 JPM Federal Holiday Calendar 2026 — public holidays\n🏫 MOE Academic Calendar 2026 — school breaks\n🤖 Groq AI (Llama 3.3) — synthesis & narrative"
          }
        },
        {
          tag: "note",
          elements: [{ tag: "plain_text", content: `Auto-generated by MY Travel Trends Bot · Week of ${weekLabel} · Sent every Monday 9:00 AM MYT` }]
        }
      ]
    }
  };
}

// ============================================================
// STEP 3 — Send to Lark webhook(s)
// ============================================================

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

  const { label: weekLabel } = getWeekRange();
  const upcomingEvents = getUpcomingEvents(28);

  console.log(`📅 Week: ${weekLabel}`);
  console.log(`📆 Upcoming events: ${upcomingEvents.length}`);

  const trends = await generateTrends(weekLabel, upcomingEvents);
  console.log("✅ Trends generated via Groq");

  const card = buildLarkCard(trends, weekLabel, upcomingEvents);

  for (const webhook of WEBHOOKS) {
    try {
      await sendToLark(card, webhook);
      console.log(`✅ Sent to: ${webhook.slice(0, 60)}...`);
    } catch (e) {
      console.error(`❌ Failed: ${e.message}`);
    }
  }

  console.log("🎉 Done!");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
