const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const axios = require("axios").default;
const connectDB = require("./db");
const expressStaticGzip = require("express-static-gzip");
const { xss } = require("express-xss-sanitizer");
const cron = require("node-cron");
const API = require("indian-stock-exchange");
const { parse } = require("json2csv");
const cheerio = require("cheerio");

const { Sgb, Info } = require("./schemas");

const NSEAPI = API.NSE;

require("dotenv").config();

connectDB();

const app = express();

const port = process.env.PORT || 3000;

// parse the updates to JSON
app.use(express.json());
app.use(xss());
app.use(cors());
app.use(morgan("combined"));

app.use(helmet.crossOriginOpenerPolicy({ policy: "same-origin-allow-popups" }));
app.use(helmet.crossOriginResourcePolicy());
app.use(helmet.noSniff());
app.use(helmet.originAgentCluster());
app.use(helmet.ieNoOpen());
app.use(
  helmet.frameguard({
    action: "sameorigin",
  })
);
app.use(helmet.hidePoweredBy());
app.use(helmet.xssFilter());

// Fetch data from NSE
app.get("/api/nse/:symbol", async (req, res) => {
  const { symbol } = req.params;
  // const data = await nseIndia.getEquityDetails(symbol);

  const data = await NSEAPI.getQuoteInfo(symbol);

  // console.log(data.data);

  res.send(data.data);
  // res.send("OK");
});

// Fetch data from NSE with only ask price
app.get("/api/nse/:symbol/bidAskPrice", async (req, res) => {
  const { symbol } = req.params;
  // const data = await nseIndia.getEquityDetails(symbol);

  const data = await NSEAPI.getQuoteInfo(symbol);

  // console.log(data.data.data);

  if (
    data &&
    data.data &&
    data.data.data &&
    data.data.data.length > 0 &&
    data.data.data[0]
  ) {
    const priceData = data.data.data[0];

    const askPrice = !isNaN(parseFloat(priceData.sellPrice1.replace(",", "")))
      ? parseFloat(priceData.sellPrice1.replace(",", ""))
      : parseFloat(priceData.lastPrice.replace(",", ""));

    const bidPrice = !isNaN(parseFloat(priceData.buyPrice1.replace(",", "")))
      ? parseFloat(priceData.buyPrice1.replace(",", ""))
      : parseFloat(priceData.lastPrice.replace(",", ""));

    return res.send(bidPrice + "," + askPrice);
  }

  // res.send(data.data);
  res.send("NO DATA FOUND");
});

// Fetch data from MongoDB for SGB
app.get("/api/sgbs", async (req, res) => {
  const sgbs = await Sgb.find();

  const info = await Info.find();

  let data = getSgbData(sgbs, info);

  res.send({ data, info: info[0] });
});

app.get("/api/sgbs/csv", async (req, res) => {
  const sgbs = await Sgb.find();

  const info = await Info.find();

  let data = getSgbData(sgbs, info);

  const fields = [
    {
      label: "Symbol",
      value: "symbol",
    },
    {
      label: "ISIN",
      value: "isin",
    },
    {
      label: "Issue Price",
      value: "issuePrice",
    },
    {
      label: "Maturity Date",
      value: "maturityDateString",
    },
    {
      label: "Years To Maturity",
      value: "yearsToMaturity",
    },
    {
      label: "Interest Date 1",
      value: "interestDate1String",
    },
    {
      label: "Interest Date 2",
      value: "interestDate2String",
    },
    {
      label: "Interest Payable",
      value: "interestPayable",
    },
    {
      label: "Interest Value",
      value: "interestValue",
    },
    {
      label: "No of Remaining Interest Payments",
      value: "noOfFutureInterestPayments",
    },
    {
      label: "Total Remaining Interest",
      value: "totalRemainingInterest",
    },
    {
      label: "Present Value of Future Interest Payments",
      value: "presentValueDividend",
    },
    {
      label: "Fair Value",
      value: "fairValue",
    },
    {
      label: "Discount to Fair Value",
      value: "discount",
    },
    {
      label: "Discount to Gold Price",
      value: "discountCmp",
    },
    {
      label: "Total Yield to Maturity",
      value: "yield",
    },
  ];

  const opts = { fields };

  try {
    // Generate file name as sgbs_YYYY-MM-DD.csv
    const date = new Date();
    const fileName = `sgbs_${date.getFullYear()}-${
      date.getMonth() + 1
    }-${date.getDate()}.csv`;

    let csv = parse(data, opts);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=" + fileName);
    res.status(200).send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
});

// Update Data for SGBs
app.get("/api/sgbs/update", async (req, res) => {
  const result = await updateData();
  if (result) {
    res.send(result);
  } else {
    res.status(500).send("Failed to update data");
  }
});

app.get(
  "*.*",
  expressStaticGzip("public/client", { serveStatic: { maxAge: "1y" } })
);

// serve frontend paths
app.all("*", function (req, res) {
  res.status(200).sendFile(`/`, { root: "public/client" });
});

// Error Handler
notFound = (req, res, next) => {
  res.status(404);
  const error = new Error("Not Found - " + req.originalUrl);
  next(error);
};

errorHandler = (err, req, res) => {
  res.status(res.statusCode || 500);
  res.json({
    error: err.name,
    message: err.message,
  });
};

app.use(notFound);
app.use(errorHandler);

app.listen(port, async () => {
  console.log(`SGB Discount server is listening on ${port}`);
});

updateData = async () => {
  try {
    console.log("Updating Data Started");

    const sgbs = await Sgb.find();

    // Fetch gold price from https://ibjarates.com/
    const { data: ibjaRatesPage } = await axios.get("https://ibjarates.com");

    const $ = cheerio.load(ibjaRatesPage);

    const goldPriceText = $("#lblrate24K").text();

    const goldPriceInr = parseFloat(goldPriceText.replace(/,/g, ""));

    // console.log({ goldPriceInr });

    let info = await Info.findOne();

    // If no info found, create one
    if (!info) {
      info = {
        goldPriceInr,
      };
    } else {
      info.goldPriceInr = goldPriceInr;
      info.lastUpdatedDate = new Date();
    }

    const data = await Promise.all(
      sgbs.map(async (sgb) => {
        try {
          // const data = await nseIndia.getEquityDetails(sgb.symbol);

          const data = await NSEAPI.getQuoteInfo(sgb.symbol);

          if (
            data &&
            data.data &&
            data.data.data &&
            data.data.data.length > 0 &&
            data.data.data[0]
          ) {
            const priceData = data.data.data[0];

            sgb.issuePrice = parseFloat(priceData.faceValue.replace(",", ""));
            sgb.askPrice = isNaN(
              parseFloat(priceData.sellPrice1.replace(",", ""))
            )
              ? parseFloat(priceData.lastPrice.replace(",", ""))
              : parseFloat(priceData.sellPrice1.replace(",", ""));

            sgb.tradedVolumeValue = isNaN(
              parseFloat(priceData.totalTradedValue.replace(",", ""))
            )
              ? 0
              : parseFloat(priceData.totalTradedValue.replace(",", ""));

            sgb.isin = priceData.isinCode;

            // Calculate years to maturity
            const yearsToMaturity =
              (sgb.maturityDate - Date.now()) / (1000 * 60 * 60 * 24 * 365);

            sgb.yearsToMaturity = yearsToMaturity;

            // console.log({ sgb });

            return sgb;
          } else {
            console.error("No data found for SGB", sgb);
            return null;
          }
        } catch (error) {
          console.error("Error while fetching data for SGB", sgb);
          console.error(error);
          return null;
        }
      })
    );
    // Save info
    info = await Info.create(info);

    await Sgb.bulkSave(data);

    console.log("Updating Data Finished");

    return { info, data };
  } catch (err) {
    console.error(err);
    return null;
  }
};

getSgbData = (sgbs, info) => {
  let data = [];

  for (const sgb of sgbs) {
    const c = (sgb.issuePrice * sgb.interestPayable) / 200;
    const i = info[0].discountRate / 200;
    const n = Math.round(sgb.yearsToMaturity) * 2;

    const presentValueDividend = (c * (1 - (1 + i) ** -n)) / i;

    const fairValue = presentValueDividend + info[0].goldPriceInr;

    const totalRemainingInterest =
      (sgb.issuePrice * (sgb.interestPayable / 2) * n) / 100;

    // Format maturity date to string mm/dd/yyyy in IST time zone
    const maturityDateString = sgb.maturityDate.toLocaleDateString("en-US", {
      timeZone: "Asia/Kolkata",
    });

    const interestDate1String =
      sgb.interestDate1
        .toLocaleString("en-US", {
          timeZone: "Asia/Kolkata",
          month: "long",
          day: "numeric",
        })
        .split(" ")[0] +
      sgb.interestDate1
        .toLocaleString("en-US", {
          timeZone: "Asia/Kolkata",
          month: "long",
          day: "numeric",
        })
        .split(" ")[1];

    const interestDate2String =
      sgb.interestDate2
        .toLocaleString("en-US", {
          timeZone: "Asia/Kolkata",
          month: "long",
          day: "numeric",
        })
        .split(" ")[0] +
      sgb.interestDate2
        .toLocaleString("en-US", {
          timeZone: "Asia/Kolkata",
          month: "long",
          day: "numeric",
        })
        .split(" ")[1];

    let sgbData = {
      symbol: sgb.symbol,
      isin: sgb.isin,
      issuePrice: sgb.issuePrice,
      askPrice: sgb.askPrice,
      tradedVolumeValue: sgb.tradedVolumeValue,
      maturityDate: sgb.maturityDate,
      interestDate1: sgb.interestDate1,
      interestDate2: sgb.interestDate2,
      maturityDateString,
      interestDate1String,
      interestDate2String,
      yearsToMaturity: sgb.yearsToMaturity,
      interestPayable: sgb.interestPayable,
      interestValue: (sgb.issuePrice * sgb.interestPayable) / 200,
      noOfFutureInterestPayments: n,
      totalRemainingInterest,
      presentValueDividend: presentValueDividend,
      fairValue: fairValue,
      discount: (fairValue - sgb.askPrice) / fairValue,
      discountCmp: (info[0].goldPriceInr - sgb.askPrice) / info[0].goldPriceInr,
      yield:
        ((totalRemainingInterest + info[0].goldPriceInr) / sgb.askPrice) **
          (1 / sgb.yearsToMaturity) -
        1,
    };

    data.push(sgbData);
  }
  return data;
};

cron.schedule(
  "0 * * * *",
  async () => {
    console.log("Update data Job");

    try {
      const result = await updateData();
      console.log(result);
    } catch (err) {
      console.error("Error during updating data job", err);
    }

    console.log("Update data finished");
  },
  {
    scheduled: true,
    timezone: "Asia/Kolkata",
  }
);
