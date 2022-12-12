const express = require("express");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

const app = express();

// BASIC SERVER CONFIGS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Logging
app.use(morgan("tiny"));

// route imports
const home = require("./routes/home");
const user = require("./routes/user");

// routes middleware
app.use("/api/v1", home);
app.use("/api/v1", user);

module.exports = app;
