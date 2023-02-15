const router = require("express").Router();
const {
  getListingReviews,
  getListingReviews_Public,
  getListing,
} = require("../controllers/listingController");
const { isLoggedIn } = require("../middlewares/user");

router.route("/listing/:slug").get(getListing);

router.route("/listing/:listingID/reviews").get(isLoggedIn, getListingReviews);
router
  .route("/public/listing/:listingID/reviews")
  .get(getListingReviews_Public);

module.exports = router;
