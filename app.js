const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");

const cookieParser = require("cookie-parser");
const morgan = require("morgan");

const app = express();

// BASIC SERVER CONFIGS
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ extended: true }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(fileUpload());
// Logging
app.use(morgan("tiny"));

// TEST:
// app.use(function (req, res, next) {
//   res.header("Access-Control-Allow-Origin", "http://localhost:8080");
//   next();
// });

// route imports
const home = require("./routes/home");
const user = require("./routes/user");
const mission = require("./routes/mission");
const taskTemplate = require("./routes/taskTemplate");

// routes middleware
app.use("/api/v1", home);
app.use("/api/v1", user);
app.use("/api/v1", mission);
app.use("/api/v1", taskTemplate);

app.get("/api/v1/status", (req, res) => {
  res.send("Running...");
});

module.exports = app;
