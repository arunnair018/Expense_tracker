const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  try {
    if (!cached.promise) {
      const uri = process.env.MONGODB_URI;

      if (!uri) {
        throw new Error('MONGODB_URI is not defined');
      }

      cached.promise = mongoose.connect(uri, {
        bufferCommands: false,
      });
    }

    cached.conn = await cached.promise;

    console.log(`MongoDB connected: ${cached.conn.connection.host}`);

    return cached.conn;
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    throw err;
  }
};

module.exports = connectDB;