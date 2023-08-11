const {
  createMission,
  getMissions,
  getOneMission,

  claimMissionCompletion,
  myAttemptedMissionStatus,
  getMissionCompletedBy,
  createMissionV2,
  specialClaimMissionCompletion,
  deleteMission,
  updateMission,
  updateMissionStatus,
} = require("../controllers/missionController");
const {
  answerToQuestion,
  addQuestionToMission,
  deleteQuestionFromMission,
  updateQuestionInMission,
  reOrderQuiz,
} = require("../controllers/quizController");
const {
  performTask,
  checkTaskDependency,
  addOneTaskToMission,
  deleteTaskFromMission,
  reOrderTask,
  updateTaskInMission,
  submitTaskForm,
} = require("../controllers/taskController");
const cacheRoute = require("../middlewares/cacheRoute");
const paginateRequest = require("../middlewares/paginate");
const { isLoggedIn, onlySuperAdmin } = require("../middlewares/user");
const { Mission } = require("../models/mission");

const router = require("express").Router();

// TEST: ALL MISSION ROUTES AND CONTROLLERS ARE TO BE TESTED
// /mission?listingID= for all mission of a listing
router
  .route("/mission")
  .get(
    cacheRoute,
    paginateRequest(Mission, [
      {
        path: "listing",
        from: "listings",
        select: { name: 1, photo: 1, chains: 1, slug: 1 },
      },
      { path: "tags", from: "missiontags" },
    ]),
    getMissions
  )
  .post(createMissionV2);

// TEST : AKSHAY
router
  .route("/mission/:missionID")
  .get(getOneMission)
  .delete(deleteMission)
  .patch(updateMission);
router.route("/mission/:missionID/completed-by").get(getMissionCompletedBy);

router.get(
  "/mission/:missionID/my-status",
  isLoggedIn,
  myAttemptedMissionStatus
);

router.route("/mission/:missionID/task").post(addOneTaskToMission);
router.route("/mission/:missionID/quiz").post(addQuestionToMission);

// TEST : AKSHAY
router.route("/mission/:missionID/task/reorder").patch(reOrderTask);
router.route("/mission/:missionID/quiz/reorder").patch(reOrderQuiz);

// TEST : AKSHAY
router
  .route("/mission/:missionID/task/:taskID")
  .delete(deleteTaskFromMission)
  .patch(updateTaskInMission);
router
  .route("/mission/:missionID/quiz/:questionID")
  .delete(deleteQuestionFromMission)
  .patch(updateQuestionInMission);

//TEST : AKSHAY
router
  .route("/mission/:missionID/live")
  .patch(isLoggedIn, onlySuperAdmin, updateMissionStatus);

// task verification and
router.get("/mission/:missionID/task-verify/:taskID", isLoggedIn, performTask);

// TEST:
router.get(
  "/mission/:missionID/task-form-submission/:taskID",
  isLoggedIn,
  submitTaskForm
);

router.post(
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
router.get(
  "/mission/:missionID/special-claim",
  isLoggedIn,
  specialClaimMissionCompletion
);

module.exports = router;
