const mongoose = require("mongoose");
const validator = require("validator");
const { taskSchema } = require("./taskSchema");
const { questionSchema } = require("./questionSchema");

const missionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name for mission"],
    },
    description: {
      type: String,
      default: "",
    },
    // TODO: must type in creation of mission as well
    // TODO: make assign to all current missions
    // TODO: add visiblity field
    type: {
      type: String,
      enum: ["TASKS", "QUIZ"],
      required: [
        true,
        "Please mention the type of mission. eg: ['TASKS', 'QUIZ']",
      ],
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
    //  If this works well then delete task model
    tasks: { type: [taskSchema], default: undefined },
    questions: {
      type: [questionSchema],
      default: undefined,
    },
    listingXP: {
      type: Number,
      // required: [true, "Please allocate listingXP to this mission"],
      default: 0,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: Date,
    visible: {
      type: Boolean,
      default: false,
    },
    trending: {
      type: Boolean,
      default: false,
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
