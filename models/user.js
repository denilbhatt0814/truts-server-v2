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
const {
  refreshTwitterToken,
  getTwitterUserDetails,
  getTwitterUserFollowing,
} = require("../utils/twitterHelper");
const { publishEvent } = require("../utils/pubSub");
const redisClient = require("../databases/redis-client");

/**
 * NOTE: If any new field is added or updated in userSchema
 *      calculateProfileCompletion Fn() must be modified for accurate response
 */

const walletSchema = new mongoose.Schema({
  chain: {
    type: String,
    enum: ["EVM", "SOL", "NEAR", "FLOW"],
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
  nonce: { type: String, select: false },
  isPrimary: {
    type: Boolean,
    default: false,
  },
});

const guildSchema = new mongoose.Schema({
  id: {
    type: String,
    // NOTE: This unique creates an index in DB on collection initialization : remove it if it causes errors
    // unique: [true, "user already is linked to this guild"],
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

const twitterAccountSchema = new mongoose.Schema({
  id: String,
  name: String,
  username: String,
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
  following: {
    type: [twitterAccountSchema],
    select: false,
  },
  token_expiry: Date,
});

const socialSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ["FACEBOOK", "GITHUB", "INSTAGRAM", "MEDIUM", "REDDIT", "DRIBBBLE"],
    required: [
      true,
      "Please mention social media platform for linking to user, enums: [ FACEBOOK,  GITHUB,  INSTAGRAM,  MEDIUM,  REDDIT,  DRIBBBLE ]",
    ],
  },
  link: {
    type: String,
    required: [
      true,
      "Please enter the link to social media platform that you are trying to add to this profile.",
    ],
    maxLength: [100, "Length of social media link must be less than 100"],
  },
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
    // wallets: walletSchema,

    // UNDER-WORK:
    wallets: {
      type: [walletSchema],
      default: undefined,
    },

    email: {
      type: String,
      validator: [validator.isEmail, "Please provide email in correct format"],
      unique: [true, "The provided email is already registered"],
      sparse: true,
    },
    googleId: {
      type: String,
      unique: [true, "This google account is already registered"],
      sparse: true,
    },
    photo: {
      id: { type: String },
      secure_url: { type: String, default: selectRandomPhoto },
    },
    discord: discordSchema,
    // TODO: twitter can bring affects in completion tags
    twitter: twitterSchema,
    // TODO: default this to undefined for not existing if empty
    tags: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "UserIntrestTag",
      },
    ],
    // TODO: Adding Socials
    socials: { type: [socialSchema], default: undefined },

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
    isSuperAdmin: {
      type: Boolean,
    },
  },
  {
    timestamps: true,
  }
);

// HOOKS on User model
userSchema.post("findOneAndUpdate", async function (doc) {
  if (doc.updatedAt.getTime() === doc.createdAt.getTime()) {
    await publishEvent(
      "user:create",
      JSON.stringify({
        data: doc,
        meta: {
          loginBy: doc.googleId ? "google" : doc.wallets ? "wallet" : "unknown",
        },
      })
    );
  }

  const completionStatus = calculateProfileCompletion(doc);
  // removed wallet complusion
  if (doc.googleId && doc.discord && doc.username) {
    if (doc.isCompleted == false) {
      await publishEvent(
        "user:isCompleted",
        JSON.stringify({
          data: doc,
        })
      );
    }
    await userActivityManager.emitEvent({
      action: "BASIC_PROFILE_COMPLETED",
      user: doc._id.toString(),
      timestamp: new Date(),
      meta: {
        user: doc,
      },
    });
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
  await redisClient.del(`USER:VALIDATORS:$${doc._id}`);
  await doc.save();
});

userSchema.pre("save", async function (next) {
  // TEST: TEST FOR PRIMARY SWITCHING AND NEW ADD
  // TODO: SAME THING FOR FIRST WALLET CONNECT
  if (this.isModified("wallets")) {
    const wallet = this.wallets.find((wallet) => wallet.isPrimary);
    if (wallet.verified) {
      await Referral.updateOne(
        { generatedBy: mongoose.Types.ObjectId(this._id) },
        {
          generatedBy: this._id,
          code: wallet.address,
          // baseXP: 500, created a default
        },
        {
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );
      console.log("Updated referral w/ primary wallet");
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

  await redisClient.del(`USER:VALIDATORS:$${this._id}`);
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

// DISCORD USER METHODS
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
    if (guildID == "null") return true;

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

// TWITTER USER METHODS
// TODO: can have a small method just to update tokens
userSchema.methods.updateTwitterDetails = async function () {
  try {
    // 1. REFRESH TOKEN
    const accessResponse = await refreshTwitterToken(
      this.twitter.refresh_token
    );

    // 2. STORE NEW TOKEN
    this.twitter.access_token = accessResponse.access_token;
    this.twitter.refresh_token = accessResponse.refresh_token;
    this.twitter.token_expiry = new Date(
      Date.now() + accessResponse.expires_in * 1000
    );

    // 3. USE NEW TOKEN FETCH NEW DETAILS
    const twitterUser = await getTwitterUserDetails(
      accessResponse.access_token
    );
    console.log({ twitterUser, msg: "updated twitter details" });

    // 4. STORE NEW DETAILS
    this.twitter = {
      id: twitterUser.id,
      name: twitterUser.name,
      username: twitterUser.username,
      following: twitterUser.following,
      access_token: accessResponse.access_token,
      refresh_token: accessResponse.refresh_token,
      token_expiry: new Date(Date.now() + accessResponse.expires_in * 1000), // expires_in is in seconds
    };
  } catch (error) {
    console.error("updateTwitterDetails: ", error);
  } finally {
    return await this.save();
  }
};

userSchema.methods.updateTwitterFollowings = async function () {
  try {
    const following = await getTwitterUserFollowing(
      this.twitter.id,
      this.twitter.access_token
    );
    this.twitter.following = following;
    return await this.save();
  } catch (error) {
    console.error("updateTwitterFollowings: ", error);
  }
};

userSchema.methods.followsTwitterAccount = async function (twitterUserName) {
  try {
    // TODO: if such a username not exist on twitter
    // if (twitterUserName == null) return true;

    // QUERY TWITTER FOR LATEST FOLLOWINGS/DETAILS

    // If token has expired
    if (Date.now() >= this.twitter.token_expiry) {
      await this.updateTwitterDetails();
    } else {
      await this.updateTwitterFollowings();
    }

    // CHECK IF FOLLOWS THE TWITTTER ACCOUNT
    let followsAccount = this.twitter.following.find(
      (account) => twitterUserName == account.username
    );
    return followsAccount ? true : false;
  } catch (error) {
    console.log("followsTwitterAccount: ", error);
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
    { level: 1, xpForNextLevel: 5000 },
    { level: 2, xpForNextLevel: 10000 },
    { level: 3, xpForNextLevel: 17000 },
    { level: 4, xpForNextLevel: 25000 },
    { level: 5, xpForNextLevel: 40000 },
    { level: 6, xpForNextLevel: 60000 },
    { level: 7, xpForNextLevel: 75000 },
    { level: 8, xpForNextLevel: 100000 },
    { level: 9, xpForNextLevel: 120000 },
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
    { name: "username", rewardXP: 500 },
    // "name", //  currently not updating it from frontend
    { name: "bio", rewardXP: 500 },
    { name: "wallets", rewardXP: 500 },
    { name: "googleId", rewardXP: 500 },
    { name: "photo", rewardXP: 500 },
    { name: "discord", rewardXP: 500 },
    { name: "tags", rewardXP: 500 },
    { name: "twitter", rewardXP: 500 },
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

function selectRandomPhoto() {
  let url = "https://truts-users.s3.ap-south-1.amazonaws.com/";
  listOfPhotos = [
    "user-random-1.webp",
    "user-random-2.webp",
    "user-random-3.webp",
    "user-random-4.webp",
    "user-random-5.webp",
    "user-random-6.webp",
  ];
  let photo =
    url + listOfPhotos[Math.floor(Math.random() * listOfPhotos.length)];
  return photo;
}
