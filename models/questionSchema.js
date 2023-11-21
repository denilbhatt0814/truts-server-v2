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
      enum: ["SCQ", "MCQ", "TEXT", "SLIDE"],
      required: [
        true,
        "Please select type of the question. [SCQ, MCQ, TEXT, SLIDE]",
      ],
    },
    options: {
      type: [optionSchema],
      default: undefined,
    },
    answer: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "Please provide a appropriate answer"],
      select: false,
      // String for Text, Int for SCQ and int[] for MCQ
    },
    listingXP: {
      type: Number,
      required: [true, "Please allocate listingXP to this question"],
    },
    sequenceNum: {
      type: Number,
      required: [
        true,
        "Please allocate appropriate sequence number to this question",
      ],
    },
  },
  {
    timestamps: true,
  }
);
