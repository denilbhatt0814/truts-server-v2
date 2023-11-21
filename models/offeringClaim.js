const mongoose = require("mongoose");

const offeringClaimSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please link this claim to an user"],
    },
    offers: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Offering",
        },
      ],
      validate: {
        validator: function (v) {
          return v.length <= 3;
        },
        message: "You can link a maximum of 3 offers only.",
      },
    },
    truts_link: {
      type: String,
      maxLength: [150, "Your link seems to be too long"],
    },
  },
  { timestamps: true }
);

module.exports = {
  OfferingClaim: mongoose.model("OfferingClaim", offeringClaimSchema),
};
