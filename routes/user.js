const express = require("express");
const {
  signup,
  loginViaDiscord,
  logout,
} = require("../controllers/userController");

const router = express.Router();

router.route("/signup").post(signup);
router.route("/login/discord").get(loginViaDiscord);
router.route("/logout").get(logout);

module.exports = router;
