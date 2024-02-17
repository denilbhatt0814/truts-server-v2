const mongoose = require("mongoose");

// TODO :add it new file
const reviewFormSchema = new mongoose.Schema({
  prompt: {
    type: String,
    required: [true, "Please enter a prompt for the review"],
  },
});

module.exports = { reviewFormSchema };
