const mongoose = require("mongoose");
require("dotenv").config();

function connectDB() {
  console.log("Connecting to Database");

  mongoose
    .connect(`${process.env.DB_URL}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .catch((error) => console.log("Connection to Database failed", error));
}

module.exports = connectDB;
