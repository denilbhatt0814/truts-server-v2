const mongoose = require("mongoose");

const missionTagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: [50, "tag name should be less than 50"],
  },
  // TODO: add logo url
});

module.exports = { MissionTag: mongoose.model("MissionTag", missionTagSchema) };
