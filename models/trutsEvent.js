const mongoose = require("mongoose");

const trutsEventSchema = new mongoose.Schema(
  {
    // TODO: model code goes here
  },
  { timestamps: true }
);

module.exports = {
  TrutsEvent: mongoose.model("TrutsEvent", trutsEventSchema),
};
