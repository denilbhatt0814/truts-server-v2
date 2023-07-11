const mongoose = require("mongoose");

const spinRewardSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name for the spin reward"],
    },
    allocatorTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SpinRewardTemplate",
      required: [true, "A spin reward must be linked to a reward allocator"],
    },
    allocationDetails: {
      type: mongoose.Schema.Types.Mixed,
    },
    // TODO: icon
    redirect_url: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = {
  SpinReward: mongoose.model("SpinReward", spinRewardSchema),
};
