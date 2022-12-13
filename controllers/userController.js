const sharp = require("sharp");
const User = require("../models/user");
const cookieToken = require("../utils/cookieToken");
const {
  getAccessTokenResponse,
  getUserDetails,
} = require("../utils/discordHelper");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");
const uploadToS3 = require("../utils/uploadToS3");

exports.signup = async (req, res) => {
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
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(401)
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
        .status(401)
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

exports.loginViaDiscord = async (req, res) => {
  try {
    const code = req.query.code;

    const accessResponse = await getAccessTokenResponse(code);
    // use access token to get user info - user ID n all (need to figure out)
    const discordUser = await getUserDetails(accessResponse.access_token);

    // update/insert user's discord details
    const options = {
      upsert: true, // Perform an upsert operation
      new: true, // Return the updated document, instead of the original
      setDefaultsOnInsert: true, // Set default values for any missing fields in the original document
    };
    let user = await User.findOneAndUpdate(
      { "discord.id": discordUser.id },
      {
        discord: {
          id: discordUser.id,
          username: discordUser.username,
          discriminator: discordUser.discriminator,
          email: discordUser.email,
          access_token: accessResponse.access_token,
          refresh_token: accessResponse.refresh_token,
          // TODO: add expiry to current
          token_expiry: new Date(Date.now() + accessResponse.expires_in / 1000), // expires_in is in seconds
        },
      },
      options
    );

    // add name if missing or if new user
    if (!user.name) {
      user = await User.findOneAndUpdate(
        { _id: user._id },
        { name: user.discord.username },
        {
          new: true,
        }
      );
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

// ------ USER CONTROLLER ------
exports.getLoggedInUserDetails = async (req, res) => {
  return new HTTPResponse(res, true, 200, null, null, { user: req.user });
};

exports.updateUserDeatils = async (req, res) => {
  try {
    // get new data
    const newData = {
      name: req.body.name,
      bio: req.body.bio,
    };

    // if asked for photo update
    if (req.files.photo != "") {
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
    });

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
