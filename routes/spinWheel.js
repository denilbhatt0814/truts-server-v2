const {
  getWheel,
  createWheel,
  checkSpinAbility,
  spinTheWheel,
  streakStatusCheck,
  streakUpdationCheck,
} = require("../controllers/spinWheelController");
const { isLoggedIn } = require("../middlewares/user");
const { createSpinReward } = require("../controllers/spinRewardController");
const {
  createSpinRewardTemplate,
} = require("../controllers/spinRewardTemplateController");

const router = require("express").Router();

router.route("/wheel").get(getWheel).post(isLoggedIn, createWheel);
router.route("/wheel/my-status").get(isLoggedIn, checkSpinAbility);
router.route("/wheel/spin").get(isLoggedIn, spinTheWheel);

router.route("/wheel/reward").post(createSpinReward);
router.route("/wheel/reward-template").post(createSpinRewardTemplate);

// TEST:
router.route("/wheel/my-streak").get(isLoggedIn, streakStatusCheck);
router.route("/wheel/streak-updation").get(isLoggedIn, streakUpdationCheck);

module.exports = router;
