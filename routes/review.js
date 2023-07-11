const {
  addReview,
  getReviewByID,
  generateReviewOG,
} = require("../controllers/reviewController");
const { castVoteToReview } = require("../controllers/voteReviewController");
const router = require("express").Router();
const { isLoggedIn } = require("../middlewares/user");

router.route("/review").post(isLoggedIn, addReview);
router.route("/review/:reviewID").get(getReviewByID); //TODO:
router.route("/review/:reviewID/og").post(generateReviewOG);
router.route("/review/:reviewID/vote").post(isLoggedIn, castVoteToReview);

module.exports = router;
