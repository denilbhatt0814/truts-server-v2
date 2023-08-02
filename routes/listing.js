const router = require("express").Router();
const {
  getListingReviews,
  getListingReviews_Public,
  getListingBySlug,
  getListingLeaderboard_Public,
  getListings,
  getListingCountInAChain,
  getListingCountInACategory,
  getListingMissions_Public,
  addNewListing,
  getSupportedSocials,
  getSupportedPlatforms,
  verifyListing,
  updateListing,
  updateSocialOfListing,
  getSocialsOfListing,
  getLeaderboardOfListing_Public,
  getToBeVerifiedListings,
  getListingChainMapping,
  updateListing_ADMIN,
  updateSocialOfListing_ADMIN,
  getListing_ADMIN,
  getSocialsOfListing_ADMIN,
} = require("../controllers/listingController");
const cacheRoute = require("../middlewares/cacheRoute");
const paginateRequest = require("../middlewares/paginate");
const {
  isLoggedIn,
  onlySuperAdmin,
  checkAdminTeam,
} = require("../middlewares/user");
const { Listing } = require("../models/listing");

router
  .route("/listing")
  .get(
    cacheRoute,
    paginateRequest(Listing, {}, [
      {
        $lookup: {
          from: "listing_socials",
          localField: "_id",
          foreignField: "listing",
          as: "socials",
        },
      },
    ]),
    getListings
  )
  .post(isLoggedIn, addNewListing);

// NOTE: CacheRoute could be modified after bringing on
//        verify a community feature to this server
router
  .route("/listing/verify")
  .get(getToBeVerifiedListings)
  .post(isLoggedIn, onlySuperAdmin, verifyListing);
router.route("/listing/chains").get(getListingCountInAChain);
router.route("/listing/chains/mapping").get(getListingChainMapping);
router.route("/listing/categories").get(cacheRoute, getListingCountInACategory);
router.route("/listing/supported-platforms").get(getSupportedPlatforms);
router.route("/listing/by-slug/:slug").get(getListingBySlug);

router
  .route("/listing/:listingID")
  .patch(isLoggedIn, onlySuperAdmin, updateListing);
router
  .route("/listing/:listingID/social")
  .get(getSocialsOfListing)
  .patch(isLoggedIn, onlySuperAdmin, updateSocialOfListing);

router.route("/listing/:listingID/reviews").get(isLoggedIn, getListingReviews);
router
  .route("/public/listing/:listingID/reviews")
  .get(getListingReviews_Public);

// TODO: authenicated get missions for marking is completed in advance to match
// router.route("/listing/:listingID/missions").get(isLoggedIn, getListingReviews);
router
  .route("/public/listing/:listingID/missions")
  .get(getListingMissions_Public);

router
  .route("/public/listing/leaderboard")
  .get(cacheRoute, getListingLeaderboard_Public);

router
  .route("/public/listing/:listingID/leaderboard")
  .get(getLeaderboardOfListing_Public);

// ADMIN ROUTES:
router
  .route("/admin/:adminTeamID/listing/:listingID")
  .get(isLoggedIn, checkAdminTeam, getListing_ADMIN)
  .patch(isLoggedIn, checkAdminTeam, updateListing_ADMIN);
router
  .route("/admin/:adminTeamID/listing/:listingID/social")
  .get(isLoggedIn, checkAdminTeam, getSocialsOfListing_ADMIN)
  .patch(isLoggedIn, checkAdminTeam, updateSocialOfListing_ADMIN);

module.exports = router;
