const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const { JWT_SECRET, JWT_EXPIRY } = require("../config/config");
const {
  refreshToken,
  getUserDetails,
  getUserGuilds,
} = require("../utils/discordHelper");
const { User_Mission } = require("./user_mission");
const { XpTxn } = require("./xpTxn");
const wallet = require("./wallet");
const { Referral } = require("./referral");

/**
 * NOTE: If any new field is added or updated in userSchema
 *      calculateProfileCompletion Fn() must be modified for accurate response
 */

const walletSchema = new mongoose.Schema({
  chain: {
    type: String,
    enum: ["EVM", "SOL"],
  },
  address: {
    type: String,
    required: true,
  },
  visible: {
    type: Boolean,
    default: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  nonce: String,
  // tokenExpiry: Date,
  // TODO: primary - flag
});

const guildSchema = new mongoose.Schema({
  id: {
    type: String,
    // NOTE: This unique creates an index in DB on collection initialization : remove it if it causes errors
    unique: [true, "user already is linked to this guild"],
    required: [true, "missing guild id"],
  },
  name: String,
  owner: Boolean,
  permissions: String,
});

const discordSchema = new mongoose.Schema({
  id: {
    type: String,
    // required: true,
    unique: true,
    sparse: true,
  },
  username: String,
  discriminator: String,
  email: String,
  access_token: {
    type: String,
    required: true,
    select: false,
  },
  refresh_token: {
    type: String,
    required: true,
    select: false,
  },
  token_expiry: Date,
  guilds: {
    type: [guildSchema],
    select: false,
  },
});

const twitterSchema = new mongoose.Schema({
  id: {
    type: String,
    // required: true,
    unique: true,
    sparse: true,
  },
  username: String,
  name: String,
  access_token: {
    type: String,
    required: true,
    select: false,
  },
  refresh_token: {
    type: String,
    required: true,
    select: false,
  },
  token_expiry: Date,
});

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      maxLength: [40, "UserName should be under 40 charc"],
    },
    name: {
      type: String,
      maxLength: [40, "Name should be under 40 charc"],
    },
    bio: {
      type: String,
      maxLength: [300, "Bio should be under 300 charc"],
    },
    // TODO: Change me back to array of wallets
    // wallets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Wallet" }],
    wallets: walletSchema,
    email: {
      type: String,
      validator: [validator.isEmail, "Please provide email in correct format"],
      unique: [true, "The provided email is already registered"],
    },
    googleId: {
      type: String,
      unique: [true, "This google account is already registered"],
    },
    photo: {
      id: { type: String },
      secure_url: { type: String },
    },
    discord: discordSchema,
    // TODO: twitter can bring affects in completion tags
    twitter: twitterSchema,
    tags: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "UserIntrestTag",
      },
    ],
    completionStatus: {
      type: Number,
      default: 0.0,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    referredBy: {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      code: String,
      isProviderRewarded: Boolean,
    },
  },
  {
    timestamps: true,
  }
);

// HOOKS on User model
userSchema.post("findOneAndUpdate", async function (doc) {
  const completionStatus = calculateProfileCompletion(doc);
  if (doc.googleId && doc.discord && doc.wallets && doc.username) {
    doc.isCompleted = true;
  } else {
    doc.isCompleted = false;
  }
  if (doc.completionStatus != 100) {
    // allocate XP on each field filled in profile
    await XpTxn.updateOne(
      {
        reason: { tag: "profile_completion", id: doc._id },
        user: mongoose.Types.ObjectId(doc._id),
      },
      {
        $set: { value: completionStatus.rewardXP },
        meta: {
          title: `Filling fields in profile`,
          description: `you have filled out ${completionStatus.percentage}% of your profile`,
        },
      },
      { upsert: true }
    );
  }
  doc.completionStatus = completionStatus.percentage;
  await doc.save();
});

userSchema.pre("save", async function (next) {
  // NOTE: needs MOD on multi wallet integration
  // TEST:
  if (this.isModified("wallets")) {
    if (this.wallets.verified) {
      await Referral.updateOne(
        { generatedBy: mongoose.Types.ObjectId(this._id) },
        {
          generatedBy: this._id,
          code: this.wallets.address,
          baseXP: 500,
        },
        {
          upsert: true,
        }
      );
      console.log("Updated referral");
    }
  }

  if (this.isModified("isCompleted") && this.isCompleted) {
    // check if your referral provider was rewarded
    if ("referredBy" in this && !this.referredBy.isProviderRewarded) {
      const referral = await Referral.findOne({ code: this.referredBy.code });
      if (referral) {
        await referral.usedByUserID(this._id);
        this.referredBy.isProviderRewarded = true;
        console.log("used referral");
      } else {
        delete this.referredBy;
      }
    }
  }
  next();
});

// STATIC methods
userSchema.statics.isUsernameAvailable = async function (username) {
  return this.findOne({ username }).then((user) => {
    return !user;
  });
};

// METHODS on User model

userSchema.methods.getJWTToken = function () {
  return jwt.sign({ id: this._id }, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
};

userSchema.methods.updateDiscordDetails = async function () {
  try {
    // 1. REFRESH TOKEN
    const accessResponse = await refreshToken(this.discord.refresh_token);

    // 2. STORE NEW TOKEN
    this.discord.access_token = accessResponse.access_token;
    this.discord.refresh_token = accessResponse.refresh_token;
    this.discord.token_expiry = new Date(
      Date.now() + accessResponse.expires_in / 1000
    );

    // 3. USE NEW TOKEN FETCH GUILDS
    const discordUser = await getUserDetails(accessResponse.access_token);

    // 4. STORE NEW GUILDS
    this.discord = {
      id: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator,
      email: discordUser.email,
      access_token: accessResponse.access_token,
      refresh_token: accessResponse.refresh_token,
      guilds: discordUser.guilds,
      token_expiry: new Date(Date.now() + accessResponse.expires_in / 1000), // expires_in is in seconds
    };
  } catch (error) {
    console.error("updateDiscordDetails: ", error);
  } finally {
    return await this.save();
  }
};

userSchema.methods.updateDiscordGuilds = async function () {
  try {
    const guilds = await getUserGuilds(this.discord.access_token);
    this.discord.guilds = guilds;
    return await this.save();
  } catch (error) {
    console.error("updateDiscordGuilds: ", error);
  }
};

userSchema.methods.isPartOfGuild = async function (guildID) {
  try {
    // if listing has no discord
    if (guildID == null) return true;

    // If token has expired
    if (Date.now() >= this.discord.token_expiry) {
      await this.updateDiscordDetails();
    } else {
      await this.updateDiscordGuilds();
    }

    // CHECK IF PART OF LISTING
    let partOfGuild = this.discord.guilds.find((guild) => guild.id == guildID);
    return partOfGuild ? true : false;
  } catch (error) {
    console.log("isPartOfGuild: ", error);
    throw error;
  }
};

userSchema.methods.getTrutsXP = async function () {
  // TEST:
  const resp_doc = await XpTxn.aggregate([
    { $match: { user: this._id } },
    { $group: { _id: null, totalTrutsXP: { $sum: "$value" } } },
    { $project: { _id: 0, totalTrutsXP: 1 } },
  ]);

  return resp_doc[0]?.totalTrutsXP ?? 0; // if no missions attempted -> must return 0
};

userSchema.methods.getLevelDetails = async function () {
  const usersTrutsXP = await this.getTrutsXP();
  // TEST: REMOVING LEVEL 0
  const levels = [
    { level: 0, xpForNextLevel: 0 },
    { level: 1, xpForNextLevel: 500 },
    { level: 2, xpForNextLevel: 1500 },
    { level: 3, xpForNextLevel: 3000 },
    { level: 4, xpForNextLevel: 5000 },
    { level: 5, xpForNextLevel: 7000 },
    { level: 6, xpForNextLevel: 9000 },
    { level: 7, xpForNextLevel: 12000 },
    { level: 8, xpForNextLevel: 15000 },
    { level: 9, xpForNextLevel: 20000 },
  ];

  for (let i = 0; i < levels.length; i++) {
    const currentLevel = levels[i];
    if (usersTrutsXP < currentLevel.xpForNextLevel) {
      const prevLevel = levels[i - 1];
      const xpForNextLevel = currentLevel.xpForNextLevel - usersTrutsXP;
      const precentToNextLevel = Math.floor(
        ((usersTrutsXP - prevLevel.xpForNextLevel) /
          (currentLevel.xpForNextLevel - prevLevel.xpForNextLevel)) *
          100
      );
      return {
        currentLevel: currentLevel.level,
        xpForNextLevel,
        precentToNextLevel,
      };
    }
  }

  // If acheived all the levels
  return {
    currentLevel: levels.length + 1,
    xpForNextLevel: 0,
    precentToNextLevel: 0,
  };
};

module.exports = mongoose.model("User", userSchema);

// User schema utility methods:
function calculateProfileCompletion(doc) {
  toBeFilled = [
    { name: "username", rewardXP: 50 },
    // "name", //  currently not updating it from frontend
    { name: "bio", rewardXP: 50 },
    { name: "wallets", rewardXP: 50 },
    { name: "googleId", rewardXP: 50 },
    { name: "photo", rewardXP: 50 },
    { name: "discord", rewardXP: 50 },
    { name: "tags", rewardXP: 50 },
  ];

  let fieldsFilled = 0;
  let rewardXP = 0;
  toBeFilled.forEach((field) => {
    if (doc[field.name]) {
      fieldsFilled++;
      rewardXP += field.rewardXP;
    }
  });

  return {
    percentage: Math.floor((fieldsFilled / toBeFilled.length) * 100),
    rewardXP: rewardXP,
  };
}
