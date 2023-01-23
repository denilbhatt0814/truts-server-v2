const {
  createMission,
  getMissions,
  getOneMission,
  performTask,
  claimMissionCompletion,
  myAttemptedMissionStatus,
} = require("../controllers/missionController");
const { isLoggedIn } = require("../middlewares/user");

const router = require("express").Router();

// TEST: ALL MISSION ROUTES AND CONTROLLERS ARE TO BE TESTED
// /mission?communityID= for all mission of a community
router.route("/mission").get(getMissions).post(createMission);
router.route("/mission/:missionID").get(getOneMission);

router.get(
  "/mission/:missionID/my-status",
  isLoggedIn,
  myAttemptedMissionStatus
);

// task verification and
router.get("/mission/:misisonID/task-verify/:taskID", isLoggedIn, performTask);

// mission claim
router.get("/mission/:misisonID/claim", isLoggedIn, claimMissionCompletion);

module.exports = router;
