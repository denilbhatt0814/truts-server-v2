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
  getUserDetails_Public,
  getMatchWithListedGuilds_Public,
  getUserReviews_Public,
  loginViaTwitter,
  connectTwitter,
  getMyTrutsXP,
  getUserTrutsXP_Public,
  getMyCompletedMissions,
  isUsernameAvailable,
  setMyUsername,
  getUserCompletedMissions_Public,
  getUserReviews,
  getMyReferralDetails,
} = require("../controllers/userController");
const { isLoggedIn } = require("../middlewares/user");
const randomString = require("../utils/randomString");
const { authorizeTwitterURI } = require("../utils/twitterHelper");

router.route("/signup").post(signup);

// ------ LOGIN ROUTES ------
router
  .route("/login/discord")
  .get((req, res) => res.redirect(DISCORD_OAUTH_URL));
router.route("/login/discord/callback").get(loginViaDiscord);

router
  .route("/connect/twitter")
  .get((req, res) => res.redirect(authorizeTwitterURI(randomString(5))));
router.route("/connect/twitter/callback").get(connectTwitter);

router.route("/login/google").post(loginViaGoogle);

router.route("/logout").get(logout);

router.route("/login/wallet").get(loginViaWallet);
router.route("/login/wallet/verify").post(verifyWallet);

// ------ WALLET ROUTES (FUTURE) ------
// TEST: need to test these new routes
// router.route("/user/wallet/connect").get(isLoggedIn, addNewWallet);
// router.route("/user/wallet/verify").post(isLoggedIn, verifyWallet);
// router.route("/user/wallet/primary").patch(isLoggedIn, setPrimaryWallet);
// TODO: delete a wallet

// ------NOTE: USER ROUTES : when Authenticated ------
router.route("/user").get(isLoggedIn, getMyUserDetails);
router.route("/user/reviews").get(isLoggedIn, getMyReviews);
router.route("/user/guilds").get(isLoggedIn, getMyMatchWithListedGuilds);
router.route("/user/truts-xp").get(isLoggedIn, getMyTrutsXP);
router.route("/user/completed-mission").get(isLoggedIn, getMyCompletedMissions);
router.route("/user/referral").get(isLoggedIn, getMyReferralDetails);

// Edit Profile related routes
router.route("/user/update").patch(isLoggedIn, updateUserDeatils);
router.route("/user/set/username").patch(isLoggedIn, setMyUsername);
router
  .route("/user/availability/username")
  .get(isLoggedIn, isUsernameAvailable); // ?username=bond007

router
  .route("/user/intrest-tag")
  .get(isLoggedIn, getAllUserIntrestTags)
  .post(isLoggedIn, createUserIntrestTag);

router.route("/user/:address").get(isLoggedIn, getUserDetails_Public);
router
  .route("/user/:address/guilds")
  .get(isLoggedIn, getMatchWithListedGuilds_Public);

router.route("/user/:address/reviews").get(isLoggedIn, getUserReviews);

router.route("/user/:address/truts-xp").get(isLoggedIn, getUserTrutsXP_Public);

router
  .route("/user/:address/completed-mission")
  .get(isLoggedIn, getUserCompletedMissions_Public);

// ------- NOTE: USER PUBLIC ROUTES : (for lurker/ not logged-in ) ------------
router.route("/public/user/:address").get(getUserDetails_Public);
router
  .route("/public/user/:address/guilds")
  .get(getMatchWithListedGuilds_Public);

// TEST:
router.route("/public/user/:address/reviews").get(getUserReviews_Public);

router.route("/public/user/:address/truts-xp").get(getUserTrutsXP_Public);
router
  .route("/public/user/:address/completed-mission")
  .get(getUserCompletedMissions_Public);

module.exports = router;
