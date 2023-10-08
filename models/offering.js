const mongoose = require("mongoose");

const offeringSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name for the offering"],
    },
    description: {
      type: String,
      default: "",
    },
    logo: {
      id: { type: String },
      secure_url: {
        type: String,
      },
      required: [true, "Please associate a logo to this offering"],
    },
    images: [
      {
        id: { type: String },
        secure_url: { type: String },
      },
    ],
    credits: {
      type: Number,
      default: 0,
    },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "OfferingTag",
      },
    ],
    visible: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = {
  Offering: mongoose.model("Offering", offeringSchema),
};
