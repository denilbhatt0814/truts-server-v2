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
} = require("../controllers/listingController");
const cacheRoute = require("../middlewares/cacheRoute");
const paginateRequest = require("../middlewares/paginate");
// const cacheRoute = require("../middlewares/cacheRoute");
const { isLoggedIn } = require("../middlewares/user");
const Listing = require("../models/dao");

router
  .route("/listings")
  .get(cacheRoute, paginateRequest(Listing), getListings)
  .post(isLoggedIn, addNewListing);
// NOTE: CacheRoute could be modified after bringing on
//        add a community feature to this server
router.route("/listings/chains").get(cacheRoute, getListingCountInAChain);
router
  .route("/listings/categories")
  .get(cacheRoute, getListingCountInACategory);
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
