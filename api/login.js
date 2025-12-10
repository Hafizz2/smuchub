// api/login.js
require('dotenv').config();
const { connectToMongo } = require('../lib/mongo');
const { getBrowser } = require('../lib/puppeteerServerless');
const { encrypt, decrypt } = require('../lib/cryptoUtil');
const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true, index: true },
  encryptedPassword: { type: String, required: true },
  universityUrl: { type: String, required: true },
  scrapeCookies: { type: Array, default: [] },
  lastScrapeStatus: { type: String, enum: ['success', 'failed', 'pending'], default: 'pending' },
  lastScrapeTimestamp: { type: Date },
  scrapedData: { type: mongoose.Schema.Types.Mixed } 
});
const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);

async function validateCredentialsWithBrowser(username, password, universityUrl) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(universityUrl, { waitUntil: 'networkidle2', timeout: 30_000 });
    await page.type('input[name="ID"]', username);
    await page.type('input[name="PASS"]', password);
    await Promise.all([
      page.click('input[type="image"], input[type="submit"], button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30_000 }).catch(()=>{})
    ]);

    const result = await page.evaluate(() => {
      const clean = t => (t || "").replace(/\s+/g, " ").trim();
      const bodyText = document.body.innerText.toLowerCase();
      if (bodyText.includes('invalid password') || bodyText.includes('incorrect login') || bodyText.includes('invalid login')) {
        return { success: false, error: 'Invalid username or password.' };
      }
      if (bodyText.includes('database is not connected') || bodyText.includes('unable to connect the database')) {
        return { success: false, error: 'University portal is temporarily down (Database Error).' };
      }

      // Try to locate the photo table and extract a student id
      const img = document.querySelector('img[src*="photo"]');
      let actualId = null;
      if (img) {
        const table = img.closest('table');
        if (table) {
          const cells = [...table.querySelectorAll('td')].map(td => clean(td.innerText));
          for (let i = 0; i < cells.length; i++) {
            if (cells[i].toLowerCase().includes('login id') && cells[i+1]) {
              actualId = cells[i+1].match(/[A-Z0-9/]+/i)?.[0] || null;
              break;
            }
          }
        }
      }

      return { success: true, actualStudentId: actualId };
    });

    const cookies = await page.cookies();
    await page.close();
    await browser.close();
    return { ...result, cookies };
  } catch (err) {
    try { await page.close(); } catch (e) {}
    try { await browser.close(); } catch (e) {}
    const msg = (err && err.message) ? err.message : String(err);
    if (msg.toLowerCase().includes('database is not connected')) {
      return { success: false, error: 'University portal is temporarily down (Database Error).' };
    }
    return { success: false, error: 'Failed to contact portal: ' + msg };
  }
}

module.exports = async (req, res) => {
  try {
    await connectToMongo(process.env.MONGO_URI);
    const { username, password, universityUrl } = req.body || {};

    if (!username || !password || !universityUrl) {
      return res.status(400).json({ error: 'Missing credentials or URL' });
    }

    // find existing user
    let student = await Student.findOne({ studentId: username }).exec();

    if (student) {
      // fast login if password matches
      let decrypted;
      try { decrypted = decrypt(student.encryptedPassword); } catch (e) { decrypted = null; }

      if (password === decrypted) {
        return res.json({
          success: true,
          username: student.studentId,
          cachedData: student.scrapedData || null,
          lastScrapeTimestamp: student.lastScrapeTimestamp
        });
      }

      // validate new password against portal
      const result = await validateCredentialsWithBrowser(username, password, universityUrl);
      if (!result.success) {
        return res.status(401).json({ error: result.error });
      }
      // update password & return
      student.encryptedPassword = encrypt(password);
      await student.save();
      return res.json({
        success: true,
        username: student.studentId,
        cachedData: student.scrapedData || null,
        lastScrapeTimestamp: student.lastScrapeTimestamp
      });
    }

    // new user
    const result = await validateCredentialsWithBrowser(username, password, universityUrl);
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    // security checks similar to your original code
    if (!result.actualStudentId || result.actualStudentId.length < 5) {
      return res.status(401).json({ error: 'Login failed. Could not extract confirmed student ID from portal.' });
    }
    if (result.actualStudentId !== username) {
      return res.status(401).json({ error: `Login rejected. Use official Student ID: ${result.actualStudentId}`});
    }

    const newStudent = new Student({
      studentId: username,
      encryptedPassword: encrypt(password),
      universityUrl,
      lastScrapeStatus: 'pending',
      scrapedData: null
    });
    await newStudent.save();

    return res.json({ success: true, username: newStudent.studentId, cachedData: null, lastScrapeTimestamp: null});
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
