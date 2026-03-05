'use strict';

const mongoose = require('mongoose');

/**
 * Connect to MongoDB using the URI defined in process.env.MONGO_URI.
 * Logs success or error to the console.
 */
async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not defined in environment variables.');
  }

  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
}

module.exports = connectDB;
