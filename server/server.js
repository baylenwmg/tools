const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(express.json());

app.post("/extract", async (req, res) => {
  const urls = req.body.urls || [];
  const results = [];

  for (const url of urls) {
    try {
      const r = await axios.get(url, { timeout: 15000 });
      const $ = cheerio.load(r.data);

      results.push({
        URL: url,
        "Meta Title": $("title").first().text().trim(),
        "Meta Description": $('meta[name="description"]').attr("content") || "",
        H1: $("h1").map((_,e)=>$(e).text().trim()).get().join("\n"),
        H2: $("h2").map((_,e)=>$(e).text().trim()).get().join("\n"),
        Status: "Success"
      });
    } catch {
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

app.listen(3000, () => console.log("Server running on :3000"));
