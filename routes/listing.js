const router = require("express").Router();
const {
  getListingReviews,
  getListingReviews_Public,
  getListing,
  getListingLeaderboard_Public,
  getListings,
  getListingCountInAChain,
  getListingCountInACategory,
} = require("../controllers/listingController");
const paginateRequest = require("../middlewares/paginate");
const cacheRoute = require("../middlewares/cacheRoute");
const { isLoggedIn } = require("../middlewares/user");
const Listing = require("../models/dao");

router.route("/listings").get(paginateRequest(Listing), getListings);
router.route("/listings/chains").get(cacheRoute, getListingCountInAChain);
router.route("/listings/categories").get(getListingCountInACategory);
router.route("/listing/:slug").get(getListing);

router.route("/listing/:listingID/reviews").get(isLoggedIn, getListingReviews);
router
  .route("/public/listing/:listingID/reviews")
  .get(getListingReviews_Public);
router
  .route("/public/listing/:listingID/leaderboard")
  .get(getListingLeaderboard_Public);

module.exports = router;
