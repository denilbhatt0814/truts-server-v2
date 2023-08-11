const mongoose = require("mongoose");

const taskFormSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    mission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mission",
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      // TODO: imporve pref by indexing
    },
    formData: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = { TaskForm: mongoose.model("TaskForm", taskFormSchema) };
