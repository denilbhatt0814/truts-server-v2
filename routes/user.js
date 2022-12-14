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
} = require("../controllers/userController");
const { isLoggedIn } = require("../middlewares/user");
const cookieToken = require("../utils/cookieToken");

router.route("/signup").post(signup);

// ------ LOGIN ROUTES ------
router
  .route("/login/discord")
  .get((req, res) => res.redirect(DISCORD_OAUTH_URL));
router.route("/login/discord/callback").get(loginViaDiscord);

router.route("/login/google").get(
  passport.authenticate("google", {
    scope: ["email", "profile"],
    session: false,
  }),
  (req, res) => {
    res.send("login with google");
  }
);
router
  .route("/login/google/callback")
  .get(passport.authenticate("google", { session: false }), (req, res) => {
    cookieToken(req.user, res);
  });

router.route("/logout").get(logout);

// ------ USER ROUTES ------
router.route("/user").get(isLoggedIn, getLoggedInUserDetails);
router.route("/user/update").patch(isLoggedIn, updateUserDeatils);

router
  .route("/user/intrest-tag")
  .get(isLoggedIn, getAllUserIntrestTags)
  .post(isLoggedIn, createUserIntrestTag);

module.exports = router;
