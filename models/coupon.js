const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, "Please provide code for coupon"],
  },
  collectionID: {
    type: String,
    default: "DEFAULT",
  },
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Listing",
    required: [
      true,
      "A coupon must be linked with a listing. Provide listingID",
    ],
  },
  claimed: {
    type: Boolean,
    default: false,
  },
  claimedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  validity: {
    type: Date,
  },
  visible: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("Coupon", couponSchema);
