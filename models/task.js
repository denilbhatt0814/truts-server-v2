const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  taskTemplate: {
    type: mongoose.Schema.ObjectId,
    ref: "TaskTemplate",
  },
  name: {
    type: String,
    required: [true, "Please provide name for taskTemplate"],
  },
  description: {
    type: String,
    required: [true, "Please provide description for taskTemplate"],
  },
  // TODO: Shall I add trutsXP here ?
});

module.exports = { Task: mongoose.model("TaskSchema", taskSchema) };
