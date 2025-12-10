// api/grades_refresh.js
require('dotenv').config();
const { connectToMongo } = require('../lib/mongo');
const { getBrowser } = require('../lib/puppeteerServerless');
const { decrypt } = require('../lib/cryptoUtil');
const mongoose = require('mongoose');

const UNIVERSITY_GRADE_PATH = 'main.php?path=eccbc87e4b5ce2fe28308fd9f2a7baf3';
const UNIVERSITY_DEFICIENCY_PATH = 'main.php?path=e4da3b7fbbce2345d7772b0674a318d5';
const SCRAPE_TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS) || 120000;

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

async function getLoggedInPage(browser, username, password, universityUrl) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(SCRAPE_TIMEOUT_MS);
  await page.goto(universityUrl, { waitUntil: 'networkidle2', timeout: 30_000 });
  await page.type('input[name="ID"]', username);
  await page.type('input[name="PASS"]', password);
  await Promise.all([
    page.click('input[type="image"], input[type="submit"], button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30_000 }).catch(()=>{})
  ]);
  // minimal login failure detection
  const body = (await page.content()).toLowerCase();
  if (body.includes('invalid password') || body.includes('incorrect login') || body.includes('invalid login')) {
    await page.close();
    throw new Error('Invalid username or password.');
  }
  if (body.includes('unable to connect the database') || body.includes('database is not connected')) {
    await page.close();
    throw new Error('University portal is temporarily down (Database Error).');
  }
  const baseUrl = universityUrl.split('/').slice(0, -1).join('/') + '/';
  return { page, baseUrl };
}

async function scrapeAllDataForUser(browser, student) {
  const password = decrypt(student.encryptedPassword);
  const { page, baseUrl } = await getLoggedInPage(browser, student.studentId, password, student.universityUrl);

  // grade page
  await page.goto(baseUrl + UNIVERSITY_GRADE_PATH, { waitUntil: 'networkidle2', timeout: 30_000 });
  const gradeSummary = await page.evaluate(() => {
    const clean = t => (t || "").replace(/\s+/g, " ").trim();
    const result = { student: {}, exemptedCourses: [], gradeSummary: [], summary: { cumulativeGPA: 0 } };
    const infoTable = document.querySelector('img[src*="photo"]')?.closest("table");
    if (infoTable) {
      const cells = [...infoTable.querySelectorAll("td")].map(td => clean(td.innerText));
      result.student = { department: cells[2]||"", program: cells[4]||"", division: cells[6]||"", section: cells[8]||"", fullName: cells[10]||"", studentId: cells[12]||"" };
    }
    const exHeader = [...document.querySelectorAll("strong")].find(s=>s.innerText.includes("Exempted Course"));
    if (exHeader) {
      const exTable = exHeader.closest("table").nextElementSibling;
      const rows = [...exTable.querySelectorAll("tr")].slice(1);
      rows.forEach(r=>{
        const tds = [...r.querySelectorAll("td")].map(x=>clean(x.innerText));
        if (tds.length>=4) result.exemptedCourses.push({ number: tds[0], title: tds[1], code: tds[2], creditHour: tds[3]});
      });
    }
    const tables = [...document.querySelectorAll("table")];
    let current=null;
    tables.forEach((tbl,i)=>{
      const txt = clean(tbl.innerText);
      if (/Year\s+\d+/i.test(txt) && /Semester/i.test(txt)) {
        if (current && current.courses.length>0) result.gradeSummary.push(current);
        const year = txt.match(/Year\s+(\d+)/i)?.[1]||"";
        const sem = txt.match(/Semester\s+([A-Za-z0-9]+)/i)?.[1]||"";
        current = { year, semester: sem, courses: [], semesterGPA: 0, cumulativeGPA: 0 };
        const courseTable = tables[i+1];
        if (courseTable) {
          const rows = [...courseTable.querySelectorAll("tr")].slice(1);
          rows.forEach(r=>{
            const tds = [...r.querySelectorAll("td")].map(x=>clean(x.innerText));
            if (tds.length>=12 && tds[0].length < 15) {
              current.courses.push({ courseCode: tds[0], courseName: tds[1], creditHours: tds[2], grade: tds[3], gradePoints: tds[4], resultColumns: tds.slice(5,10), total: tds[11]});
            }
          });
        }
        const gpaTable = tables[i+2];
        if (gpaTable) {
          const rows = [...gpaTable.querySelectorAll('tr')];
          rows.forEach(r=>{
            const rt = clean(r.innerText);
            const s1 = rt.match(/Semester G\.P\.A.*?([\d.]+)/i);
            const s2 = rt.match(/C\.G\.P\.A.*?([\d.]+)/i);
            if (s1) current.semesterGPA = parseFloat(s1[1]);
            if (s2) { current.cumulativeGPA = parseFloat(s2[1]); result.summary.cumulativeGPA = parseFloat(s2[1]); }
          });
        }
      }
    });
    if (current && current.courses.length>0) result.gradeSummary.push(current);
    return result;
  });

  // deficiency page
  await page.goto(baseUrl + UNIVERSITY_DEFICIENCY_PATH, { waitUntil: 'networkidle2', timeout: 30_000 });
  const deficiency = await page.evaluate(() => {
    const clean = t => (t || "").replace(/\s+/g, " ").trim();
    const result = [];
    const table = document.querySelector('table[border="1"]');
    if (!table) return [];
    const rows = [...table.querySelectorAll('tr')].slice(1);
    const tableText = clean(table.innerText);
    if (tableText.includes("No Deficiency")) return [];
    rows.forEach(r => {
      const tds = [...r.querySelectorAll('td')].map(td => clean(td.innerText));
      if (tds.length >= 4 && tds.some(td => td.length > 0)) {
        result.push({ number: tds[0], courseTitle: tds[1], courseCode: tds[2], creditHour: tds[3] });
      }
    });
    return result;
  });

  const cookies = await page.cookies();
  await page.close();

  return {
    student: gradeSummary.student,
    exemptedCourses: gradeSummary.exemptedCourses,
    gradeSummary: gradeSummary.gradeSummary,
    deficiency,
    summary: gradeSummary.summary,
    cookies
  };
}

module.exports = async (req, res) => {
  try {
    await connectToMongo(process.env.MONGO_URI);
    const { username } = req.body || {};
    if (!username) return res.status(401).json({ error: 'Invalid session or username' });

    const student = await Student.findOne({ studentId: username }).exec();
    if (!student) return res.status(404).json({ error: 'User not found.' });

    // Launch ephemeral browser
    const browser = await getBrowser();
    try {
      const scraped = await scrapeAllDataForUser(browser, student);
      // update DB
      student.scrapedData = scraped;
      student.lastScrapeStatus = 'success';
      student.lastScrapeTimestamp = new Date();
      student.scrapeCookies = scraped.cookies || student.scrapeCookies || [];
      await student.save();

      await browser.close();
      return res.json({ success: true, data: scraped, source: 'live_scrape' });
    } catch (e) {
      try { await browser.close(); } catch (er) {}
      const msg = e.message || String(e);
      if (msg.toLowerCase().includes('university portal is temporarily down') || msg.toLowerCase().includes('database')) {
        return res.status(503).json({ success: false, error: msg, source: 'portal_down' });
      }
      return res.status(500).json({ success: false, error: msg, source: 'scrape_failure' });
    }
  } catch (err) {
    console.error('refresh error', err);
    res.status(500).json({ success: false, error: err.message || 'Internal error' });
  }
};
