const mongoose = require("mongoose");

const spinHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "A spin history must be linked with a user"],
    },
    // Somehting related to reward over here
    reward: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SpinReward",
      required: [true, "A user must be rewarded something for a spin"],
    },
  },
  { timestamps: { createdAt: "spinnedAt" } }
);

module.exports = {
  SpinHistory: mongoose.model("SpinHistory", spinHistorySchema),
};
