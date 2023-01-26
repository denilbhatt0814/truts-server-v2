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
const user_missionSchema = new mongoose.Schema({
  mission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Mission",
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  community: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Dao",
    required: [
      true,
      "A mission must be linked with a community. Provide communityID",
    ],
  },
  /**
   *  NOTE: tasks is mapping of taskID to status
   *  where status is enum: ["INCOMPLETE", "PENDING", "COMPLETE"]
   * eg: { '6ce123ea3': "INCOMPLETE", '2ce857ea4': "COMPLETE"}
   */
  tasks: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  trutsXP: {
    type: Number,
  },
  communityXP: {
    type: Number,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
});

module.exports = {
  User_Mission: mongoose.model("User_Mission", user_missionSchema),
};
