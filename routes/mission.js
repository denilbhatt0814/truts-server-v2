const {
  createMission,
  getMissions,
  getOneMission,
  performTask,
  claimMissionCompletion,
  myAttemptedMissionStatus,
  getMissionCompletedBy,
  checkTaskDependency,
  specialClaimMissionCompletion,
} = require("../controllers/missionController");
const { isLoggedIn } = require("../middlewares/user");

const router = require("express").Router();

// TEST: ALL MISSION ROUTES AND CONTROLLERS ARE TO BE TESTED
// /mission?listingID= for all mission of a listing
router.route("/mission").get(getMissions).post(createMission);
router.route("/mission/:missionID").get(getOneMission);
router.route("/mission/:missionID/completed-by").get(getMissionCompletedBy);

router.get(
  "/mission/:missionID/my-status",
  isLoggedIn,
  myAttemptedMissionStatus
);

// task verification and
router.get("/mission/:missionID/task-verify/:taskID", isLoggedIn, performTask);

// UNDER-WORK:
// dependency checking
router.get(
  "/mission/:missionID/task-dependency-check/:taskID",
  isLoggedIn,
  checkTaskDependency
);

// mission claim
router.get("/mission/:missionID/claim", isLoggedIn, claimMissionCompletion);
router.get(
  "/mission/:missionID/special-claim",
  isLoggedIn,
  specialClaimMissionCompletion
);

module.exports = router;
