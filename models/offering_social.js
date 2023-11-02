const mongoose = require("mongoose");
const supportedPlatforms = [
  "DISCORD",
  "TWITTER",
  "WEBSITE",
  "TELEGRAM",
  "EMAIL",
  "MEDIUM", // substack, medium
];

// Relation: many socials --- (belongs to) --> one offering
const offering_socialSchema = new mongoose.Schema(
  {
    offering: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offering",
      required: [true, "Please link this social to an offering"],
    },
    platform: {
      type: String,
      enum: supportedPlatforms,
      required: [
        true,
        `Please mention social media platform for linking to offering, enums: ${supportedPlatforms}`,
      ],
    },
    link: {
      type: String,
      required: [
        true,
        "Please enter the link to the social media platform that you are trying to add to this offering.",
      ],
      maxLength: [
        100,
        "Length of social media link must be less than 100 characters",
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

// Methods:
offering_socialSchema.statics.transformObjectToArray = function (
  socialsObject,
  offeringID
) {
  console.log("transforming socials", { offeringID });
  return Object.entries(socialsObject).map(([platform, link]) => {
    if (!supportedPlatforms.includes(platform)) {
      throw new Error(`Offering: Platform ${platform} is not supported.`);
    }
    return { platform, link, offering: offeringID };
  });
};

module.exports = {
  Offering_Social: mongoose.model("Offering_Social", offering_socialSchema),
};
