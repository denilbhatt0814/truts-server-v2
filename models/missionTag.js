const mongoose = require("mongoose");

const missionTagSchema = new mongoose.Schema({
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
  color: {
    rgba: {
      type: [Number],
      validate: {
        validator: (rgbaArray) => {
          if (rgbaArray.length != 4) return false; // must have R-G-B-A
          if (
            !(rgbaArray[0] >= 0 && rgbaArray[0] <= 255) ||
            !Number.isInteger(rgbaArray[0])
          )
            return false; // Red channel range: 0-255
          if (
            !(rgbaArray[1] >= 0 && rgbaArray[1] <= 255) ||
            !Number.isInteger(rgbaArray[1])
          )
            return false; // Green channel range: 0-255
          if (
            !(rgbaArray[2] >= 0 && rgbaArray[2] <= 255) ||
            !Number.isInteger(rgbaArray[2])
          )
            return false; // Blue channel range: 0-255
          if (!(rgbaArray[3] >= 0 && rgbaArray[3] <= 1)) return false; // Alpha channel range: 0-1
          // All good
          return true;
        },
        message: "Please provide a valid URL",
      },
    },
  },
});

module.exports = { MissionTag: mongoose.model("MissionTag", missionTagSchema) };
