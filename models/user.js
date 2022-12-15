const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const { JWT_SECRET, JWT_EXPIRY } = require("../config/config");

const walletSchema = new mongoose.Schema({
  chain: {
    type: String,
    // required: true,
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

const discordSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
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
    // wallets: {
    //   type: [walletSchema],
    // },
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
  },
  {
    timestamps: true,
  }
);

// METHODS on User model

userSchema.methods.getJWTToken = function () {
  return jwt.sign({ id: this._id }, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
};

module.exports = mongoose.model("User", userSchema);
