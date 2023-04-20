const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema({
  prompt: {
    type: String,
    required: [true, "Please enter a prompt for the option"],
  },
  id: {
    type: Number,
    required: [true, "Please enter a id for the option"],
    validate: {
      validator: function (id) {
        const options = this.parent().options;
        const index = options.findIndex((option) => option.id === id);
        return index === -1 || options[index]._id.equals(this._id);
      },
      message: (props) =>
        `The id '${props.value}' is already used for another option`,
    },
  },
});

exports.questionSchema = new mongoose.Schema(
  {
    prompt: {
      type: String,
      required: [true, "Please enter a prompt for the question"],
    },
    type: {
      type: String,
      enum: ["SCQ", "MCQ", "TEXT"],
      required: [true, "Please select type of the question"],
    },
    options: {
      type: [optionSchema],
      default: undefined,
    },
    answer: {
      type: String,
      required: [true, "Please provide a appropriate answer"],
      select: false,
      // TODO: can have a validator for answers to be like: `TEXT:Orange`, `SCQ:1`, `MCQ:1,2,3`
    },
    listingXP: {
      type: Number,
      required: [true, "Please allocate listingXP to this task template"],
    },
  },
  {
    timestamps: true,
  }
);
