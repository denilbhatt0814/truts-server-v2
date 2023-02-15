const mongoose = require("mongoose");
const { XpTxn } = require("./xpTxn");

const referralSchema = new mongoose.Schema(
  {
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please provide which user generated this referral"],
    },
    code: {
      type: String,
      required: [true, "Please provide referral code"],
      unique: true,
    },
    useCount: {
      type: Number,
      default: 0,
    },
    multiplier: {
      type: Number,
      default: 1,
    },
    baseXP: {
      type: Number,
      required: [true, "Please allocate XP for referral"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// hooks
referralSchema.post("updateOne", async function (doc) {
  // update multiplier
  const teirDetail = getReferralTeirDetails(doc);
  if (doc.multiplier != teirDetail.multiplier) {
    doc.multiplier = teirDetail.multiplier;
    await doc.save();
  }
});

function getReferralTeirDetails(doc) {
  const useCount = doc.useCount;
  const teirs = [
    { teir: "COPPER", multiplier: 1.0, useCountForNextTeir: 5 },
    { teir: "BRONZE", multiplier: 1.1, useCountForNextTeir: 15 },
    { teir: "SILVER", multiplier: 1.3, useCountForNextTeir: 30 },
    { teir: "GOLD", multiplier: 1.5, useCountForNextTeir: 50 },
  ];

  for (let i = 0; i < teirs.length; i++) {
    const currentTeir = teirs[i];
    if (useCount < currentTeir.useCountForNextTeir) {
      const useCountForNextTeir = currentTeir.useCountForNextTeir - useCount;
      return {
        teir: currentTeir.teir,
        multiplier: currentTeir.multiplier,
        useCountForNextTeir,
      };
    }
  }
  return {
    teir: "DIAMOND",
    multiplier: 1.7,
    useCountForNextTeir: 0,
  };
}

referralSchema.virtual("tier").get(function () {
  return getReferralTeirDetails(this);
});

referralSchema.methods.calculateXpEarned = async function () {
  const txn = await XpTxn.findOne({
    "reason.tag": "referral",
    "reason.id": this._id.toString(),
  });
  return txn.value;
};

referralSchema.methods.usedByUserID = async function (userID) {
  // TODO: do something with userID
  // create Txn for use of referral code
  await XpTxn.updateOne(
    {
      reason: { tag: "referral", id: this._id.toString() },
      user: mongoose.Types.ObjectId(this.generatedBy),
    },
    {
      $inc: { value: this.baseXP * this.multiplier },
      meta: {
        title: `Referrals via code: ${this.code}}`,
        description: "",
      },
    },
    { upsert: true }
  );

  // update useCount
  await this.model("Referral").updateOne(
    { _id: this._id },
    { $inc: { useCount: 1 } }
  );
};

module.exports = {
  Referral: mongoose.model("Referral", referralSchema),
};
