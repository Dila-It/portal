import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const categories = [
  { name: 'AI 工具',   keywords: ['AI', 'agent', 'AI代理', 'claude', 'LLM', 'GPT'] },
  { name: '生產力工具', keywords: ['notion', 'evernote', '數位筆記', 'productivity'] },
  { name: '資安',       keywords: ['資安', '漏洞', 'CVE', 'security', '攻擊'] },
];

await db.collection('portalConfig').doc('newsSettings').set({ categories }, { merge: true });
console.log('Categories saved.');
process.exit(0);
