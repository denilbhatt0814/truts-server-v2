const mongoose = require("mongoose");

const spinWheelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name for the spin reward"],
    },
    rewards: {
      type: [
        {
          reward: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SpinReward",
            required: [true, "Please link a reward to this slot"],
          },
          odds: {
            type: Number,
            select: false,
            validate: {
              validator: function (value) {
                return value >= 0 && value <= 100;
              },
              message: (props) =>
                `${props.value} is not a valid odds value! Odds should be between 0 and 100.`,
            },
            required: [true, "Please provide odds for the reward"],
          },
          slot: {
            type: Number,
            required: [true, "Please assign a slot for this reward"],
          },
        },
      ],
    },
    // TODO: this live tag must be removed later and dependece should be on date
    isLive: {
      type: Boolean,
      default: false,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: Date,
  },
  { timestamps: true }
);

module.exports = {
  SpinWheel: mongoose.model("SpinWheel", spinWheelSchema),
};
