const express = require("express");
const morgan = require("morgan");

const app = express();

// BASIC SERVER CONFIGS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Logging
app.use(morgan("tiny"));

// route imports
const home = require("./routes/home");
const user = require("./routes/user");

// routes middleware
app.use("/api/v1", home);
app.use("/api/v1", user);

module.exports = app;
