const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
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
  validationDetails: {
    type: mongoose.Schema.Types.Mixed,
  },
});

const missionSchema = new mongoose.Schema({
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
  community: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Dao",
    required: [
      true,
      "A mission must be linked with a community. Provide communityID",
    ],
  },
  // TODO: If this works well then delete task model
  tasks: [taskSchema],
  communityXP: {
    type: Number,
    required: [true, "Please allocate communityXP to this mission"],
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: Date,
});

missionSchema.pre("save", async function (next) {
  // TODO: sum up truts xp to give community xp
});

module.exports = { Mission: mongoose.model("Mission", missionSchema) };
