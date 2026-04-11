const mongoose = require('mongoose');

// Cache the connection across serverless invocations (warm restarts reuse it)
let cachedConn = null;

const connectDB = async () => {
  // Already connected — reuse
  if (cachedConn && mongoose.connection.readyState === 1) {
    return cachedConn;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    cachedConn = conn;
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return cachedConn;
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // Don't process.exit in serverless — let the request fail gracefully
    throw err;
  }
};

module.exports = connectDB;
