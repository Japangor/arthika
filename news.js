/**
 * Finance / markets news aggregator for Arthika.
 *
 * Pulls free public RSS feeds (Moneycontrol, Economic Times, Livemint,
 * Business Standard + Google News) and returns a clean, de-duplicated,
 * date-sorted list. No API keys. Results are cached in-memory for a few
 * minutes so the app and cron stay fast and don't hammer the sources.
 */
const axios = require('axios');

const FEEDS = [
  { source: 'Moneycontrol', url: 'https://www.moneycontrol.com/rss/marketreports.xml' },
  { source: 'Moneycontrol', url: 'https://www.moneycontrol.com/rss/business.xml' },
  { source: 'Economic Times', url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms' },
  { source: 'Livemint', url: 'https://www.livemint.com/rss/markets' },
  { source: 'Business Standard', url: 'https://www.business-standard.com/rss/markets-106.rss' },
  {
    source: 'Google News',
    url: 'https://news.google.com/rss/search?q=when:2d+(nifty+OR+sensex+OR+%22stock+market%22+India)&hl=en-IN&gl=IN&ceid=IN:en',
  },
];

const CACHE_TTL_MS = 10 * 60 * 1000;
let _cache = { at: 0, items: [] };

function decodeEntities(s = '') {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function stripHtml(s = '') {
  return decodeEntities(String(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function pick(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : '';
}

function extractImage(block) {
  const enc = block.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i);
  if (enc) return enc[1];
  const media = block.match(/<media:(?:content|thumbnail)[^>]*url=["']([^"']+)["']/i);
  if (media) return media[1];
  const img = block.match(/<img[^>]*src=["']([^"']+)["']/i);
  if (img) return img[1];
  return '';
}

function parseRss(xml, source) {
  const items = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const title = stripHtml(pick(b, 'title'));
    let link = decodeEntities(pick(b, 'link')).trim();
    if (!link) {
      const guid = pick(b, 'guid');
      if (/^https?:\/\//i.test(guid)) link = decodeEntities(guid).trim();
    }
    if (!title || !link) continue;
    const desc = stripHtml(pick(b, 'description') || pick(b, 'content:encoded'));
    const pub = decodeEntities(pick(b, 'pubDate') || pick(b, 'dc:date')).trim();
    const ts = pub ? Date.parse(pub) : NaN;
    items.push({
      title,
      link,
      source,
      excerpt: desc.slice(0, 240),
      image: extractImage(b),
      pubDate: pub,
      ts: Number.isNaN(ts) ? 0 : ts,
    });
  }
  return items;
}

async function fetchFeed(feed) {
  try {
    const res = await axios.get(feed.url, {
      timeout: 9000,
      responseType: 'text',
      headers: { 'User-Agent': 'ArthikaNewsBot/1.0 (+https://arthika.rail24.in)' },
      validateStatus: (s) => s >= 200 && s < 400,
    });
    return parseRss(String(res.data), feed.source);
  } catch (_) {
    return [];
  }
}

/** Aggregated, de-duplicated, date-sorted finance headlines. */
async function getNews(limit = 40) {
  if (Date.now() - _cache.at < CACHE_TTL_MS && _cache.items.length) {
    return _cache.items.slice(0, limit);
  }
  const all = (await Promise.all(FEEDS.map(fetchFeed))).flat();
  const seen = new Set();
  const out = [];
  for (const it of all) {
    const key = it.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  out.sort((a, b) => b.ts - a.ts);
  if (out.length) _cache = { at: Date.now(), items: out };
  return out.slice(0, limit);
}

module.exports = { getNews };
