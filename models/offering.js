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
      required: [true, "Offering must be assosicated with an organinzation"],
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
    submission: {
      type: {
        type: String,
        enum: ["USER", "AUTO"],
        default: "USER",
      },
      submitter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      verifiedAt: {
        type: Date,
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      select: false,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Can make socials as virtual field
offeringSchema.virtual("socials", {
  ref: "Offering_Social", // The model to use
  localField: "_id", // The localField in Listing for ref
  foreignField: "offering", // is equal to `listing` field in Listing_Social
  justOne: false, // And get all the socials of the listing
});

module.exports = {
  Offering: mongoose.model("Offering", offeringSchema),
};
