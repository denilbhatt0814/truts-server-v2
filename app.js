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
const review = require("./routes/review");
const listing = require("./routes/listing");
const spinWheel = require("./routes/spinWheel");
const admin = require("./routes/admin");
const search = require("./routes/search");
const trutsEvent = require("./routes/trutsEvent");

// routes middleware
app.use("/api/v1", home);
app.use("/api/v1", user);
app.use("/api/v1", mission);
app.use("/api/v1", taskTemplate);
app.use("/api/v1", review);
app.use("/api/v1", listing);
app.use("/api/v1", spinWheel);
app.use("/api/v1", admin);
app.use("/api/v1", search);
app.use("/api/v1", trutsEvent);

app.get("/api/v1/status", (req, res) => {
  res.send("Running...");
});

module.exports = app;
