import Parser from 'rss-parser';
import admin from 'firebase-admin';

const RSS_SOURCES = [
  { name: 'iThome',          url: 'https://www.ithome.com.tw/rss' },
  { name: 'TechCrunch',      url: 'https://techcrunch.com/feed/' },
  { name: 'Hacker News',     url: 'https://hnrss.org/frontpage' },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/' },
  { name: 'The Verge',       url: 'https://www.theverge.com/rss/index.xml' },
];

async function main() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  // 讀取使用者設定的關鍵字
  const settingsDoc = await db.collection('portalConfig').doc('newsSettings').get();
  const keywords = settingsDoc.exists ? (settingsDoc.data().keywords || []) : [];
  console.log('Keywords:', keywords);

  // 並行抓取所有 RSS 來源
  const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
  const allArticles = [];

  await Promise.allSettled(
    RSS_SOURCES.map(async source => {
      try {
        const feed = await parser.parseURL(source.url);
        for (const item of (feed.items || []).slice(0, 30)) {
          allArticles.push({
            title:   (item.title || '').trim(),
            link:    item.link || item.guid || '',
            snippet: (item.contentSnippet || item.summary || '').slice(0, 300).trim(),
            source:  source.name,
            pubDate: item.isoDate || item.pubDate || '',
            summary: null,
          });
        }
        console.log(`${source.name}: ${feed.items?.length ?? 0} articles`);
      } catch (e) {
        console.warn(`Failed ${source.name}:`, e.message);
      }
    })
  );

  // 關鍵字過濾（留空則全部保留）
  const filtered = keywords.length === 0
    ? allArticles
    : allArticles.filter(a => {
        const text = (a.title + ' ' + a.snippet).toLowerCase();
        return keywords.some(kw => text.includes(kw.toLowerCase()));
      });

  // 去重（by link）、按日期排序、取前 30 篇
  const seen = new Set();
  const articles = filtered
    .filter(a => {
      if (!a.link || seen.has(a.link)) return false;
      seen.add(a.link);
      return true;
    })
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 30);

  await db.collection('portalConfig').doc('weeklyNews').set({
    articles,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Done: fetched ${allArticles.length}, kept ${articles.length}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
