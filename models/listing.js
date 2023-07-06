const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const validator = require("validator");
const { deleteKeysByPattern } = require("../utils/redisHelper");

const listingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide name for the listing"],
    },
    type: {
      type: String,
      enum: ["COMMUNITY", "PROJECT", "CHAIN"], // investors
      default: "PROJECT",
    },
    oneliner: {
      type: String,
    },
    description: {
      type: String,
    },
    // TODO: need a slug generator
    slug: {
      type: String,
      required: [true, "Please provide slug for the lisitng"],
      unique: [true, , "The provided slug already exists"],
    },
    // TODO: could be modified to use new collection
    chains: {
      type: [{ type: String }],
      required: true,
      validate: {
        validator: (v) => v.length <= 10,
        message: "Chains is over 10",
      },
    },
    // TODO: could be modified to use new collection
    categories: {
      type: [{ type: String }],
      required: true,
      validate: {
        validator: (v) => v.length <= 10,
        message: "Categories is over 10",
      },
    },
    // Bachta hai: questions for reviews,
    photo: {
      logo: {
        id: { type: String },
        secure_url: { type: String, default: "https://truts.xyz/blue.png" },
      },
      cover: {
        id: { type: String },
        secure_url: {
          type: String,
          default:
            "https://truts-listings.s3.ap-south-1.amazonaws.com/random-5.webp",
        },
      },
    },
    meta: {
      // TODO: auto updates for these
      twitter_followers: {
        type: Number,
        default: 0,
      },
      discord_members: {
        type: Number,
        default: 0,
      },
      select: false,
    },
    reviews: {
      rating: { type: Number, default: 0 },
      count: {
        type: Number,
        default: 0,
      },
      meta: {
        resonate_vibes_rate: { type: Number, default: 0 },
        onboarding_exp: { type: Number, default: 0 },
        opinions_matter: { type: Number, default: 0 },
        great_org_structure: { type: Number, default: 0 },
        friend_recommend: { type: Number, default: 0 },
        great_incentives: { type: Number, default: 0 },
      },
    },
    visible: {
      type: Boolean,
      default: false,
    },
    verified: {
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
      submitterIsRewarded: {
        type: Boolean,
      },
      verifiedAt: {
        type: Date,
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Can make socials as virtual field
listingSchema.virtual("socials", {
  ref: "Listing_Social", // The model to use
  localField: "_id", // The localField in Listing for ref
  foreignField: "listing", // is equal to `listing` field in Listing_Social
  justOne: false, // And get all the socials of the listing
});

// Hooks for listing
listingSchema.post("findOneAndUpdate", async function (doc) {
  try {
    await deleteKeysByPattern("/api/v1/listing*");
  } catch (error) {
    console.log("Listing:POST:findOneAndUpdate: ", error);
  }
});

// Methods for listing

listingSchema.statics.isSlugAvailable = async function (slug) {
  const existingListing = await this.findOne({ slug });
  console.log({ existingListing });
  return existingListing
    ? false // if listing exists then slug not available
    : true; // else available
};

listingSchema.statics.generateSlug = async function (name) {
  let baseSlug = slugify(name, {
    lower: true,
    replacement: "_",
    remove: /[*+~.()'"!:@]/g,
  });
  let suffix = 0;
  let slug = baseSlug;
  console.log({ slug });
  while (true) {
    const available = await this.isSlugAvailable(slug);
    console.log({ available });
    if (available) {
      return slug;
    }
    slug = `${baseSlug}_${++suffix}`;
  }
};

module.exports = { Listing: mongoose.model("Listing", listingSchema) };
