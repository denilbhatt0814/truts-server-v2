const express = require("express");
const passport = require("passport");
const router = express.Router();
const { DISCORD_OAUTH_URL } = require("../config/config");
const {
  signup,
  loginViaDiscord,
  logout,
  updateUserDeatils,
  getLoggedInUserDetails,
  getAllUserIntrestTags,
  createUserIntrestTag,
  loginViaGoogle,
  loginViaWallet,
  verifyWallet,
  testGoogleLogin,
} = require("../controllers/userController");
const { isLoggedIn } = require("../middlewares/user");

router.route("/signup").post(signup);

// ------ LOGIN ROUTES ------
router
  .route("/login/discord")
  .get((req, res) => res.redirect(DISCORD_OAUTH_URL));
router.route("/login/discord/callback").get(loginViaDiscord);

router.route("/login/google").post(loginViaGoogle);

router.route("/logout").get(logout);

router.route("/login/wallet").get(loginViaWallet);
router.route("/login/wallet/verify").post(verifyWallet);

// ------ USER ROUTES ------
router.route("/user").get(isLoggedIn, getLoggedInUserDetails);
router.route("/user/update").patch(isLoggedIn, updateUserDeatils);

router
  .route("/user/intrest-tag")
  .get(isLoggedIn, getAllUserIntrestTags)
  .post(isLoggedIn, createUserIntrestTag);

module.exports = router;
