const {
  tempTokenFormController,
  tempTokenQRController,
} = require("../controllers/tempTokenController");
const { isLoggedIn, onlySuperAdmin } = require("../middlewares/user");

const router = require("express").Router();

router.post("/temp/form", isLoggedIn, tempTokenFormController);
router.post("/temp/qr", isLoggedIn, tempTokenQRController);

module.exports = router;
