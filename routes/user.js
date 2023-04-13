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
  getUserLeaderboard_Public,
  updateUserSocialLinks,
  deleteUserSocialLinks,
  loginViaMultiWallet,
  verifyMultiWallet,
  addNewWallet,
  removeAWallet,
  changeWallet,
  verifyChangedWallet,
  verifyNewMultiWallet,
  getMyProfileStatus,
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
router.route("/connect/twitter/callback").get(isLoggedIn, connectTwitter);

router.route("/login/google").post(loginViaGoogle);

router.route("/logout").get(logout);

// ------ WALLET ROUTES (FUTURE) ------
// first link and verification / login
router.route("/login/wallet").get(loginViaMultiWallet);
router.route("/login/wallet/verify").post(verifyMultiWallet);

// adding new wallet and verify
router.route("/user/wallet/new").post(isLoggedIn, addNewWallet);
router.route("/user/wallet/verify-new").post(isLoggedIn, verifyNewMultiWallet);
router.route("/user/wallet/primary").patch(isLoggedIn, setPrimaryWallet);
router.route("/user/wallet/change").patch(isLoggedIn, changeWallet);
router
  .route("/user/wallet/verify-change")
  .post(isLoggedIn, verifyChangedWallet);
router.route("/user/wallet/:address").delete(isLoggedIn, removeAWallet);

// ------NOTE: USER ROUTES : when Authenticated ------
router.route("/user").get(isLoggedIn, getMyUserDetails);
router.route("/user/reviews").get(isLoggedIn, getMyReviews);
router.route("/user/guilds").get(isLoggedIn, getMyMatchWithListedGuilds);
router.route("/user/truts-xp").get(isLoggedIn, getMyTrutsXP);
router.route("/user/completed-mission").get(isLoggedIn, getMyCompletedMissions);
router.route("/user/referral").get(isLoggedIn, getMyReferralDetails);

router.route("/user/profile/status").get(isLoggedIn, getMyProfileStatus);

// Edit Profile related routes
router
  .route("/user/socials")
  .post(isLoggedIn, updateUserSocialLinks)
  .delete(isLoggedIn, deleteUserSocialLinks);
router.route("/user/update").patch(isLoggedIn, updateUserDeatils);
router.route("/user/set/username").patch(isLoggedIn, setMyUsername);
router
  .route("/user/availability/username")
  .get(isLoggedIn, isUsernameAvailable); // ?username=bond007

router
  .route("/user/intrest-tag")
  .get(isLoggedIn, getAllUserIntrestTags)
  .post(isLoggedIn, createUserIntrestTag);

router.route("/user/:username").get(isLoggedIn, getUserDetails_Public);
router
  .route("/user/:username/guilds")
  .get(isLoggedIn, getMatchWithListedGuilds_Public);

router.route("/user/:username/reviews").get(isLoggedIn, getUserReviews);

router.route("/user/:username/truts-xp").get(isLoggedIn, getUserTrutsXP_Public);

router
  .route("/user/:username/completed-mission")
  .get(isLoggedIn, getUserCompletedMissions_Public);

// ------- NOTE: USER PUBLIC ROUTES : (for lurker/ not logged-in ) ------------
router.route("/public/user/:username").get(getUserDetails_Public);
router
  .route("/public/user/:username/guilds")
  .get(getMatchWithListedGuilds_Public);

// TEST:
router.route("/public/users/leaderboard").get(getUserLeaderboard_Public);
router.route("/public/user/:username/reviews").get(getUserReviews_Public);

router.route("/public/user/:username/truts-xp").get(getUserTrutsXP_Public);
router
  .route("/public/user/:username/completed-mission")
  .get(getUserCompletedMissions_Public);

module.exports = router;
