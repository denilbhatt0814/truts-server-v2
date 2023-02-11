const router = require("express").Router();
const {
  getListingReviews,
  getListingReviews_Public,
} = require("../controllers/listingController");
const { isLoggedIn } = require("../middlewares/user");

// TEST:
router.route("/listing/:listingID/reviews").get(isLoggedIn, getListingReviews);
router
  .route("/public/listing/:listingID/reviews")
  .get(getListingReviews_Public);

module.exports = router;
