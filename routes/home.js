const { home } = require("../controllers/home");

const router = require("express").Router();

router.route("/").get(home);

module.exports = router;
