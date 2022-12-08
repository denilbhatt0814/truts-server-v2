const User = require("../models/user");
const cookieToken = require("../utils/cookieToken");

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

exports.update = () => {};

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
