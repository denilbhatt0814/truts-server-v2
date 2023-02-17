const mongoose = require("mongoose");

const xpTxnSchema = new mongoose.Schema(
  {
    reason: {
      tag: {
        type: String,
        required: [true, "Please provide reason tag for the transaction"],
      },
      id: {
        type: String,
        required: [true, "Please provide reason id for the transaction"],
      },
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please link this xp transaction with a user"],
    },
    value: {
      type: Number,
      required: [true, "Please provide xp value for this transaction"],
    },
    meta: {
      title: String,
      description: String,
      data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}, // TODO: check if you want this or not
      },
    },
  },
  { timestamps: true }
);

module.exports = { XpTxn: mongoose.model("XpTxn", xpTxnSchema) };
