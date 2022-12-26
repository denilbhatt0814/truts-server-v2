const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const { JWT_SECRET, JWT_EXPIRY } = require("../config/config");

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
    tags: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "UserIntrestTag",
      },
    ],
    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// UNDER-WORK: build hook for check profile completion
// HOOKS on User model
userSchema.pre("save", function (next) {
  if (this.googleId && this.wallets.verified && this.discord.id) {
    // mark complete
    this.isCompleted = true;
  } else {
    // turn it incomplete
    this.isCompleted = false;
  }
  next();
});

// METHODS on User model

userSchema.methods.getJWTToken = function () {
  return jwt.sign({ id: this._id }, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
};

module.exports = mongoose.model("User", userSchema);
