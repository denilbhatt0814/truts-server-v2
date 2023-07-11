const mongoose = require("mongoose");
const spinRewardAllocators = require("../validators/allocators/spinRewardAllocators");

const spinRewardTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide name for spin reward template"],
    },
    description: {
      type: String,
      required: [
        true,
        "Please provide description for the spin reward template",
      ],
    },
    allocator: {
      type: String,
      required: [
        true,
        "Please mention a allocator for this spin reward template",
      ],
      validate: {
        validator: function (value) {
          let spinRewardAllocator = spinRewardAllocators[value];
          if (!spinRewardAllocator) {
            return false;
          }
          return true;
        },
        message: (props) => `${props.value} is not a spin reward allocator!`,
      },
    },
    alloctionData: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

spinRewardTemplateSchema.pre("save", async function () {
  if (this.allocator) {
    let spinRewardAllocator = spinRewardAllocators[this.allocator];
    if (spinRewardAllocator) {
      this.alloctionData = spinRewardAllocator.parameters;
    }
  }
});

module.exports = {
  SpinRewardTemplate: mongoose.model(
    "SpinRewardTemplate",
    spinRewardTemplateSchema
  ),
};
