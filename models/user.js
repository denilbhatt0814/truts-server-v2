const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const { JWT_SECRET, JWT_EXPIRY } = require("../config/config");
const {
  refreshToken,
  getUserDetails,
  getUserGuilds,
} = require("../utils/discordHelper");

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
    unique: [true, "user already is linked to this guild"],
    require: [true, "missing guild id"],
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
  },
  {
    timestamps: true,
  }
);

// HOOKS on User model
userSchema.post("findOneAndUpdate", async function (doc) {
  doc.completionStatus = calculateProfileCompletion(doc);
  if (doc.googleId && doc.discord && doc.wallets) {
    doc.isCompleted = true;
  } else {
    doc.isCompleted = false;
  }
  await doc.save();
});

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

module.exports = mongoose.model("User", userSchema);

// User schema utility methods:
// TEST:
function calculateProfileCompletion(doc) {
  toBeFilled = [
    "username",
    "name",
    "bio",
    "wallets",
    "googleId",
    "photo",
    "discord",
    "tags",
  ];

  let fieldsFilled = 0;
  toBeFilled.forEach((field) => {
    if (doc[field]) {
      fieldsFilled++;
    }
  });

  return Math.floor((fieldsFilled / toBeFilled.length) * 100);
}
