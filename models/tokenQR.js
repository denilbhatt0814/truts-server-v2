const mongoose = require("mongoose");

const tempTokenQRSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    attended: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = {
  TempTokenQR: mongoose.model("TempTokenQR", tempTokenQRSchema),
};
