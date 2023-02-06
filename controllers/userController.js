const sharp = require("sharp");
const User = require("../models/user");
const { User_Mission } = require("../models/user_mission");
const Wallet = require("../models/wallet");
const Dao = require("../models/dao");
const Review = require("../models/review");
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

const { OAuth2Client } = require("google-auth-library");
const {
  exchangeTwitterToken,
  getUserTwitterDetails,
} = require("../utils/twitterHelper");

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

exports.loginViaGoogle = async (req, res) => {
  try {
    const g_token = req.body.token;
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
    };
    let user = await User.findOneAndUpdate(
      filter,
      {
        googleId: profile.sub,
        email: profile.email,
      },
      options
    ).populate("tags");

    // add name if missing or if new user
    if (!user.name) {
      user = await User.findOneAndUpdate(
        { _id: user._id },
        { name: profile.name },
        {
          new: true,
        }
      ).populate("tags");
    }

    // return jwt token
    cookieToken(user, res);
  } catch (error) {
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
    const user = await User.findById("63d51fe5e590b56c1b989db9");
    const data = await exchangeTwitterToken(code);
    const user_data = await getUserTwitterDetails(data.access_token);

    user.twitter = {
      id: user_data.data.id,
      name: user_data.data.name,
      username: user_data.data.username,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expiry: new Date(Date.now() + data.expires_in * 1000), // expires_in is in seconds
    };
    await user.save();
    res.json({ code, data, user_data, user });
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
    let user = await User.findOneAndUpdate(
      filter,
      {
        wallets: {
          address: address,
          nonce: randomString(WALLET_NONCE_LENGTH),
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
  try {
    const { public_key, signature, chain } = req.body;

    let user = await User.findOne({ "wallets.address": public_key });

    // If no user with given public_key
    if (!user) {
      return new HTTPError(res, 401, "User w/ provided public_key not found");
    }

    let evm_verified, sol_verified;
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

      default:
        return new HTTPError(
          res,
          400,
          "chain must be either one of: ['EVM', 'SOL']",
          "invalid chain enum"
        );
    }

    if (evm_verified || sol_verified) {
      user = await User.findByIdAndUpdate(user._id, {
        "wallets.verified": true,
        "wallets.chain": chain,
      }).populate("tags");
      cookieToken(user, res);
    } else {
      return new HTTPError(
        res,
        400,
        "signature doesn't belong to this public key'",
        "invalid verification"
      );
    }
  } catch (error) {
    console.log(error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// ------ USER CONTROLLER (PRIVATE) ------
exports.getMyUserDetails = async (req, res) => {
  return new HTTPResponse(res, true, 200, null, null, { user: req.user });
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

    const guildIds = user.discord.guilds.map((guild) => guild.id);
    let listings = await Dao.find(
      { guild_id: { $in: guildIds }, verified_status: true },
      {
        dao_name: 1,
        slug: 1,
        guild_id: 1,
        average_rating: 1,
        dao_cover: 1,
        dao_logo: 1,
        discord_link: 1,
        twitter_link: 1,
        website_link: 1,
        verified_status: 1,
        review_count: 1,
        twitter_followers: 1,
        discord_members: 1,
      }
    );
    listings = listings.map((listing) => {
      return {
        name: listing.dao_name,
        ratings: {
          average: listing.average_rating,
          count: listing.review_count,
        },
        discord: {
          id: listing.guild_id,
          link: listing.discord_link,
          count: listing.discord_members,
        },
        twitter: {
          // id: "",
          link: listing.twitter_link,
          count: listing.twitter_followers,
        },
        website: listing.website_link,
        image: {
          logo: {
            url: listing.dao_logo,
          },
          cover: {
            url: listing.dao_cover,
          },
        },
        slug: listing.slug,
      };
    });

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
    if (!req.user.discord) {
      return new HTTPError(
        res,
        400,
        "Please link your discord account",
        "Discord not connected"
      );
    }

    let reviews = await Review.find({ user_discord_id: req.user.discord.id });
    reviews = reviews.map((review) => {
      return {
        rating: review.rating,
        content: review.review_desc,
        listing: {
          name: review.dao_name,
          discord: {
            id: review.guild_id,
          },
        },
        vote: {
          up: {
            count: review.thumbs_up,
          },
          down: {
            count: review.thumbs_down,
          },
        },
        updatedAt: review.updatedAt,
      };
    });
    return new HTTPResponse(res, true, 200, null, null, { reviews });
  } catch (error) {
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
          from: "daos",
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
            name: "$listing.dao_name",
            slug: "$listing.slug",
            photo: {
              logo: {
                secure_url: "$listing.dao_logo",
              },
            },
          },
          listingXP: 1,
          trutsXP: 1,
          completedAt: 1,
        },
      },
    ];
    const missions = await User_Mission.aggregate(aggregationPipeline);

    return new HTTPResponse(res, true, 200, null, null, { missions });
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

// ------ USER CONTROLLER (PUBLIC) ------
exports.getUserDetails = async (req, res) => {
  try {
    const address = req.params.address;
    const user = await User.findOne(
      {
        "wallets.address": address,
        isCompleted: true,
      },
      {
        email: 0,
        googleId: 0,
        "wallets.nonce": 0,
        "discord.discriminator": 0,
        "discord.id": 0,
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

exports.getMatchWithListedGuilds = async (req, res) => {
  try {
    const address = req.params.address;
    let user = await User.findOne(
      { "wallets.address": address, isCompleted: true },
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
    const guildIds = user.discord.guilds.map((guild) => guild.id);
    let listings = await Dao.find(
      { guild_id: { $in: guildIds }, verified_status: true },
      {
        dao_name: 1,
        slug: 1,
        guild_id: 1,
        average_rating: 1,
        dao_cover: 1,
        dao_logo: 1,
        discord_link: 1,
        twitter_link: 1,
        website_link: 1,
        verified_status: 1,
        review_count: 1,
        twitter_followers: 1,
        discord_members: 1,
      }
    );
    listings = listings.map((listing) => {
      return {
        name: listing.dao_name,
        ratings: {
          average: listing.average_rating,
          count: listing.review_count,
        },
        discord: {
          id: listing.guild_id,
          link: listing.discord_link,
          count: listing.discord_members,
        },
        twitter: {
          // id: "",
          link: listing.twitter_link,
          count: listing.twitter_followers,
        },
        website: listing.website_link,
        image: {
          logo: {
            url: listing.dao_logo,
          },
          cover: {
            url: listing.dao_cover,
          },
        },
        slug: listing.slug,
      };
    });

    return new HTTPResponse(res, true, 200, null, null, {
      count: listings.length,
      listings,
    });
  } catch (error) {
    console.log(error);
    return new HTTPError(res, 500, error, "Internal server error");
  }
};

exports.getUserReviews = async (req, res) => {
  try {
    const address = req.params.address;
    const user = await User.findOne({
      "wallets.address": address,
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

    let reviews = await Review.find({ user_discord_id: user.discord.id });
    reviews = reviews.map((review) => {
      return {
        rating: review.rating,
        content: review.review_desc,
        listing: {
          name: review.dao_name,
          discord: {
            id: review.guild_id,
          },
        },
        vote: {
          up: {
            count: review.thumbs_up,
          },
          down: {
            count: review.thumbs_down,
          },
        },
        updatedAt: review.updatedAt,
      };
    });
    return new HTTPResponse(res, true, 200, null, null, { reviews });
  } catch (error) {
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getUserCompletedMissions = async (req, res) => {
  try {
    const address = req.params.address;
    const user = await User.findOne({
      "wallets.address": address,
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
          from: "daos",
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
            name: "$listing.dao_name",
            slug: "$listing.slug",
            photo: {
              logo: {
                secure_url: "$listing.dao_logo",
              },
            },
          },
          listingXP: 1,
          trutsXP: 1,
          completedAt: 1,
        },
      },
    ];
    const missions = await User_Mission.aggregate(aggregationPipeline);

    return new HTTPResponse(res, true, 200, null, null, { missions });
  } catch (error) {
    console.log("getMyCompletedMissions: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getUserTrutsXP = async (req, res) => {
  try {
    const address = req.params.address;
    const user = await User.findOne(
      {
        "wallets.address": address,
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
    console.log("getUserTrutsXP: ", error);
    return new HTTPError(res, 500, error, "internal server error");
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
exports.addNewWallet = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const address = req.query.address;

    const wallet_exists = await Wallet.findOne({ address });
    if (wallet_exists) {
      session.endSession();
      return new HTTPError(
        res,
        400,
        "try a different wallet address",
        "The given wallet address already exists"
      );
    }

    session.startTransaction();

    const newWallet = await Wallet.create(
      {
        address: address,
        nonce: randomString(WALLET_NONCE_LENGTH),
      },
      { session }
    );

    let user = await User.findByIdAndUpdate(
      req.user.id,
      { $push: { wallets: newWallet } },
      { session }
    );
    await user.save();

    await session.commitTransaction();
    session.endSession();

    return new HTTPResponse(res, true, 200, msg, null, {
      nonce: newWallet.nonce,
    });
  } catch (error) {
    session.endSession();
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// TEST:
exports.verifyNewWallet = async (req, res) => {
  try {
    const { public_key, signature } = req.body;

    let user = await User.findOne({
      wallets: { $elemMatch: { address: public_key } },
    }).populate({
      path: "wallets",
      match: { address: public_key },
    });

    // If no user with given public_key
    if (user._id != req.user.id) {
      return new HTTPError(
        res,
        401,
        "User doesn't have access to this public_key"
      );
    }
    if (!user) {
      return new HTTPError(res, 404, "User w/ provided public_key not found");
    }

    const hash = ethers.utils.hashMessage(user.wallets[0].nonce);
    const signing_address = ethers.utils.recoverAddress(hash, signature);

    if (signing_address == public_key) {
      await Wallet.findByIdAndUpdate(user.wallets[0]._id, {
        verified: true,
      });
      user = await User.findById(user._id).populate("tags", "wallets");
      cookieToken(user, res);
    } else {
      return new HTTPError(
        res,
        400,
        "signature doesn't belong to this public key'",
        "invalid verification"
      );
    }
  } catch (error) {
    console.log(error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// TEST:
exports.setPrimaryWallet = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { address } = req.body;

    let user = await User.findOne({
      wallets: { $elemMatch: { address } },
    }).populate({ path: "wallets", match: { address } });

    if (!user) {
      return new HTTPError(
        res,
        404,
        "no user linked to this address",
        "user not found"
      );
    }
    if (user._id != req.user.id) {
      return new HTTPError(
        res,
        401,
        "The address doesn't belong to this user",
        "unauthorized access"
      );
    }

    await session.startTransaction();

    // find current primary
    user = await User.findById(user._id).populate({
      path: "wallets",
      match: { isPrimary: true },
    });

    // make current false
    await Wallet.findOneAndUpdate(
      { address: user.wallets[0].address },
      { isPrimary: false }
    );

    // set new primary
    await Wallet.findOneAndUpdate({ address: address }, { isPrimary: true });

    await session.commitTransaction();
    await session.endSession();

    user = await User.findById(req.user.id).populate("tags", "wallets");
    return new HTTPResponse(
      res,
      true,
      200,
      "New primary account is set",
      null,
      { user }
    );
  } catch (error) {
    await session.endSession();
    return new HTTPError(res, 500, error, "internal server error");
  }
};
