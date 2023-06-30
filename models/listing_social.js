const mongoose = require("mongoose");

const { deleteKeysByPattern } = require("../utils/redisHelper");

const supportedPlatforms = [
  "DISCORD",
  "TWITTER",
  "WEBSITE",
  "TELEGRAM",
  "EMAIL",
  "MEDIUM", // substack, medium
];

// Relation: many social --- (belongs to) --> one listing
const listing_socialSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: [true, "Please link this social to a listing"],
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
        "Please enter the link to social media platform that you are trying to add to this listing.",
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

// Hooks:
listing_socialSchema.post("findOneAndUpdate", async function (doc) {
  try {
    await deleteKeysByPattern("/api/v1/listing*");
  } catch (error) {
    console.log("Listing_Social:POST:findOneAndUpdate: ", error);
  }
});

// Methods:
listing_socialSchema.statics.transformObjectToArray = function (
  socialsObject,
  listingID
) {
  console.log("transforming socials", { listingID });
  return Object.entries(socialsObject).map(([platform, link]) => {
    if (!supportedPlatforms.includes(platform)) {
      throw new Error(`Platform ${platform} is not supported.`);
    }
    return { platform, link, listing: listingID };
  });
};

module.exports = {
  Listing_Social: mongoose.model("Listing_Social", listing_socialSchema),
  supportedPlatforms,
};
