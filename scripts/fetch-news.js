import Parser from 'rss-parser';
import admin from 'firebase-admin';

const RSS_SOURCES = [
  { name: 'iThome',          url: 'https://www.ithome.com.tw/rss' },
  { name: '電腦玩物',         url: 'https://feeds.feedburner.com/playpcesor' },
  { name: 'TechCrunch',      url: 'https://techcrunch.com/feed/' },
  { name: 'Hacker News',     url: 'https://hnrss.org/frontpage' },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/' },
  { name: 'The Verge',       url: 'https://www.theverge.com/rss/index.xml' },
];

async function main() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  // 讀取類別設定與隱藏清單
  const settingsDoc = await db.collection('portalConfig').doc('newsSettings').get();
  const settings    = settingsDoc.exists ? settingsDoc.data() : {};
  const categories  = settings.categories  || [];
  const hiddenLinks = new Set(settings.hiddenLinks || []);
  console.log('Categories:', categories.map(c => c.name));

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
          });
        }
        console.log(`${source.name}: ${feed.items?.length ?? 0} articles`);
      } catch (e) {
        console.warn(`Failed ${source.name}:`, e.message);
      }
    })
  );

  // 自動分類（第一個符合的類別優先，無符合回傳 null）
  function classifyArticle(article) {
    const text = (article.title + ' ' + article.snippet).toLowerCase();
    for (const cat of categories) {
      const keywords = cat.keywords || [];
      if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
        return cat.name;
      }
    }
    return null;
  }

  const hasCategories = categories.length > 0;

  // 去重、過濾已隱藏、分類、無類別時捨棄（有設類別的情況）、按日期排序、取前 40 篇
  const seen = new Set();
  const articles = allArticles
    .filter(a => {
      if (!a.link || seen.has(a.link) || hiddenLinks.has(a.link)) return false;
      seen.add(a.link);
      return true;
    })
    .map(a => ({ ...a, category: classifyArticle(a) }))
    .filter(a => !hasCategories || a.category !== null)
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 40);

  await db.collection('portalConfig').doc('weeklyNews').set({
    articles,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Done: fetched ${allArticles.length}, kept ${articles.length}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
