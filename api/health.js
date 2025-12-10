// api/health.js
require('dotenv').config();
const { connectToMongo } = require('../lib/mongo');

module.exports = async function handler(req, res) {
  try {
    const mongoose = await connectToMongo(process.env.MONGO_URI);
    res.status(200).json({
      ok: true,
      mongoConnected: mongoose.connection.readyState === 1,
      now: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
