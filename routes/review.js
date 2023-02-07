const { addReview } = require("../controllers/reviewController");
const router = require("express").Router();
const { isLoggedIn } = require("../middlewares/user");

router.route("/review").post(isLoggedIn, addReview);

module.exports = router;
