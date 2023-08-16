const mongoose = require("mongoose");

const spinStreakPeriodSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      require: [true, "Streak must be linked to a User"],
    },
    startDate: {
      type: Date,
      require: [true, "Start date is required"],
      default: Date.now,
    },
    lastDate: {
      type: Date,
      require: [true, "Last date is required"],
      default: Date.now,
    },
    count: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = {
  SpinStreakPeriod: mongoose.model("spinStreakPeriod", spinStreakPeriodSchema),
};
