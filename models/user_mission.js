const mongoose = require("mongoose");

const completedTaskSchema = new mongoose.Schema({
  taskID: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, "Please provide taskID of completed task"],
  },
  status: {
    type: String,
    enum: ["COMPLETE", "INCOMPLETE", "PENDING"],
    default: "INCOMPLETE",
  },
});

// Realtion : user -- (Attempted) --> mission
const user_missionSchema = new mongoose.Schema(
  {
    mission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mission",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dao",
      required: [
        true,
        "A mission must be linked with a listing. Provide listingID",
      ],
    },
    /**
     *  NOTE: tasks is mapping of taskID to status
     *  where status is enum: ["INCOMPLETE", "PENDING", "COMPLETE"]
     * eg: { '6ce123ea3': "INCOMPLETE", '2ce857ea4': "COMPLETE"}
     */
    tasks: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    trutsXP: {
      type: Number,
    },
    listingXP: {
      type: Number,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = {
  User_Mission: mongoose.model("User_Mission", user_missionSchema),
};
