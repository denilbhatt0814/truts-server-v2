const express = require("express");
const { signup } = require("../controllers/userController");

const router = express.Router();

router.route("/signup").post(signup);

router.route("/logout").get(logout);

module.exports = router;
