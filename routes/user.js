const express = require("express");
const { DISCORD_OAUTH_URL } = require("../config/config");
const { home } = require("../controllers/home");
const {
  signup,
  loginViaDiscord,
  logout,
} = require("../controllers/userController");
const { isLoggedIn } = require("../middlewares/user");

const router = express.Router();

router.route("/signup").post(signup);

// ------ LOGIN ROUTES ------
router.route("/login/discord/callback").get(loginViaDiscord);
router
  .route("/login/discord")
  .get((req, res) => res.redirect(DISCORD_OAUTH_URL));

router.route("/logout").get(logout);

// ------ USER ROUTES ------
router.route("/user/update").get(isLoggedIn, home);

module.exports = router;
