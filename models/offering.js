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
    organization: {
      type: String,
      required: [true, "Offering must be assosicated wiht an organinzation"],
    },
    logo: {
      type: {
        id: { type: String },
        secure_url: {
          type: String,
        },
      },
      default: {
        secure_url: "",
      },
    },
    images: {
      type: [
        {
          id: { type: String },
          secure_url: { type: String },
        },
      ],
      default: [],
    },
    credits: {
      type: Number,
      default: 0,
    },
    tags: {
      type: [{ type: String }],
      required: true,
      validate: {
        validator: (v) => v.length <= 10,
        message: "Tags is over 10",
      },
    },
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
