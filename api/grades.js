// api/grades.js
require('dotenv').config();
const { connectToMongo } = require('../lib/mongo');
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

module.exports = async (req, res) => {
  try {
    await connectToMongo(process.env.MONGO_URI);
    const { username } = req.body || {};
    if (!username) return res.status(401).json({ error: 'Invalid session or username' });

    const student = await Student.findOne({ studentId: username }).exec();
    if (!student) return res.status(404).json({ error: 'User not found.' });

    if (!student.scrapedData) {
      return res.json({
        success: true,
        data: null,
        error: 'No data available yet. Use Refresh or wait for scheduled run.',
        source: 'cache_empty',
        lastScrapeTimestamp: student.lastScrapeTimestamp
      });
    }
    return res.json({ success: true, data: student.scrapedData, source: 'cache', lastScrapeTimestamp: student.lastScrapeTimestamp });
  } catch (err) {
    console.error('grades error', err);
    res.status(500).json({ success: false, error: err.message || 'Internal error' });
  }
};
