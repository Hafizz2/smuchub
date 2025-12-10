// lib/mongo.js
const mongoose = require('mongoose');

let cached = global._mongo || null;

async function connectToMongo(uri) {
  if (cached && mongoose.connection.readyState === 1) {
    return mongoose;
  }
  // use new global cache
  await mongoose.connect(uri, {
    // recommended options are default in mongoose 7+, but keep this flexible
  });
  cached = mongoose;
  global._mongo = cached;
  return mongoose;
}

module.exports = { connectToMongo };
