const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rating: {
      type: Number,
      require: [true, "Please add rating for this review."],
    },
    comment: {
      type: String,
      require: [true, "Please add comment for this review."],
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dao",
    },
    // TODO: can be updated to have dynamic questions
    meta: {
      resonate_vibes_rate: Number,
      onboarding_exp: Number,
      opinions_matter: Number,
      great_org_structure: Number,
      friend_recommend: Number,
      great_incentives: Number,
    },
    vote: {
      up: {
        type: Number,
        default: 0,
      },
      down: {
        type: Number,
        default: 0,
      },
    },

    // NOTE: only for linking oldReviews to new user w/ same discordID
    oldData: {
      user_discord_id: String,
      public_address: String,
      guild_id: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = { Review: mongoose.model("NewReview", reviewSchema) };
