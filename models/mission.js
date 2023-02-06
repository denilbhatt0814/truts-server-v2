const mongoose = require("mongoose");
const validator = require("validator");

const taskSchema = new mongoose.Schema({
  stepNum: {
    type: Number,
    required: [true, "Please provide a step number to this task"],
  },
  taskTemplate: {
    type: mongoose.Schema.ObjectId,
    ref: "TaskTemplate",
  },
  name: {
    type: String,
    required: [true, "Please provide name for task"],
  },
  description: {
    type: String,
    required: [true, "Please provide description for task"],
  },
  redirect_url: {
    type: String,
    validate: {
      validator: (value) => validator.isURL(value),
      message: "Please provide a valid URL",
    },
  },
  validationDetails: {
    type: mongoose.Schema.Types.Mixed,
  },
});

const missionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name for mission"],
    },
    description: {
      type: String,
      required: [true, "Please provide a description for mission"],
    },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MissionTag",
      },
    ],
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dao",
      required: [
        true,
        "A mission must be linked with a listing. Provide listingID",
      ],
    },
    // TODO: If this works well then delete task model
    tasks: [taskSchema],
    listingXP: {
      type: Number,
      required: [true, "Please allocate listingXP to this mission"],
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: Date,
    visible: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

missionSchema.pre("save", async function (next) {
  // TODO: sum up truts xp to give listing xp
});

module.exports = { Mission: mongoose.model("Mission", missionSchema) };
