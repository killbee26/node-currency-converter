const express = require("express");
const path = require("path");
const axios = require("axios");
const redis = require("redis");
const bodyParser = require("body-parser");
const session = require("express-session");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: true,
  })
);

const client = redis.createClient({
  username: "default",
  password: "zfpF8rY8RRcsyYfkcodldg7XDgaWTPHJ",
  socket: {
    host: "redis-14593.c266.us-east-1-3.ec2.redns.redis-cloud.com",
    port: 14593,
  },
});

client.connect();
client.on("connect", () => {
  console.log(`Connected to Redis`);
});
client.on("error", (err) => {
  console.log(`Redis Error: ${err}`);
});

// Serve Login Page
app.get("/", (req, res) => {
  if (req.session.loggedIn) {
    res.sendFile(path.join(__dirname, "public", "home.html"));
  } else {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  }
});

// Handle Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "password") {
    req.session.loggedIn = true;
    req.session.username = username;
    res.sendFile(path.join(__dirname, "public", "home.html"));
  } else {
    res.send("<h2>Invalid credentials! <a href='/'>Try again</a></h2>");
  }
});

// Logout
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// Rate API
app.get("/rate/latest", async (req, res) => {
  if (!req.session.loggedIn) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const url = `http://data.fixer.io/api/latest?access_key=24fbf853486f2b241ebc8fc73ad496e8`;
  const countKey = `EUR:latest:count`;
  const ratesKey = `EUR:latest:rates`;

  try {
    const count = await client.incr(countKey);
    const cachedRates = await client.hGetAll(ratesKey);
    if (Object.keys(cachedRates).length > 0) {
      return res.json({ source: "cache", rates: cachedRates, count });
    }

    const response = await axios.get(url);
    if (response.data && response.data.rates) {
      await client.hSet(ratesKey, response.data.rates);
      return res.json({
        source: "api",
        rates: response.data.rates,
        count,
      });
    } else {
      return res.status(500).json({ error: "Failed to fetch rates" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// Run app
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`App running at http://localhost:${port}`);
});
