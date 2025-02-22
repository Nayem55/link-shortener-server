const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");

const app = express();
const PORT = 5000;
const MONGO_URI = "mongodb+srv://palash:palash123@cluster0.n2m8y.mongodb.net/?retryWrites=true&w=majority";
const BASE_URL = "https://1clk.xyz/";

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const client = new MongoClient(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

let db;
client
  .connect()
  .then(() => {
    db = client.db("linkShortener");
    console.log("Connected to MongoDB");
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// Use dynamic import for nanoid
async function generateShortId() {
  const { nanoid } = await import("nanoid");
  return nanoid(6);
}

// Shorten URL Endpoint (Ensuring Unique Short Links)
app.post("/shorten", async (req, res) => {
  const { longUrl } = req.body;
  if (!longUrl) return res.status(400).json({ error: "URL is required" });

  try {
    const urlsCollection = db.collection("urls");

    // Check if the URL already exists
    const existingEntry = await urlsCollection.findOne({ longUrl });
    if (existingEntry) {
      return res.json({ shortUrl: `${BASE_URL}/${existingEntry.shortId}` });
    }

    let shortId;
    let isUnique = false;

    // Generate unique shortId
    while (!isUnique) {
      shortId = await generateShortId();
      const existingShort = await urlsCollection.findOne({ shortId });
      if (!existingShort) {
        isUnique = true;
      }
    }

    await urlsCollection.insertOne({ shortId, longUrl, clicks: 0 });

    res.json({ shortUrl: `${BASE_URL}/${shortId}` });
  } catch (error) {
    console.error("Error saving URL:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Redirect Endpoint
app.get("/:shortId", async (req, res) => {
  const { shortId } = req.params;

  try {
    const urlsCollection = db.collection("urls");

    // Find the URL entry
    const urlData = await urlsCollection.findOne({ shortId });

    if (urlData) {
      // Increment the click count
      await urlsCollection.updateOne(
        { shortId },
        { $inc: { clicks: 1 } } // Increase the click count by 1
      );

      // Redirect to the original long URL
      res.redirect(urlData.longUrl);
    } else {
      res.status(404).json({ error: "URL not found" });
    }
  } catch (error) {
    console.error("Error fetching URL:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
