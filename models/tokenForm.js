const mongoose = require("mongoose");

const tempTokenFormSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    response: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

module.exports = {
  TempTokenForm: mongoose.model("TempTokenForm", tempTokenFormSchema),
};
