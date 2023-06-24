const router = require("express").Router();
const {
  getListingReviews,
  getListingReviews_Public,
  getListing,
  getListingLeaderboard_Public,
  getListings,
  getListingCountInAChain,
  getListingCountInACategory,
  getListingMissions_Public,
  addNewListing,
  getSupportedSocials,
  getSupportedPlatforms,
  verifyListing,
} = require("../controllers/listingController");
const cacheRoute = require("../middlewares/cacheRoute");
const paginateRequest = require("../middlewares/paginate");
// const cacheRoute = require("../middlewares/cacheRoute");
const { isLoggedIn } = require("../middlewares/user");
// const Listing = require("../models/dao");
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
router.route("/listing/verify").post(isLoggedIn, verifyListing);
router.route("/listing/chains").get(getListingCountInAChain);
router.route("/listing/categories").get(cacheRoute, getListingCountInACategory);
router
  .route("/listing/supported-platforms")
  .get(cacheRoute, getSupportedPlatforms);
router.route("/listing/:slug").get(getListing);

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
  .route("/public/listing/:listingID/leaderboard")
  .get(getListingLeaderboard_Public);

module.exports = router;
