const mongoose = require("mongoose");

const offeringClaimSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please link this claim to an user"],
    },
    offer: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Offering",
        },
      ],
      // validate at max only three offers shall be linked
    },
    truts_link: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = {
  OfferingClaim: mongoose.model("OfferingClaim", offeringClaimSchema),
};
