const mongoose = require("mongoose");

const userIntrestTagSchema = new mongoose.Schema({
  // TODO: MAKE APIs FOR CREATING TAGS
  name: {
    type: String,
    required: true,
    maxlength: [50, "tag name should be less than 50"],
  },
  logo: {
    id: { type: String },
    secure_url: { type: String },
  },
});

module.exports = mongoose.model("UserIntrestTag", userIntrestTagSchema);
