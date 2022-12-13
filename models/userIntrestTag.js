const mongoose = require("mongoose");

const userIntrestTagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: [50, "tag name should be less than 50"],
  },
  // TODO: add logo url
});

module.exports = mongoose.model("UserIntrestTag", userIntrestTagSchema);
