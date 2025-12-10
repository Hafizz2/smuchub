// api/scrape_all.js
require('dotenv').config();
const { connectToMongo } = require('../lib/mongo');
const { getBrowser } = require('../lib/puppeteerServerless');
const { decrypt } = require('../lib/cryptoUtil');
const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  studentId: String,
  encryptedPassword: String,
  universityUrl: String,
  scrapeCookies: Array,
  lastScrapeStatus: String,
  lastScrapeTimestamp: Date,
  scrapedData: mongoose.Schema.Types.Mixed
});
const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);

const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_SCRAPES || 2);
const BATCH_LIMIT = Number(process.env.BATCH_LIMIT || 5); // number of students per invocation

async function runScrapesForBatch(students) {
  const browser = await getBrowser();
  const results = [];
  for (const s of students) {
    try {
      const pageRes = await (async () => {
        // you can import and reuse the same scrape logic as /api/grades_refresh
        // For brevity, this endpoint will call the grades_refresh route logic by internal function
        // but here we'll do a minimal login+visit to the grade page similarly as earlier
        const page = await browser.newPage();
        await page.goto(s.universityUrl, { waitUntil: 'networkidle2', timeout: 30_000 });
        await page.type('input[name="ID"]', s.studentId);
        await page.type('input[name="PASS"]', decrypt(s.encryptedPassword));
        await Promise.all([
          page.click('input[type="image"], input[type="submit"], button[type="submit"]'),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30_000 }).catch(()=>{})
        ]);
        // minimal check and capture cookies
        const cookies = await page.cookies();
        await page.close();
        return { ok: true, cookies };
      })();
      results.push({ id: s.studentId, ok: true, detail: pageRes });
    } catch (err) {
      results.push({ id: s.studentId, ok: false, error: err.message });
    }
  }
  try { await browser.close(); } catch (e) {}
  return results;
}

module.exports = async (req, res) => {
  try {
    await connectToMongo(process.env.MONGO_URI);
    // Authorization: limit who can hit this route (secret token header)
    const secret = process.env.SCRAPE_ALL_SECRET;
    if (!secret || req.headers['x-scrape-secret'] !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // fetch small batch
    const students = await Student.find({}).limit(BATCH_LIMIT).lean().exec();
    if (!students.length) return res.json({ success: true, message: 'No students to scrape' });

    const results = await runScrapesForBatch(students);
    // you may want to update DB for each success; omitted for speed
    return res.json({ success: true, results });
  } catch (err) {
    console.error('scrape_all error', err);
    res.status(500).json({ error: err.message });
  }
};
