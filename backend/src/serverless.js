const path = require('path');
const mongoose = require('mongoose');
const { globSync } = require('glob');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb && cachedDb.readyState === 1) {
    return cachedDb;
  }

  const conn = await mongoose.connect(process.env.DATABASE, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  cachedDb = conn.connection;
  return cachedDb;
}

const modelsDir = path.join(__dirname, 'models');
const modelsFiles = globSync('**/*.js', { cwd: modelsDir });

for (const file of modelsFiles) {
  require(path.join(modelsDir, file));
}

const app = require('./app');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    await connectToDatabase();
    return app(req, res);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
