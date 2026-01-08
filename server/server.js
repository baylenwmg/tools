const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const TIMEOUT = 15000;

app.post("/extract", async (req, res) => {
  const urls = req.body.urls || [];
  const results = [];

  for (const url of urls) {
    try {
      const response = await axios.get(url, {
        timeout: TIMEOUT,
        maxRedirects: 5,
        validateStatus: () => true
      });

      if (response.status >= 400) {
        throw new Error("Fetch error");
      }

      const $ = cheerio.load(response.data);

      results.push({
        URL: url,
        "Meta Title": $("title").first().text().trim(),
        "Meta Description": $('meta[name="description"]').attr("content") || "",
        H1: $("h1").map((_, e) => $(e).text().trim()).get().join("\n"),
        H2: $("h2").map((_, e) => $(e).text().trim()).get().join("\n"),
        Status: "Success"
      });

    } catch (err) {
      results.push({
        URL: url,
        "Meta Title": "",
        "Meta Description": "",
        H1: "",
        H2: "",
        Status: "Failed"
      });
    }
  }

  res.json(results);
});

app.listen(3000, () => {
  console.log("Bulk Meta Extractor backend running on http://localhost:3000");
});
