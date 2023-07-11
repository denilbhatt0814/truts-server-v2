const sharp = require("sharp");
const User = require("../models/user");
const { User_Mission } = require("../models/user_mission");
const Wallet = require("../models/wallet");
const Dao = require("../models/dao");
const { Review } = require("../models/newReview");
const { Referral } = require("../models/referral");
const UserIntrestTag = require("../models/userIntrestTag");
const cookieToken = require("../utils/cookieToken");
const {
  getAccessTokenResponse,
  getUserDetails,
} = require("../utils/discordHelper");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");
const uploadToS3 = require("../utils/uploadToS3");
const jwt = require("jsonwebtoken");
const {
  JWT_SECRET,
  WALLET_NONCE_LENGTH,
  GOOGLE_CLIENT_ID,
} = require("../config/config");
const randomString = require("../utils/randomString");
const mongoose = require("mongoose");
const { ethers } = require("ethers");
// for sol wallet verifiaction
const bs58 = require("bs58");
const nacl = require("tweetnacl");
const { OAuth2Client } = require("google-auth-library");
const {
  exchangeTwitterToken,
  getTwitterUserDetails,
} = require("../utils/twitterHelper");
const { default: axios } = require("axios");
const { XpTxn } = require("../models/xpTxn");
const redisClient = require("../databases/redis-client");
const { Listing_Social } = require("../models/listing_social");

exports.signup = async (req, res) => {
  // NOTE: this controller is of no use RN
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        msg: "invalid/insufficient input provided!",
      });
    }

    const user = User.create({
      email,
      password,
    });

    // TODO: photo, wallets, intrest tags

    // send JWT cookie for fututre use
    cookieToken(user, res);
  } catch (error) {
    return res.status(500).json({
      success: false,
      msg: "internal server error",
    });
  }
};

exports.login = async (req, res) => {
  // NOTE: this controller is of no use RN
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, msg: "Please provide email and password" });
    }

    // fetch user from db - EXISTANCE
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res
        .status(400)
        .json({ success: false, msg: "Email or password doesn't exist" });
    }

    // password validation
    const isCorrectPassword = await user.isValidPassword(password);
    if (!isCorrectPassword) {
      return res
        .status(400)
        .json({ success: false, msg: "Email or password doesn't exist" });
    }

    // generate and send cookie
    cookieToken(user, res);
  } catch (error) {
    return res.status(500).json({
      success: false,
      msg: "internal server error",
    });
  }
};

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

exports.loginViaGoogle = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const g_token = req.body.token;
    console.log(req.body);
    const ticket = await client.verifyIdToken({
      idToken: g_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const profile = ticket.getPayload();

    let filter;
    // If already Logged in then connect
    if ("token" in req.cookies || "authorization" in req.headers) {
      const token =
        req.cookies.token || req.header("Authorization").replace("Bearer ", "");
      console.log(token);
      const decoded = jwt.verify(token, JWT_SECRET);

      filter = { _id: decoded.id };
      console.log("Connected w/ google");
    } else {
      // Login or Sign up w/ Google
      filter = { email: profile.email };
      console.log("LOGIN || SIGNUP W/ GOOGLE");
    }

    // update/insert user's google details
    const options = {
      upsert: true, // Perform an upsert operation
      new: true, // Return the updated document, instead of the original
      setDefaultsOnInsert: true, // Set default values for any missing fields in the original document
      session: session,
    };
    let user = await User.findOneAndUpdate(
      filter,
      {
        googleId: profile.sub,
        email: profile.email,
      },
      options
    ).populate("tags");

    // if provided referral:
    if (req.body.referral) {
      await attachReferral(user, req.body.referral, session);
    }

    if (!user.name) {
      // add name if missing or if new user
      user = await User.findOneAndUpdate(
        { _id: user._id },
        { name: profile.name },
        {
          new: true,
          session,
        }
      ).populate("tags");
    }

    await session.commitTransaction();
    await session.endSession();
    // return jwt token
    cookieToken(user, res);
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    console.log(error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.loginViaDiscord = async (req, res) => {
  try {
    const code = req.query.code;

    const accessResponse = await getAccessTokenResponse(code);
    // use access token to get user info - user ID n all (need to figure out)
    const discordUser = await getUserDetails(accessResponse.access_token);

    let filter;

    // If already Logged in then connect
    if ("token" in req.cookies || "authorization" in req.headers) {
      const token =
        req.cookies.token || req.header("Authorization").replace("Bearer ", "");
      console.log(token);

      const decoded = jwt.verify(token, JWT_SECRET);

      const discordAccountExists = await User.findOne({
        "discord.id": discordUser.id,
      });
      if (discordAccountExists) {
        return new HTTPError(
          res,
          409,
          "This discord account is already connected to a user",
          "discord account conflict"
        );
      }

      filter = { _id: decoded.id };
      console.log("Connected w/ discord");
    } else {
      // Login or Sign up w/ discord
      filter = { "discord.id": discordUser.id };
      console.log("LOGIN || SIGNUP W/ DISCORD");
    }

    // update/insert user's discord details
    const options = {
      upsert: true, // Perform an upsert operation
      new: true, // Return the updated document, instead of the original
      setDefaultsOnInsert: true, // Set default values for any missing fields in the original document
    };
    let user = await User.findOneAndUpdate(
      filter,
      {
        discord: {
          id: discordUser.id,
          username: discordUser.username,
          discriminator: discordUser.discriminator,
          email: discordUser.email,
          access_token: accessResponse.access_token,
          refresh_token: accessResponse.refresh_token,
          guilds: discordUser.guilds,
          // TODO: add expiry to current
          token_expiry: new Date(Date.now() + accessResponse.expires_in / 1000), // expires_in is in seconds
        },
      },
      options
    ).populate("tags");

    // add name if missing or if new user
    if (!user.name) {
      user = await User.findOneAndUpdate(
        { _id: user._id },
        { name: user.discord.username },
        {
          new: true,
        }
      ).populate("tags");
    }

    // link all previous reviews w/ discord to truts account
    try {
      await Review.updateMany(
        {
          "oldData.user_discord_id": discordUser.id,
          user: null,
        },
        {
          $set: { user: mongoose.Types.ObjectId(user._id) },
        },
        {
          new: true,
        }
      );
    } catch (error) {
      console.log("loginViaDiscord->LinkReview: ", error);
    }

    // return jwt token
    cookieToken(user, res);
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      msg: "internal server error",
      error: error,
    });
  }
};

exports.connectTwitter = async (req, res) => {
  try {
    const code = req.query.code;
    const user = req.user;
    const data = await exchangeTwitterToken(code);
    const user_data = await getTwitterUserDetails(data.access_token);

    console.log(user_data);
    const twitterAccountExists = await User.findOne({
      "twitter.id": user_data.id,
    });
    if (twitterAccountExists) {
      return new HTTPError(
        res,
        409,
        "This twitter account is already connected to a user",
        "twitter account conflict"
      );
    }

    user.twitter = {
      id: user_data.id,
      name: user_data.name,
      username: user_data.username,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expiry: new Date(Date.now() + data.expires_in * 1000), // expires_in is in seconds
    };
    await user.save();
    return new HTTPResponse(res, true, 200, null, null, { user });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      msg: "internal server error",
      error: error,
    });
  }
};

exports.loginViaWallet = async (req, res) => {
  try {
    const address = req.query.address;
    if (!address) {
      return new HTTPError(
        res,
        400,
        "missing address in params",
        "invalid input"
      );
    }

    let filter, msg;
    // If already Logged in then connect
    if ("token" in req.cookies || "authorization" in req.headers) {
      const token =
        req.cookies.token || req.header("Authorization").replace("Bearer ", "");
      console.log(token);

      const decoded = jwt.verify(token, JWT_SECRET);

      filter = { _id: decoded.id };

      msg = "Connected a wallet";
      console.log(msg);
    } else {
      // Login or Sign up w/ with a wallet
      filter = { "wallets.address": address };

      msg = "LOGIN || SIGNUP W/ WALLET";
      console.log();
    }

    // update/insert user's wallet details
    const options = {
      upsert: true, // Perform an upsert operation
      new: true, // Return the updated document, instead of the original
      setDefaultsOnInsert: true, // Set default values for any missing fields in the original document
    };

    const nonce = `You are signing in on truts.xyz with your wallet address: ${address}.\nHere's the unique identifier: ${randomString(
      WALLET_NONCE_LENGTH
    )}.\n\nSigning this doesn't authorize any approvals or funds transfers`;

    let user = await User.findOneAndUpdate(
      filter,
      {
        wallets: {
          address: address,
          nonce: nonce,
        },
      },
      options
    );

    // return nonce
    return new HTTPResponse(res, true, 200, msg, null, {
      nonce: user.wallets.nonce,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      msg: "internal server error",
      error: error,
    });
  }
};

exports.verifyWallet = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { public_key, signature, chain } = req.body;

    let user = await User.findOne({ "wallets.address": public_key }).session(
      session
    );

    // If no user with given public_key
    if (!user) {
      return new HTTPError(res, 401, "User w/ provided public_key not found");
    }

    let evm_verified, sol_verified, near_verified, flow_verified;
    const message = user.wallets.nonce;
    switch (chain) {
      case "EVM":
        const hash = ethers.utils.hashMessage(message);
        const signing_address = ethers.utils.recoverAddress(hash, signature);
        evm_verified = signing_address == public_key;
        break;
      case "SOL":
        sol_verified = nacl.sign.detached.verify(
          new TextEncoder().encode(message),
          bs58.decode(signature),
          bs58.decode(public_key)
        );
        break;
      // TODO:: these 2 auth are hacky; needs to be more secure
      case "NEAR":
        near_verified = true;
        break;
      case "FLOW":
        flow_verified = true;
        break;
      default:
        return new HTTPError(
          res,
          400,
          "chain must be either one of: ['EVM', 'SOL', 'NEAR', 'FLOW']",
          "invalid chain enum"
        );
    }

    if (evm_verified || sol_verified || near_verified || flow_verified) {
      user.wallets.verified = true;
      user.wallets.chain = chain;
      user.markModified("wallets");
      /**
       * NOTE: using save rather than updateOne as, we a hook on save
       *      for generating/updating users referral code = wallet address
       */
      await user.save({ session });

      // link all previous reviews w/ wallet address to truts account
      try {
        await Review.updateMany(
          {
            "oldData.public_address": user.wallets.address,
            user: null,
          },
          {
            $set: { user: mongoose.Types.ObjectId(user._id) },
          },
          {
            new: true,
            session,
          }
        );
      } catch (error) {
        console.log("verifyWallet->LinkReview: ", error);
      }

      // if provided referral:
      if (req.body.referral) {
        await attachReferral(user, req.body.referral, session);
      }

      await session.commitTransaction();
      await session.endSession();
      cookieToken(user, res);
    } else {
      await session.abortTransaction();
      await session.endSession();
      return new HTTPError(
        res,
        400,
        "signature doesn't belong to this public key'",
        "invalid verification"
      );
    }
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    console.log(error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.loginViaMultiWallet = async (req, res) => {
  // NOTE: now we also need chain in login query
  try {
    const { address, chain } = req.query;
    if (!address) {
      return new HTTPError(
        res,
        400,
        "missing address in params",
        "invalid input"
      );
    }

    const nonce = `You are signing in on truts.xyz with your wallet address: ${address}.\nHere's the unique identifier: ${randomString(
      WALLET_NONCE_LENGTH
    )}.\n\nSigning this doesn't authorize any approvals or funds transfers`;

    // check if a user exists and add new nonce
    let user = await User.findOne({ "wallets.address": address });
    let msg = "LOGIN || SIGNUP W/ WALLET";
    if (!user) {
      // For creating new account
      user = await User.findOneAndUpdate(
        { "wallets.address": address },
        {
          $set: {
            wallets: [
              { address: address, nonce: nonce, chain: chain, isPrimary: true },
            ],
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      msg = "SIGNUP W/ WALLET";
    } else {
      let walletIdx = user.wallets.findIndex(
        (wallet) => wallet.address == address
      );
      user.wallets[walletIdx].nonce = nonce;
      user.markModified("wallets");
      user = await user.save();
      msg = "LOGIN W/ WALLET";
    }

    console.log(msg);

    // return nonce
    return new HTTPResponse(res, true, 200, msg, null, {
      nonce: nonce,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      msg: "internal server error",
      error: error,
    });
  }
};

exports.verifyMultiWallet = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { public_key, signature, chain } = req.body;

    let user = await User.findOne({ "wallets.address": public_key })
      .select("+wallets.nonce")
      .session(session);

    // If no user with given public_key
    if (!user) {
      return new HTTPError(res, 404, "User w/ provided public_key not found");
    }

    const { nonce } = user.wallets.find(
      (wallet) => wallet.address == public_key
    );

    const walletIsVerified = walletVerifier(
      res,
      public_key,
      signature,
      chain,
      nonce
    );
    if (walletIsVerified instanceof HTTPError) return;

    if (walletIsVerified) {
      let walletIdx = user.wallets.findIndex(
        (wallet) => wallet.address == public_key
      );
      user.wallets[walletIdx].verified = true;
      user.wallets[walletIdx].chain = chain;
      user.markModified("wallets");
      await user.save({ session });

      // link all previous reviews w/ wallet address to truts account
      try {
        await Review.updateMany(
          {
            "oldData.public_address": public_key,
            user: null,
          },
          {
            $set: { user: mongoose.Types.ObjectId(user._id) },
          },
          {
            new: true,
            session,
          }
        );
      } catch (error) {
        console.log("verifyWallet->LinkReview: ", error);
      }

      // if provided referral:
      if (req.body.referral) {
        await attachReferral(user, req.body.referral, session);
      }

      await session.commitTransaction();
      await session.endSession();
      cookieToken(user, res);
    } else {
      await session.abortTransaction();
      await session.endSession();
      return new HTTPError(
        res,
        400,
        "signature doesn't belong to this public key'",
        "invalid verification"
      );
    }
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    console.log(error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.addNewWallet = async (req, res) => {
  try {
    let user = req.user;
    const { address, chain } = req.body;
    let query;

    // check: someone already doesn't hold it
    const holderOfWallet = await User.findOne({ "wallets.address": address });
    if (holderOfWallet) {
      let msg =
        holderOfWallet._id == req.user._id
          ? "user has already linked this wallet"
          : "this wallet is already linked to other user";
      return new HTTPError(res, 409, msg, "wallet already linked");
    }

    // check if user already holds a wallet of same chain
    let existingChainWallet;
    if (user.wallets) {
      existingChainWallet = user.wallets.find(
        (wallet) => wallet.chain == chain
      );
    }

    if (existingChainWallet) {
      return new HTTPError(
        res,
        409,
        "user already has wallet linked to truts with this chain",
        "only one wallet per chain"
      );
    }

    // if its a fresh wallet of a diff chain
    const nonce = `You are signing in on truts.xyz with your wallet address: ${address}.\nHere's the unique identifier: ${randomString(
      WALLET_NONCE_LENGTH
    )}.\n\nSigning this doesn't authorize any approvals or funds transfers`;

    // UNDER-WORK:

    // add this address with nonce in memory
    await redisClient.setEx(
      `addWallet:${user._id}:${chain}:${address}`,
      60 * 3,
      nonce
    );

    console.log(`Adding new wallet -> ${chain}:${address}`);

    return new HTTPResponse(
      res,
      true,
      201,
      "wallet added to profile succesfully",
      null,
      { nonce: nonce }
    );
  } catch (error) {
    console.log("addNewWallet: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// NOTE: PROTECTED
exports.verifyNewMultiWallet = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let user = req.user;
    const { public_key, signature, chain } = req.body;

    // TODO:
    const nonce = await redisClient.get(
      `addWallet:${user._id}:${chain}:${public_key}`
    );

    if (!nonce) {
      return new HTTPError(
        res,
        401,
        `wallet[${public_key}] is not linked to user[${user._id}]`,
        "unauthorized access"
      );
    }

    const walletIsVerified = walletVerifier(
      res,
      public_key,
      signature,
      chain,
      nonce
    );
    if (walletIsVerified instanceof HTTPError) return;

    if (walletIsVerified) {
      if (!user.wallets || user.wallets.length == 0) {
        // if logedin but has no wallets
        query = {
          $set: {
            wallets: [
              {
                address: public_key,
                chain: chain,
                nonce: nonce,
                isPrimary: true,
                verified: true,
              },
            ],
          },
        };
      } else {
        query = {
          $push: {
            wallets: {
              address: public_key,
              nonce: nonce,
              chain: chain,
              verified: true,
            },
          },
        };
      }

      user = await User.findOneAndUpdate({ _id: user._id }, query, {
        new: true,
        setDefaultsOnInsert: true,
        session,
      });
      // user.markModified("wallets");
      user = await user.save({ session });

      // link all previous reviews w/ wallet address to truts account
      try {
        await Review.updateMany(
          {
            "oldData.public_address": public_key,
            user: null,
          },
          {
            $set: { user: mongoose.Types.ObjectId(user._id) },
          },
          {
            new: true,
            session,
          }
        );
      } catch (error) {
        console.log("verifyWallet->LinkReview: ", error);
      }

      await session.commitTransaction();
      await session.endSession();
      return new HTTPResponse(
        res,
        true,
        201,
        "linked a new wallet successfully",
        null,
        { user }
      );
    } else {
      await session.abortTransaction();
      await session.endSession();
      return new HTTPError(
        res,
        400,
        "signature doesn't belong to this public key'",
        "invalid verification"
      );
    }
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    console.log(error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// NOTE: PROTECTED
exports.setPrimaryWallet = async (req, res) => {
  try {
    let user = req.user;
    const { address } = req.body; // new primary address

    // check if user holds the wallet
    const holderOfWallet = await User.findOne({ "wallets.address": address });

    // if no one holds the wallet or the wallet is hold by other user
    if (
      !holderOfWallet ||
      holderOfWallet._id.toString() != user._id.toString()
    ) {
      return new HTTPError(
        res,
        401,
        `user[${user._id}] is not holder of the wallet[${address}]`,
        "resource not found OR unauthorized access"
      );
    }

    // if all good then make all the wallet except "address" as non primary
    user.wallets.forEach((wallet) => {
      wallet.isPrimary = wallet.address == address ? true : false;
    });
    user.markModified("wallets");
    user = await user.save();

    return new HTTPResponse(
      res,
      true,
      200,
      `wallet[${address}] is set to primary`,
      null,
      { user }
    );
  } catch (error) {
    console.log("setPrimaryWallet: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// NOTE: PROTECTED // TODO: can make it to have address in body
exports.removeAWallet = async (req, res) => {
  try {
    let user = req.user;
    const { address } = req.params;

    if (!address) {
      return new HTTPError(
        res,
        400,
        "missing address in query params for deletion",
        "missing data"
      );
    }

    // check if wallet linked to user
    let wallet = user.wallets.find((wallet) => wallet.address == address);
    if (!wallet) {
      return new HTTPError(
        res,
        404,
        `wallet[${address}] not linked in user[${user._id}]`,
        "resource not found"
      );
    }

    // if remove request is for primary wallet
    if (wallet.isPrimary) {
      return new HTTPError(
        res,
        403,
        "removing primary wallet is not allowed",
        "action not allowed"
      );
    }

    // if alright then remove wallet
    user = await User.findOneAndUpdate(
      { _id: user._id },
      { $pull: { wallets: { address: address } } },
      { new: true }
    );

    return new HTTPResponse(
      res,
      true,
      200,
      `wallet[${address}] removed successfully`,
      null,
      { user }
    );
  } catch (error) {
    console.log("removeAWallet: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// NOTE: PROTECTED
exports.changeWallet = async (req, res) => {
  try {
    const user = req.user;
    const { address, chain } = req.body;

    let existingWallet = user.wallets.find((wallet) => wallet.chain == chain);
    if (!existingWallet) {
      return new HTTPError(
        res,
        404,
        `user doesn't have ${chain} wallet linked`,
        "resource not found"
      );
    }

    const nonce = `You are signing in on truts.xyz with your wallet address: ${address}.\nHere's the unique identifier: ${randomString(
      WALLET_NONCE_LENGTH
    )}.\n\nSigning this doesn't authorize any approvals or funds transfers`;

    // add this address with nonce in memory
    await redisClient.setEx(`changeWallet:${chain}:${address}`, 60 * 3, nonce);

    return new HTTPResponse(
      res,
      true,
      200,
      "wallet change initiated, now verify new wallet",
      null,
      { nonce }
    );
  } catch (error) {
    console.log("changeWallet: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// NOTE: PROTECTED
exports.verifyChangedWallet = async (req, res) => {
  try {
    let user = req.user;
    const { public_key, signature, chain } = req.body;

    const nonce = await redisClient.get(`changeWallet:${chain}:${public_key}`);

    if (!nonce) {
      return new HTTPError(
        res,
        404,
        `wallet[${public_key}] is not linked`,
        "resource not found"
      );
    }

    const walletIsVerified = walletVerifier(
      res,
      public_key,
      signature,
      chain,
      nonce
    );
    if (walletIsVerified instanceof HTTPError) return;

    const session = await mongoose.startSession();
    session.startTransaction();
    if (walletIsVerified) {
      const walletIdx = user.wallets.findIndex(
        (wallet) => wallet.chain == chain
      );
      user.wallets[walletIdx].address = public_key;
      user.wallets[walletIdx].nonce = nonce;
      user.wallets[walletIdx].verified = true;
      user.markModified("wallets");
      user = await user.save({ session });

      // link all previous reviews w/ wallet address to truts account
      try {
        await Review.updateMany(
          {
            "oldData.public_address": public_key,
            user: null,
          },
          {
            $set: { user: mongoose.Types.ObjectId(user._id) },
          },
          {
            new: true,
            session,
          }
        );
      } catch (error) {
        console.log("verifyWallet->LinkReview: ", error);
      }
      await session.commitTransaction();
      await session.endSession();
      await redisClient.del(`changeWallet:${chain}:${public_key}`);
      return new HTTPResponse(
        res,
        true,
        200,
        `${chain} wallet changed successfully`,
        null,
        { user }
      );
    }
  } catch (error) {
    console.log("verifyChangedWallet: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

function walletVerifier(res, public_key, signature, chain, message) {
  // let evm_verified, sol_verified, near_verified, flow_verified;
  switch (chain) {
    case "EVM":
      const hash = ethers.utils.hashMessage(message);
      const signing_address = ethers.utils.recoverAddress(hash, signature);
      return signing_address == public_key;

    case "SOL":
      return nacl.sign.detached.verify(
        new TextEncoder().encode(message),
        bs58.decode(signature),
        bs58.decode(public_key)
      );

    // TODO:: these 2 auth are hacky; needs to be more secure
    case "NEAR":
      // near_verified = true;
      // break;
      return true;
    case "FLOW":
      // flow_verified = true;
      // break;
      return true;
    default:
      return new HTTPError(
        res,
        400,
        "chain must be either one of: ['EVM', 'SOL', 'NEAR', 'FLOW']",
        "invalid chain enum"
      );
  }
}

// ------ USER CONTROLLER (PRIVATE) ------
exports.getMyUserDetails = async (req, res) => {
  return new HTTPResponse(res, true, 200, null, null, { user: req.user });
};

exports.getMyProfileStatus = async (req, res) => {
  try {
    const user = req.user;

    let foundEVMWallet = false;
    let foundSOLWallet = false;
    for (
      let i = 0;
      user.wallets &&
      i < user.wallets.length &&
      (!foundEVMWallet || !foundSOLWallet);
      i++
    ) {
      if (user.wallets[i].chain == "EVM") {
        foundEVMWallet = true;
      } else if (user.wallets[i].chain == "SOL") {
        foundSOLWallet = true;
      }
    }

    return new HTTPResponse(res, true, 200, null, null, {
      user: {
        discord: user.discord ? true : false,
        twitter: user.twitter ? true : false,
        wallet: {
          EVM: foundEVMWallet,
          SOL: foundSOLWallet,
        },
      },
    });
  } catch (error) {
    console.log("getMyProfileStatus: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.setMyUsername = async (req, res) => {
  try {
    const { username } = req.body;
    if (req.user.username) {
      return new HTTPError(
        res,
        409,
        `user already has username: ${req.user.username}`,
        "username already exists (can not update)"
      );
    }
    if (!(await User.isUsernameAvailable(username))) {
      return new HTTPError(
        res,
        409,
        `requested username: ${username} is already taken`,
        "username already taken"
      );
    }

    req.user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { username } },
      { new: true }
    );
    return new HTTPResponse(
      res,
      true,
      200,
      `username: ${username} set successfully`,
      null,
      { user: req.user }
    );
  } catch (error) {
    console.log("setMyUsername: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.isUsernameAvailable = async (req, res) => {
  try {
    const { username } = req.query;
    const available = await User.isUsernameAvailable(username);
    return new HTTPResponse(res, true, 200, null, null, {
      username,
      available,
    });
  } catch (error) {
    console.log("isUsernameAvailable: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.updateUserDeatils = async (req, res) => {
  try {
    // get new data
    const newData = {
      name: req.body.name,
      bio: req.body.bio,
      tags: JSON.parse(req.body.tags),
    };

    // if asked for photo update
    if (req.files && "photo" in req.files) {
      const saveResp = await updateProfileImage(req.user, req.files.photo);

      // save link and id for the new image
      newData.photo = {
        id: saveResp.ETag.replaceAll('"', ""), // need to remove some extra char.
        secure_url: saveResp.object_url,
      };
    }

    // update the document w/ new data
    const user = await User.findByIdAndUpdate(req.user.id, newData, {
      new: true,
      runValidators: true,
    }).populate("tags");

    return new HTTPResponse(
      res,
      true,
      200,
      "resource updated successfully",
      null,
      { user }
    );
  } catch (error) {
    console.log(error);
    return new HTTPError(res, 500, error, "Internal server error");
  }
};

exports.updateUserSocialLinks = async (req, res) => {
  try {
    const { platform, link } = req.body;
    let user = await User.findById(req.user._id).populate("tags");

    const indexOfSocial = user.socials
      ? user.socials.findIndex((social) => social.platform == platform)
      : -1;

    if (indexOfSocial != -1) {
      user.socials[indexOfSocial] = { platform, link };
    } else {
      user.socials = user.socials ?? [];
      user.socials.push({ platform, link });
    }
    user = await user.save();

    return new HTTPResponse(
      res,
      true,
      200,
      "social link added/updated successfully",
      null,
      { user }
    );
  } catch (error) {
    console.log("updateSocialLinks: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.deleteUserSocialLinks = async (req, res) => {
  try {
    const { platform } = req.body;
    let user = await User.findById(req.user._id).populate("tags");

    const indexOfSocial = user.socials
      ? user.socials.findIndex((social) => social.platform == platform)
      : false;

    if (indexOfSocial == -1) {
      return new HTTPResponse(
        res,
        false,
        304,
        null,
        `${platform} is not linked with user[${user._id}]`
      );
    }

    user = await User.findOneAndUpdate(
      { _id: req.user._id },
      { $pull: { socials: { platform } } },
      { new: true }
    );

    return new HTTPResponse(res, true, 200, null, null, { user });
  } catch (error) {
    console.log("deleteUserSocialLinks: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getMyMatchWithListedGuilds = async (req, res) => {
  try {
    let user = await User.findById(req.user._id, { "discord.guilds": 1 });

    if (!user.discord) {
      return new HTTPError(
        res,
        400,
        "Please link your discord account",
        "Discord not connected"
      );
    }

    // TEST:
    const pipeline = [
      {
        $match: {
          _id: user._id,
        },
      },
      {
        $unwind: {
          path: "$discord.guilds",
        },
      },
      {
        $lookup: {
          from: "listing_socials",
          localField: "discord.guilds.id",
          foreignField: "meta.guild_id",
          as: "discordSocial",
        },
      },
      {
        $match: {
          discordSocial: {
            $ne: [],
          },
        },
      },
      {
        $unwind: {
          path: "$discordSocial",
        },
      },
      {
        $lookup: {
          from: "listings",
          localField: "discordSocial.listing",
          foreignField: "_id",
          as: "listing",
        },
      },
      {
        $unwind: {
          path: "$listing",
        },
      },
      {
        $project: {
          "listing._id": 1,
          "listing.name": 1,
          "listing.photo": 1,
          "listing.reviews": 1,
          "listing.slug": 1,
        },
      },
      {
        $lookup: {
          from: "listing_socials",
          localField: "listing._id",
          foreignField: "listing",
          as: "listing.socials",
        },
      },
    ];

    const user_listings = await User.aggregate(pipeline);
    const listings = user_listings.map((user_listing) => user_listing.listing);

    // const guildIds = user.discord.guilds.map((guild) => guild.id);
    // let listings = await Dao.find(
    //   { guild_id: { $in: guildIds }, verified_status: true },
    //   {
    //     dao_name: 1,
    //     slug: 1,
    //     guild_id: 1,
    //     average_rating: 1,
    //     dao_cover: 1,
    //     dao_logo: 1,
    //     discord_link: 1,
    //     twitter_link: 1,
    //     website_link: 1,
    //     verified_status: 1,
    //     review_count: 1,
    //     twitter_followers: 1,
    //     discord_members: 1,
    //   }
    // );
    // listings = listings.map((listing) => {
    //   return {
    //     name: listing.dao_name,
    //     ratings: {
    //       average: listing.average_rating,
    //       count: listing.review_count,
    //     },
    //     discord: {
    //       id: listing.guild_id,
    //       link: listing.discord_link,
    //       count: listing.discord_members,
    //     },
    //     twitter: {
    //       // id: "",
    //       link: listing.twitter_link,
    //       count: listing.twitter_followers,
    //     },
    //     website: listing.website_link,
    //     image: {
    //       logo: {
    //         url: listing.dao_logo,
    //       },
    //       cover: {
    //         url: listing.dao_cover,
    //       },
    //     },
    //     slug: listing.slug,
    //   };
    // });

    return new HTTPResponse(res, true, 200, null, null, {
      count: listings.length,
      listings,
    });
  } catch (error) {
    console.log(error);
    return new HTTPError(res, 500, error, "Internal server error");
  }
};

exports.getMyReviews = async (req, res) => {
  try {
    const userID = req.user._id;
    const agg = [
      {
        // Get all reviews by user: userID
        $match: {
          user: new mongoose.Types.ObjectId(userID),
        },
      },
      {
        // Now look for all votes relating to a selected review
        $lookup: {
          from: "votereviews",
          localField: "_id",
          foreignField: "review",
          as: "votes", // arr of relating votes
        },
      },
      {
        // Add new field to response review object
        $addFields: {
          voteState: {
            // Based on a condition
            $cond: [
              {
                // IF: no vote by user on the specific review -> voteState: null
                $eq: [
                  // matches size of filtered arrray with 0
                  {
                    $size: {
                      // filters an array of votes if current user matches user who voted
                      $filter: {
                        input: "$votes",
                        as: "vote",
                        cond: {
                          $eq: [
                            "$$vote.user",
                            new mongoose.Types.ObjectId(userID),
                          ],
                        },
                      },
                    },
                  },
                  0,
                ],
              },
              // then return voteState: null i.e no vote by me on the specific review
              null,
              // else if I have ever voted for a review -> then:
              {
                // return 0th elem from filtered array
                $arrayElemAt: [
                  {
                    // filter for finding if a vote by me/user calling this api
                    $filter: {
                      input: "$votes",
                      as: "vote",
                      cond: {
                        $eq: [
                          "$$vote.user",
                          new mongoose.Types.ObjectId(userID),
                        ],
                      },
                    },
                  },
                  0,
                ],
              },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: {
          path: "$user",
        },
      },
      {
        $lookup: {
          // from: "daos",
          // TEST
          from: "listings",
          localField: "listing",
          foreignField: "_id",
          as: "listing",
        },
      },
      {
        $unwind: {
          path: "$listing",
        },
      },
      {
        $project: {
          _id: 1,
          rating: 1,
          comment: 1,
          vote: 1,
          voteState: 1,
          user: {
            _id: 1,
            name: 1,
            username: 1,
            photo: 1,
          },
          // TEST:
          listing: {
            _id: 1,
            name: 1,
            photo: 1,
            // name: "$listing.dao_name",
            // photo: {
            //   logo: {
            //     secure_url: "$listing.dao_logo",
            //   },
            // },
            slug: 1,
          },
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ];

    const reviews = await Review.aggregate(agg);

    return new HTTPResponse(res, true, 200, null, null, {
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    console.log("getMyReviews: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getMyReferralDetails = async (req, res) => {
  try {
    let referral = await Referral.findOne({ generatedBy: req.user._id });
    console.log(referral);
    /**
     * NOTE: - need to do update in _doc as doing it directly doesn't actually
     *         update the object untill you use .save() method.
     *       - Secondly I could have made a virtual for xpEarned but virtuals
     *         don't allow async calls. thus a way around is used here.
     */
    referral._doc.xpEarned = await referral.calculateXpEarned();
    return new HTTPResponse(res, true, 200, null, null, { referral });
  } catch (error) {
    console.log("getMyReferralDetails: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getUserReviews = async (req, res) => {
  try {
    const username = req.params.username;
    const user = await User.findOne({
      username: username,
      isCompleted: true,
    });
    if (!user) {
      return new HTTPError(
        res,
        404,
        "user w/ given address not found",
        "user not found"
      );
    }

    const agg = [
      {
        // Get all reviews by user: userID
        $match: {
          user: new mongoose.Types.ObjectId(user._id),
        },
      },
      {
        // Now look for all votes relating to a selected review
        $lookup: {
          from: "votereviews",
          localField: "_id",
          foreignField: "review",
          as: "votes", // arr of relating votes
        },
      },
      {
        // Add new field to response review object
        $addFields: {
          voteState: {
            // Based on a condition
            $cond: [
              {
                // IF: no vote by user on the specific review -> voteState: null
                $eq: [
                  // matches size of filtered arrray with 0
                  {
                    $size: {
                      // filters an array of votes if current user matches user who voted
                      $filter: {
                        input: "$votes",
                        as: "vote",
                        cond: {
                          $eq: [
                            "$$vote.user",
                            new mongoose.Types.ObjectId(req.user._id),
                          ],
                        },
                      },
                    },
                  },
                  0,
                ],
              },
              // then return voteState: null i.e no vote by me on the specific review
              null,
              // else if I have ever voted for a review -> then:
              {
                // return 0th elem from filtered array
                $arrayElemAt: [
                  {
                    // filter for finding if a vote by me/user calling this api
                    $filter: {
                      input: "$votes",
                      as: "vote",
                      cond: {
                        $eq: [
                          "$$vote.user",
                          new mongoose.Types.ObjectId(req.user._id),
                        ],
                      },
                    },
                  },
                  0,
                ],
              },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: {
          path: "$user",
        },
      },
      {
        $lookup: {
          // from: "daos",
          // TEST:
          from: "listings",
          localField: "listing",
          foreignField: "_id",
          as: "listing",
        },
      },
      {
        $unwind: {
          path: "$listing",
        },
      },
      {
        $project: {
          _id: 1,
          rating: 1,
          comment: 1,
          vote: 1,
          voteState: 1,
          user: {
            _id: 1,
            name: 1,
            username: 1,
            photo: 1,
          },
          // TEST:
          listing: {
            _id: 1,
            name: 1,
            photo: 1,
            slug: 1,
          },
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ];

    const reviews = await Review.aggregate(agg);

    return new HTTPResponse(res, true, 200, null, null, {
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    console.log("getUserReviews: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getMyCompletedMissions = async (req, res) => {
  try {
    const userID = req.user._id;
    const aggregationPipeline = [
      {
        $match: {
          user: mongoose.Types.ObjectId(userID),
          isCompleted: true,
        },
      },
      {
        $project: {
          _id: 1,
          attemptID: "$_id",
          mission: 1,
          completedAt: 1,
          trutsXP: 1,
          listingXP: 1,
        },
      },
      {
        $lookup: {
          from: "missions",
          localField: "mission",
          foreignField: "_id",
          as: "mission",
        },
      },
      {
        $unwind: {
          path: "$mission",
        },
      },
      {
        $lookup: {
          // from: "daos",
          // TEST:
          from: "listings",
          localField: "mission.listing",
          foreignField: "_id",
          as: "listing",
        },
      },
      {
        $unwind: {
          path: "$listing",
        },
      },
      {
        $group: {
          _id: "$mission._id",
          attemptID: {
            $first: "$attemptID",
          },
          name: {
            $first: "$mission.name",
          },
          description: {
            $first: "$mission.description",
          },
          tags: {
            $first: "$mission.tags",
          },
          listing: {
            $first: "$listing",
          },
          listingXP: {
            $first: "$listingXP",
          },
          trutsXP: {
            $first: "$trutsXP",
          },
          completedAt: {
            $first: "$completedAt",
          },
        },
      },
      {
        $lookup: {
          from: "missiontags",
          localField: "tags",
          foreignField: "_id",
          as: "tags",
        },
      },
      {
        $project: {
          _id: 1,
          attemptID: 1,
          name: 1,
          description: 1,
          tags: 1,
          listing: {
            name: 1,
            slug: 1,
            photo: 1,
          },
          listingXP: 1,
          trutsXP: 1,
          completedAt: 1,
        },
      },
    ];
    const missions = await User_Mission.aggregate(aggregationPipeline);

    return new HTTPResponse(res, true, 200, null, null, {
      count: missions.length,
      missions,
    });
  } catch (error) {
    console.log("getMyCompletedMissions: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getMyTrutsXP = async (req, res) => {
  try {
    const user = req.user;

    const totalTrutsXP = await user.getTrutsXP();
    const level = await user.getLevelDetails();

    return new HTTPResponse(res, true, 200, null, null, {
      totalTrutsXP,
      level,
    });
  } catch (error) {
    console.log("getMyXP: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// ------ USER CONTROLLER (PUBLIC - NO AUTH) ------
exports.getUserDetails_Public = async (req, res) => {
  try {
    const username = req.params.username;
    const user = await User.findOne(
      {
        username: username,
        isCompleted: true,
      },
      {
        email: 0,
        googleId: 0,
        "wallets.nonce": 0,
        "discord.discriminator": 0,
        // "discord.id": 0,
        "discord.token_expiry": 0,
      }
    ).populate("tags");
    if (!user) {
      return new HTTPError(
        res,
        404,
        "user w/ given address not found",
        "user not found"
      );
    }
    return new HTTPResponse(res, true, 200, null, null, { user });
  } catch (error) {
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getMatchWithListedGuilds_Public = async (req, res) => {
  try {
    const username = req.params.username;
    let user = await User.findOne(
      { username: username, isCompleted: true },
      { "discord.guilds": 1 }
    );
    if (!user) {
      return new HTTPError(
        res,
        404,
        "user w/ given address not found",
        "user not found"
      );
    }

    // TEST:
    const pipeline = [
      {
        $match: {
          username: username,
        },
      },
      {
        $unwind: {
          path: "$discord.guilds",
        },
      },
      {
        $lookup: {
          from: "listing_socials",
          localField: "discord.guilds.id",
          foreignField: "meta.guild_id",
          as: "discordSocial",
        },
      },
      {
        $match: {
          discordSocial: {
            $ne: [],
          },
        },
      },
      {
        $unwind: {
          path: "$discordSocial",
        },
      },
      {
        $lookup: {
          from: "listings",
          localField: "discordSocial.listing",
          foreignField: "_id",
          as: "listing",
        },
      },
      {
        $unwind: {
          path: "$listing",
        },
      },
      {
        $project: {
          "listing._id": 1,
          "listing.name": 1,
          "listing.photo": 1,
          "listing.reviews": 1,
          "listing.slug": 1,
        },
      },
      {
        $lookup: {
          from: "listing_socials",
          localField: "listing._id",
          foreignField: "listing",
          as: "listing.socials",
        },
      },
    ];

    const user_listings = await User.aggregate(pipeline);
    const listings = user_listings.map((user_listing) => user_listing.listing);

    // let listings = await Dao.find(
    //   { guild_id: { $in: guildIds }, verified_status: true },
    //   {
    //     dao_name: 1,
    //     slug: 1,
    //     guild_id: 1,
    //     average_rating: 1,
    //     dao_cover: 1,
    //     dao_logo: 1,
    //     discord_link: 1,
    //     twitter_link: 1,
    //     website_link: 1,
    //     verified_status: 1,
    //     review_count: 1,
    //     twitter_followers: 1,
    //     discord_members: 1,
    //   }
    // );
    // listings = listings.map((listing) => {
    //   return {
    //     name: listing.dao_name,
    //     ratings: {
    //       average: listing.average_rating,
    //       count: listing.review_count,
    //     },
    //     discord: {
    //       id: listing.guild_id,
    //       link: listing.discord_link,
    //       count: listing.discord_members,
    //     },
    //     twitter: {
    //       // id: "",
    //       link: listing.twitter_link,
    //       count: listing.twitter_followers,
    //     },
    //     website: listing.website_link,
    //     image: {
    //       logo: {
    //         url: listing.dao_logo,
    //       },
    //       cover: {
    //         url: listing.dao_cover,
    //       },
    //     },
    //     slug: listing.slug,
    //   };
    // });

    return new HTTPResponse(res, true, 200, null, null, {
      count: listings.length,
      listings,
    });
  } catch (error) {
    console.log(error);
    return new HTTPError(res, 500, error, "Internal server error");
  }
};

exports.getUserReviews_Public = async (req, res) => {
  try {
    const username = req.params.username;
    const user = await User.findOne({
      username: username,
      isCompleted: true,
    });
    if (!user) {
      return new HTTPError(
        res,
        404,
        "user w/ given address not found",
        "user not found"
      );
    }

    let reviews = await Review.find({
      user: mongoose.Types.ObjectId(user._id),
    }).populate({
      path: "listing",
      select: { name: 1, photo: 1, slug: 1 },
    });

    reviews = reviews.map((review) => {
      if (!review.user) {
        return {
          ...review._doc,
          user: {
            name: review.oldData.public_address,
          },
          voteState: null,
        };
      } else {
        return { ...review._doc, voteState: null };
      }
    });

    return new HTTPResponse(res, true, 200, null, null, {
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    console.log("getUserReviews_Public: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getUserCompletedMissions_Public = async (req, res) => {
  try {
    const username = req.params.username;
    const user = await User.findOne({
      username: username,
      isCompleted: true,
    });
    if (!user) {
      return new HTTPError(
        res,
        404,
        "user w/ given address not found",
        "user not found"
      );
    }
    const userID = user._id;
    const aggregationPipeline = [
      {
        $match: {
          user: mongoose.Types.ObjectId(userID),
          isCompleted: true,
        },
      },
      {
        $project: {
          _id: 1,
          attemptID: "$_id",
          mission: 1,
          completedAt: 1,
          trutsXP: 1,
          listingXP: 1,
        },
      },
      {
        $lookup: {
          from: "missions",
          localField: "mission",
          foreignField: "_id",
          as: "mission",
        },
      },
      {
        $unwind: {
          path: "$mission",
        },
      },
      {
        $lookup: {
          // from: "daos",
          // TEST:
          from: "listings",
          localField: "mission.listing",
          foreignField: "_id",
          as: "listing",
        },
      },
      {
        $unwind: {
          path: "$listing",
        },
      },
      {
        $group: {
          _id: "$mission._id",
          attemptID: {
            $first: "$attemptID",
          },
          name: {
            $first: "$mission.name",
          },
          description: {
            $first: "$mission.description",
          },
          tags: {
            $first: "$mission.tags",
          },
          listing: {
            $first: "$listing",
          },
          listingXP: {
            $first: "$listingXP",
          },
          trutsXP: {
            $first: "$trutsXP",
          },
          completedAt: {
            $first: "$completedAt",
          },
        },
      },
      {
        $lookup: {
          from: "missiontags",
          localField: "tags",
          foreignField: "_id",
          as: "tags",
        },
      },
      {
        $project: {
          _id: 1,
          attemptID: 1,
          name: 1,
          description: 1,
          tags: 1,
          listing: {
            name: 1,
            slug: 1,
            photo: 1,
          },
          listingXP: 1,
          trutsXP: 1,
          completedAt: 1,
        },
      },
    ];
    const missions = await User_Mission.aggregate(aggregationPipeline);

    return new HTTPResponse(res, true, 200, null, null, {
      count: missions.length,
      missions,
    });
  } catch (error) {
    console.log("getMyCompletedMissions: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getUserTrutsXP_Public = async (req, res) => {
  try {
    const username = req.params.username;
    const user = await User.findOne(
      {
        username: username,
        isCompleted: true,
      },
      { _id: 1 } // Project only _id
    );
    if (!user) {
      return new HTTPError(
        res,
        404,
        "user w/ given address not found",
        "user not found"
      );
    }

    const totalTrutsXP = await user.getTrutsXP();
    const level = await user.getLevelDetails();

    console.log(user, totalTrutsXP, level);
    return new HTTPResponse(res, true, 200, null, null, {
      totalTrutsXP,
      level,
    });
  } catch (error) {
    console.log("getUserTrutsXP_Public: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getUserLeaderboard_Public = async (req, res) => {
  try {
    const limit = req.query.limit ?? 10;
    const agg = [
      {
        $group: {
          _id: "$user",
          totalXP: {
            $sum: "$value",
          },
          latestXPTxn: {
            $max: "$createdAt",
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: {
          path: "$user",
        },
      },
      {
        $project: {
          "user._id": 1,
          "user.photo": 1,
          "user.name": 1,
          "user.username": 1,
          totalXP: 1,
          latestXPTxn: 1,
        },
      },
      {
        $sort: {
          totalXP: -1,
          latestXPTxn: 1,
        },
      },
      {
        $limit: parseInt(limit),
      },
    ];
    const leaderboard = await XpTxn.aggregate(agg);

    return new HTTPResponse(res, true, 200, null, null, {
      count: leaderboard.length,
      leaderboard,
    });
  } catch (error) {
    console.log("getListingLeaderboard_Public: ", error);
  }
};

// -----  LOGOUT MANAGEMENT  --------

exports.logout = (req, res) => {
  // Delete the prexisting cookie of user by sending a Stale cookie
  res.cookie("token", null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });
  res.status(200).json({
    success: true,
    message: "Logout success",
  });
};

// ----- USER INTREST TAGS ------
exports.createUserIntrestTag = async (req, res) => {
  try {
    const { name } = req.body;

    const tag = await UserIntrestTag.create({ name });
    return new HTTPResponse(
      res,
      true,
      201,
      "user intrest tag created succesfully",
      null,
      { tag }
    );
  } catch (error) {
    return new HTTPError(res, 400, "invalid input", error);
  }
};

exports.getAllUserIntrestTags = async (req, res) => {
  try {
    const tags = await UserIntrestTag.find({});
    return new HTTPResponse(res, true, 200, null, null, { tags });
  } catch (error) {
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// ----- HELPER METHODS ------

const updateProfileImage = async (user, photo) => {
  try {
    const convertedBuffer = await sharp(photo.data).toFormat("webp").toBuffer();
    let data = await uploadToS3(
      "truts-users",
      user._id + ".webp",
      convertedBuffer
    );
    return data;
  } catch (error) {
    throw error;
  }
};

const attachReferral = async (user, code, session) => {
  try {
    console.log({ code });
    // use referral only during creation of account
    if (Date.now() - user.createdAt < 20 * 1000) {
      const referral = await Referral.findOne({ code }).session(session);
      console.log({ referral });
      if (
        referral && // only if referral exists
        referral.generatedBy != user._id // I can't use my own referral
      ) {
        await User.updateOne(
          { _id: user._id },
          {
            referredBy: {
              user: referral.generatedBy,
              code: code,
              isProviderRewarded: false,
            },
          },
          { session }
        );
        console.log("attached referral");
      } else {
        console.log("did not link referral: ", code);
      }
    } else {
      console.log(
        "did not link referral: ",
        code,
        " as account was already created"
      );
    }
  } catch (error) {
    console.log("attachReferral: ", error);
  }
};

// -------- FOR FUTURE ------------
// TEST: multi wallet login
// exports.loginViaWallet = async (req, res) => {
//   /* NOTE: This controller doesn't handle connect new wallet
//            only Login & Sign-up
//   */
//   const session = mongoose.session();
//   try {
//     const address = req.query.address;

//     await session.startTransaction();

//     // find a user with this wallet
//     let user = await User.findOne({
//       wallets: { $elemMatch: { address } },
//     }).populate({ path: "wallets", match: { address } });

//     let nonce;

//     if (!user) {
//       // creates new user if none match the wallet address
//       const newWallet = await Wallet.create(
//         {
//           address: address,
//           nonce: randomString(WALLET_NONCE_LENGTH),
//           isPrimary: true,
//         },
//         { session }
//       );

//       user = await User.create(
//         {
//           name: address,
//           wallets: { $push: newWallet },
//         },
//         { session }
//       ).populate("wallets");
//       await user.save();

//       msg = "New user created: (wallet)";
//       nonce = newWallet.nonce;
//     } else {
//       // just get a new nonce
//       let wallet = await Wallet.findByIdAndUpdate(
//         user.wallets[0]._id,
//         {
//           nonce: randomString(WALLET_NONCE_LENGTH),
//         },
//         { session, new: true }
//       );

//       msg = "login of existing user";
//       nonce = wallet.nonce;
//     }

//     await session.commitTransaction();
//     session.endSession();

//     console.log(msg);

//     // return nonce
//     return new HTTPResponse(res, true, 200, msg, null, {
//       nonce,
//     });
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json({
//       success: false,
//       msg: "internal server error",
//       error: error,
//     });
//   } finally {
//     session.endSession();
//   }
// };

// TEST: and support for Solana chain
// exports.verifyWallet = async (req, res) => {
//   try {
//     const { public_key, signature } = req.body;

//     let user = await User.findOne({
//       wallets: { $elemMatch: { address: public_key } },
//     }).populate({
//       path: "wallets",
//       match: { address: public_key },
//     });

//     // If no user with given public_key
//     if (!user) {
//       return new HTTPError(res, 404, "User w/ provided public_key not found");
//     }

//     const hash = ethers.utils.hashMessage(user.wallets[0].nonce);
//     const signing_address = ethers.utils.recoverAddress(hash, signature);

//     if (signing_address == public_key) {
//       await Wallet.findByIdAndUpdate(user.wallets[0]._id, {
//         verified: true,
//       });
//       user = await User.findById(user._id).populate("tags", "wallets");
//       cookieToken(user, res);
//     } else {
//       return new HTTPError(
//         res,
//         400,
//         "signature doesn't belong to this public key'",
//         "invalid verification"
//       );
//     }
//   } catch (error) {
//     console.log(error);
//     return new HTTPError(res, 500, error, "internal server error");
//   }
// };

// ----- MULTI WALLET MANAGEMENT -----
// TEST:
// exports.addNewWallet = async (req, res) => {
//   const session = await mongoose.startSession();
//   try {
//     const address = req.query.address;

//     const wallet_exists = await Wallet.findOne({ address });
//     if (wallet_exists) {
//       session.endSession();
//       return new HTTPError(
//         res,
//         400,
//         "try a different wallet address",
//         "The given wallet address already exists"
//       );
//     }

//     session.startTransaction();

//     const newWallet = await Wallet.create(
//       {
//         address: address,
//         nonce: randomString(WALLET_NONCE_LENGTH),
//       },
//       { session }
//     );

//     let user = await User.findByIdAndUpdate(
//       req.user.id,
//       { $push: { wallets: newWallet } },
//       { session }
//     );
//     await user.save();

//     await session.commitTransaction();
//     session.endSession();

//     return new HTTPResponse(res, true, 200, msg, null, {
//       nonce: newWallet.nonce,
//     });
//   } catch (error) {
//     session.endSession();
//     return new HTTPError(res, 500, error, "internal server error");
//   }
// };

// // TEST:
// exports.verifyNewWallet = async (req, res) => {
//   try {
//     const { public_key, signature } = req.body;

//     let user = await User.findOne({
//       wallets: { $elemMatch: { address: public_key } },
//     }).populate({
//       path: "wallets",
//       match: { address: public_key },
//     });

//     // If no user with given public_key
//     if (user._id != req.user.id) {
//       return new HTTPError(
//         res,
//         401,
//         "User doesn't have access to this public_key"
//       );
//     }
//     if (!user) {
//       return new HTTPError(res, 404, "User w/ provided public_key not found");
//     }

//     const hash = ethers.utils.hashMessage(user.wallets[0].nonce);
//     const signing_address = ethers.utils.recoverAddress(hash, signature);

//     if (signing_address == public_key) {
//       await Wallet.findByIdAndUpdate(user.wallets[0]._id, {
//         verified: true,
//       });
//       user = await User.findById(user._id).populate("tags", "wallets");
//       cookieToken(user, res);
//     } else {
//       return new HTTPError(
//         res,
//         400,
//         "signature doesn't belong to this public key'",
//         "invalid verification"
//       );
//     }
//   } catch (error) {
//     console.log(error);
//     return new HTTPError(res, 500, error, "internal server error");
//   }
// };

// // TEST:
// exports.setPrimaryWallet = async (req, res) => {
//   const session = await mongoose.startSession();
//   try {
//     const { address } = req.body;

//     let user = await User.findOne({
//       wallets: { $elemMatch: { address } },
//     }).populate({ path: "wallets", match: { address } });

//     if (!user) {
//       return new HTTPError(
//         res,
//         404,
//         "no user linked to this address",
//         "user not found"
//       );
//     }
//     if (user._id != req.user.id) {
//       return new HTTPError(
//         res,
//         401,
//         "The address doesn't belong to this user",
//         "unauthorized access"
//       );
//     }

//     await session.startTransaction();

//     // find current primary
//     user = await User.findById(user._id).populate({
//       path: "wallets",
//       match: { isPrimary: true },
//     });

//     // make current false
//     await Wallet.findOneAndUpdate(
//       { address: user.wallets[0].address },
//       { isPrimary: false }
//     );

//     // set new primary
//     await Wallet.findOneAndUpdate({ address: address }, { isPrimary: true });

//     await session.commitTransaction();
//     await session.endSession();

//     user = await User.findById(req.user.id).populate("tags", "wallets");
//     return new HTTPResponse(
//       res,
//       true,
//       200,
//       "New primary account is set",
//       null,
//       { user }
//     );
//   } catch (error) {
//     await session.endSession();
//     return new HTTPError(res, 500, error, "internal server error");
//   }
// };
