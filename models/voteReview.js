const mongoose = require("mongoose");

const voteReviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  review: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "NewReview",
  },
  action: {
    type: String,
    enum: ["UP_VOTE", "DOWN_VOTE", "UNVOTE"],
    required: [
      true,
      `Please add action for this vote to review. ["UP_VOTE", "DOWN_VOTE"]`,
    ],
  },
});

module.exports = { VoteReview: mongoose.model("VoteReview", voteReviewSchema) };
