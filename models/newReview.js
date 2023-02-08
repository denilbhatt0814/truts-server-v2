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
        count: Number,
        default: 0,
      },
      down: {
        count: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = { Review: mongoose.model("NewReview", reviewSchema) };
