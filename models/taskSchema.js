const mongoose = require("mongoose");

exports.taskSchema = new mongoose.Schema(
  {
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
  },
  {
    timestamps: true,
  }
);
