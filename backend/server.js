const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const axios = require("axios").default;
const { NseIndia } = require("stock-nse-india");
const connectDB = require("./db");
const yahooFinance = require("yahoo-finance");
const expressStaticGzip = require("express-static-gzip");
const { xss } = require("express-xss-sanitizer");
const cron = require("node-cron");

const { Sgb, Info } = require("./schemas");

const nseIndia = new NseIndia();

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
  const data = await nseIndia.getEquityDetails(symbol);
  res.send(data);
});

// Fetch data from MongoDB for SGB
app.get("/api/sgbs", async (req, res) => {
  const sgbs = await Sgb.find();

  const info = await Info.find();

  let data = [];

  for (const sgb of sgbs) {
    const c = (sgb.issuePrice * sgb.interestPayable) / 200;
    const i = info[0].discountRate / 200;
    const n = sgb.yearsToMaturity * 2;

    const presentValueDividend = ((c * (1 - (1 + i) ** -n)) / i) * (1 + i);

    const fairValue = presentValueDividend + info[0].goldPriceInr;

    let sgbData = {
      symbol: sgb.symbol,
      issuePrice: sgb.issuePrice,
      lastPrice: sgb.lastPrice,
      maturityDate: sgb.maturityDate,
      yearsToMaturity: sgb.yearsToMaturity,
      interestPayable: sgb.interestPayable,
      presentValueDividend: presentValueDividend,
      fairValue: fairValue,
      discount: fairValue / sgb.lastPrice - 1,
      yield: (sgb.issuePrice * sgb.interestPayable) / sgb.lastPrice,
    };

    data.push(sgbData);
  }
  res.send({ data, info: info[0] });
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
    const sgbs = await Sgb.find();

    // Get gold price
    const gold = await yahooFinance.quote({
      symbol: "GC=F",
      modules: ["price"],
    });
    const usdInr = await yahooFinance.quote({
      symbol: "INR=X",
      modules: ["price"],
    });

    const goldPrice = gold.price.regularMarketPrice;
    const usdInrPrice = usdInr.price.regularMarketPrice;

    console.log({ goldPrice, usdInrPrice });

    let info = await Info.findOne();

    // If no info found, create one
    if (!info) {
      info = {
        goldPriceUsd: goldPrice,
        goldPriceInr: (goldPrice * usdInrPrice * 1.1) / 31.1035,
        usdInrPrice,
      };
    } else {
      info.goldPriceUsd = goldPrice;
      info.goldPriceInr = (goldPrice * usdInrPrice * 1.1) / 31.1035;
      info.usdInrPrice = usdInrPrice;
      info.lastUpdatedDate = new Date();
    }

    const data = await Promise.all(
      sgbs.map(async (sgb) => {
        try {
          const data = await nseIndia.getEquityDetails(sgb.symbol);

          if (data) {
            sgb.issuePrice = data.securityInfo.faceValue;
            sgb.lastPrice = data.priceInfo.lastPrice;

            // Calculate years to maturity
            const yearsToMaturity =
              (sgb.maturityDate - Date.now()) / (1000 * 60 * 60 * 24 * 365);

            sgb.yearsToMaturity = yearsToMaturity;

            return sgb;
          } else {
            console.error("No data found for SGB", sgb);
            return null;
          }
        } catch (error) {
          console.error("Error while fetching data for SGB", sgb);
          console.log(error);
          return null;
        }
      })
    );
    // Save info
    info = await Info.create(info);

    await Sgb.bulkSave(data);

    return { info, data };
  } catch (err) {
    console.error(err);
    return null;
  }
};

cron.schedule(
  "0 * * * *",
  async () => {
    console.log("Update data Job");

    try {
      const result = await updateData();
      console.log(result);
    } catch (err) {
      console.error("Error while updating data", err);
    }
  },
  {
    scheduled: true,
    timezone: "Asia/Kolkata",
  }
);
