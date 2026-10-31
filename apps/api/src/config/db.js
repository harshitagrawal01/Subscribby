const mongoose = require("mongoose");
const env = require("./env");

async function connectDB(uri = env.MONGODB_URI) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  return mongoose.connection;
}

module.exports = { connectDB };
