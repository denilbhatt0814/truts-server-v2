const router = require("express").Router();
const {
  getListingReviews,
  getListingReviews_Public,
  getListing,
  getListingLeaderboard_Public,
} = require("../controllers/listingController");
const { isLoggedIn } = require("../middlewares/user");

router.route("/listing/:slug").get(getListing);

router.route("/listing/:listingID/reviews").get(isLoggedIn, getListingReviews);
router
  .route("/public/listing/:listingID/reviews")
  .get(getListingReviews_Public);
router
  .route("/public/listing/:listingID/leaderboard")
  .get(getListingLeaderboard_Public);

module.exports = router;
