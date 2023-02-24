const { home } = require("../controllers/home");
const { getWhomIFollowOnTwitter } = require("../controllers/userController");
const { isLoggedIn } = require("../middlewares/user");

const router = require("express").Router();

router.route("/").get(home);
router.route("/test").get(isLoggedIn, getWhomIFollowOnTwitter);

module.exports = router;
