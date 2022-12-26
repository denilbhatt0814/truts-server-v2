const express = require("express");
const router = express.Router();
const { DISCORD_OAUTH_URL } = require("../config/config");
const {
  signup,
  loginViaDiscord,
  logout,
  updateUserDeatils,
  getMyUserDetails,
  getAllUserIntrestTags,
  createUserIntrestTag,
  loginViaGoogle,
  loginViaWallet,
  verifyWallet,
  setPrimaryWallet,
  getMyMatchWithListedGuilds,
  getMyReviews,
  getUserDetails,
  getMatchWithListedGuilds,
  getUserReviews,
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

// TEST: login wallet
router.route("/login/wallet").get(loginViaWallet);
router.route("/login/wallet/verify").post(verifyWallet);

// ------ WALLET ROUTES (FUTURE) ------
// TEST: need to test these new routes
// router.route("/user/wallet/connect").get(isLoggedIn, addNewWallet);
// router.route("/user/wallet/verify").post(isLoggedIn, verifyWallet);
// router.route("/user/wallet/primary").patch(isLoggedIn, setPrimaryWallet);
// TODO: delete a wallet

// ------ USER ROUTES ------
router.route("/user").get(isLoggedIn, getMyUserDetails);
router.route("/user/guilds").get(isLoggedIn, getMyMatchWithListedGuilds);
router.route("/user/reviews").get(isLoggedIn, getMyReviews);
router.route("/user/update").patch(isLoggedIn, updateUserDeatils);

router
  .route("/user/intrest-tag")
  .get(isLoggedIn, getAllUserIntrestTags)
  .post(isLoggedIn, createUserIntrestTag);

// UNDER-WORK: Public routes
router.route("/public/user/:address").get(isLoggedIn, getUserDetails);
router
  .route("/public/user/:address/guilds")
  .get(isLoggedIn, getMatchWithListedGuilds);
router.route("/public/user/:address/reviews").get(isLoggedIn, getUserReviews);

module.exports = router;
