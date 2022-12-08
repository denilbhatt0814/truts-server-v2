const express = require("express");
const morgan = require("morgan");

const app = express();

// BASIC SERVER CONFIGS
app.use(express.json());

// Logging
app.use(morgan("tiny"));

// route imports
const home = require("./routes/home");

// routes middleware
app.use("/api/v1", home);

module.exports = app;
