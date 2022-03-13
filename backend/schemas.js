const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// SGB Schema
const sgb = new Schema({
  symbol: { type: String, required: true },
  isin: { type: String },
  issuePrice: { type: Number },
  askPrice: { type: Number },
  tradedVolumeValue: { type: Number },
  yearsToMaturity: { type: Number },
  maturityDate: { type: Date, default: Date.now },
  interestPayable: { type: Number, default: 2.5 },
});

const Sgb = mongoose.model("Sgb", sgb, "sgbs");

// Info Schema
const info = new Schema({
  goldPriceInr: { type: Number },
  discountRate: { type: Number, default: 6 },
  lastUpdatedDate: { type: Date, default: Date.now },
});

const Info = mongoose.model("Info", info, "info");

module.exports = {
  Sgb,
  Info,
};
