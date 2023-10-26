const mongoose = require("mongoose");

const supportedPlatforms = [
  "DISCORD",
  "TWITTER",
  "WEBSITE",
  "TELEGRAM",
  "EMAIL",
  "MEDIUM", // substack, medium
];

const trutsEvent_socialSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrutsEvent",
      required: [true, "Please link this social to an event"],
    },
    platform: {
      type: String,
      enum: supportedPlatforms,
      required: [
        true,
        `Please mention social media platform for linking to listing, enums: ${supportedPlatforms}`,
      ],
    },
    link: {
      type: String,
      required: [
        true,
        "Please enter the link to social media platform that you are trying to add to this event.",
      ],
      maxLength: [
        100,
        "Length of social media link must be less than 100 char",
      ],
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

moduel.exports = {
  TrutsEvent_Social: mongoose.model(
    "TrutsEvent_Social",
    trutsEvent_socialSchema
  ),
};
