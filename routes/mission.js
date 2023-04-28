const {
  createMission,
  getMissions,
  getOneMission,

  claimMissionCompletion,
  myAttemptedMissionStatus,
  getMissionCompletedBy,
  createMissionV2,
} = require("../controllers/missionController");
const {
  answerToQuestion,
  addQuestionToMission,
} = require("../controllers/quizController");
const {
  performTask,
  checkTaskDependency,
  addOneTaskToMission,
} = require("../controllers/taskController");
const { isLoggedIn } = require("../middlewares/user");

const router = require("express").Router();

// TEST: ALL MISSION ROUTES AND CONTROLLERS ARE TO BE TESTED
// /mission?listingID= for all mission of a listing
router.route("/mission").get(getMissions).post(createMissionV2);
router.route("/mission/:missionID").get(getOneMission);
router.route("/mission/:missionID/completed-by").get(getMissionCompletedBy);

router.get(
  "/mission/:missionID/my-status",
  isLoggedIn,
  myAttemptedMissionStatus
);

router.route("/mission/:missionID/task").post(addOneTaskToMission);
router.route("/mission/:missionID/quiz").post(addQuestionToMission);

// task verification and
router.get("/mission/:missionID/task-verify/:taskID", isLoggedIn, performTask);
router.get(
  "/mission/:missionID/question-answer/:questionID",
  isLoggedIn,
  answerToQuestion
);

// dependency checking
router.get(
  "/mission/:missionID/task-dependency-check/:taskID",
  isLoggedIn,
  checkTaskDependency
);

// mission claim
router.get("/mission/:missionID/claim", isLoggedIn, claimMissionCompletion);

module.exports = router;
