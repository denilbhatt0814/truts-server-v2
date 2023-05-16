const { default: mongoose } = require("mongoose");
const { Mission } = require("../models/mission");
const Listing = require("../models/dao");
const { MissionTag } = require("../models/missionTag");
const { TaskTemplate } = require("../models/taskTemplate");
const { User_Mission } = require("../models/user_mission");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");
const taskValidators = require("../validators/task/validators");
const { XpTxn } = require("../models/xpTxn");
const redisClient = require("../databases/redis-client");
const Coupon = require("../models/coupon");
const { UD_MISSION_ID } = require("../config/config");

/**
 * NOTE:
 * THIS COMPLETE FEATURE OF MISSIONS REQUIRES TO PROTECTED
 * UNDER AUTH BY ADMIN OR LISTING MANAGER
 */

exports.createMission = async (req, res) => {
  try {
    const listingID = req.body.listingID;
    const {
      name,
      description,
      type,
      tags,
      tasks,
      listingXP,
      startDate,
      endDate,
    } = req.body;

    // TODO: VERIFY IF LISTING EXISTS - another middleware

    // cleansing and verification of tasks
    const verification = await cleanseAndVerifyTasks(res, tasks);
    if (verification instanceof HTTPError) {
      return;
    }

    const mission = await Mission.create({
      name,
      description,
      tags,
      tasks,
      listing: listingID,
      listingXP,
      startDate,
      endDate,
    });

    return new HTTPResponse(res, true, 201, "Mission created", null, {
      mission,
    });
  } catch (error) {
    console.log("createMission: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.createMissionV2 = async (req, res) => {
  try {
    const listingID = req.body.listingID;
    const { name, type } = req.body;

    // TODO: check if listing exist
    const listingExist = await Listing.findById(listingID);
    if (!listingExist) {
      return new HTTPError(
        res,
        404,
        `listing[${listingID}] doesn't exist`,
        "resource not found"
      );
    }

    // create mission w/ just name and type
    const newMission = await Mission.create({
      name,
      type,
      listing: listingExist.id,
    });

    return new HTTPResponse(
      res,
      true,
      201,
      "misison created successfully",
      null,
      { mission: newMission }
    );
  } catch (error) {
    console.log("createMissionV2: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// TODO:
exports.deleteMission = async (req, res) => {
  try {
  } catch (error) {
    console.log("deleteMission: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getMissions = async (req, res) => {
  try {
    req.pagination.result.forEach((mission) => {
      delete mission["tasks"];
      delete mission["questions"];
    });

    const response = new HTTPResponse(res, true, 200, null, null, {
      ...req.pagination,
    });

    // TODO: change cache time after testing
    await redisClient.setEx(
      req.originalUrl,
      60, // 30mins
      JSON.stringify(response.getResponse())
    );

    return response;
  } catch (error) {
    console.log("getMissions: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};
// exports.getMissions = async (req, res) => {
//   try {
//     // UNDER-WORK: querying in this could be optimized | This is temperory
//     let searchQ = { visible: true };
//     if ("listingID" in req.query) {
//       searchQ.listing = mongoose.Types.ObjectId(req.query.listingID);
//     }

//     let missions = await Mission.find(searchQ)
//       .populate("tags")
//       .populate({ path: "listing", select: { dao_name: 1, dao_logo: 1 } })
//       .select({ tasks: 0 });
//     return new HTTPResponse(res, true, 200, null, null, {
//       count: missions.length,
//       missions,
//     });
//   } catch (error) {
//     console.log("getMissions: ", error);
//     return new HTTPError(res, 500, error, "internal server error");
//   }
// };

exports.getOneMission = async (req, res) => {
  try {
    const missionID = req.params.missionID;

    const mission = await Mission.findById(missionID)
      .populate("tags")
      .populate({ path: "listing", select: { dao_name: 1, dao_logo: 1 } });

    return new HTTPResponse(res, true, 200, null, null, { mission });
  } catch (error) {
    console.log(error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getMissionCompletedBy = async (req, res) => {
  try {
    const missionID = req.params.missionID;

    const completedBy = await User_Mission.find({
      mission: mongoose.Types.ObjectId(missionID),
      isCompleted: true,
    })
      .select({ user: 1 })
      .populate({ path: "user", select: { username: 1, name: 1, photo: 1 } });

    return new HTTPResponse(res, true, 200, null, null, {
      completedBy,
      count: completedBy.length,
    });
  } catch (error) {
    console.log("getMissionCompletedBy: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.myAttemptedMissionStatus = async (req, res) => {
  try {
    const missionID = req.params.missionID;
    const userID = req.user._id;
    const attemptedMission = await User_Mission.findOne({
      user: mongoose.Types.ObjectId(userID),
      mission: mongoose.Types.ObjectId(missionID),
    }).populate({ path: "mission", select: "type" });

    if (!attemptedMission) {
      /** NOTE: THE RESPONSE HERE IS HARD CODED, MUST BE UPDATED
       * IF ANY MOD. IN USER_MISSION SCHEMA
       */

      const mission = await Mission.findById(missionID);
      if (!mission) {
        return new HTTPError(
          res,
          404,
          `mission[${missionID}] does not exist`,
          "mission not found"
        );
      }

      let tasks, questions;
      if (mission.type == "TASKS") {
        tasks = {};
        mission.tasks.forEach((task) => {
          tasks[task._id] = "INCOMPLETE";
        });
      } else if (mission.type == "QUIZ") {
        questions = {};
        mission.questions.forEach((question) => {
          questions[question._id] = {
            answerByUser: null,
            correctAnswer: null,
            status: "UNANSWERED",
            isCorrect: null,
            listingXP: null,
          };
        });
      }

      return new HTTPResponse(
        res,
        true,
        200,
        `user[${userID}] has not attempted mission[${missionID}]`,
        "mission not attempted",
        {
          attemptedMission: {
            mission: mission._id,
            user: userID,
            listing: mission.listing,
            tasks,
            questions,
            isCompleted: false,
          },
        }
      );
    }

    return new HTTPResponse(res, true, 200, null, null, { attemptedMission });
  } catch (error) {
    console.log("myAttemptedMissionStatus: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.claimMissionCompletion = async (req, res) => {
  // TODO: handle quizes here
  const session = await mongoose.startSession();
  try {
    const missionID = req.params.missionID;
    const userID = req.user._id;

    await session.startTransaction();

    // UNDER-WORK:
    let mission = await Mission.findById(missionID);

    let attemptedMission = await User_Mission.findOne({
      user: mongoose.Types.ObjectId(userID),
      mission: mongoose.Types.ObjectId(missionID),
    });

    if (!attemptedMission) {
      await session.abortTransaction();
      await session.endSession();
      return new HTTPError(
        res,
        400,
        `the user[${userID}] has not attempted the mission[${missionID}]`,
        "mission not attempted"
      );
    }
    // If already claimed
    if (attemptedMission.isCompleted == true) {
      return new HTTPResponse(
        res,
        true,
        200,
        `the user[${userID}] has claimed the mission[${missionID}] completion`,
        "already claimed mission completion",
        { attemptedMission }
      );
    }

    // If attempted -> verify completion of each task - Also add trutsXP
    // HANDLE: QUIZ & TASK seperately
    let trutsXP = 0;
    if (mission.type == "TASKS") {
      mission = await mission.populate("tasks.taskTemplate");
      mission.tasks.forEach((task) => {
        const attemptedTask = attemptedMission.tasks[task._id];
        if (attemptedTask != "COMPLETE") {
          return new HTTPError(
            res,
            400,
            `task[${task._id}] is not complete in mission[${missionID}]`,
            "mission incomplete"
          );
        }
        trutsXP += task.taskTemplate.trutsXP;
      });
      // allocate XPs
      attemptedMission.listingXP = mission.listingXP;
      attemptedMission.trutsXP = trutsXP;
    } else if (mission.type == "QUIZ") {
      mission.questions.forEach((question) => {
        const response = attemptedMission.questions[question._id];
        if (response.status != "ANSWERED") {
          return new HTTPError(
            res,
            400,
            `question[${question._id}] is not answered in mission[${missionID}]`,
            "mission incomplete"
          );
        }
        trutsXP += response.isCorrect ? response.listingXP : 0;
      });
      // allocate XPs
      // TODO: MOD required when seperating trutsXP & listingXP
      attemptedMission.listingXP = trutsXP;
      attemptedMission.trutsXP = trutsXP;
    }

    // if no return -> All tasks completed
    attemptedMission.isCompleted = true;
    attemptedMission.completedAt = new Date();
    await attemptedMission.save({ session });

    // create a xpTxn
    const xpTxn = new XpTxn({
      reason: {
        tag: "mission",
        id: missionID,
      },
      user: userID,
      value: attemptedMission.trutsXP,
      meta: {
        title: `Completed ${mission.name}`,
        description: "",
        data: {
          user_mission: mongoose.Types.ObjectId(attemptedMission._id),
        },
      },
    });

    await xpTxn.save({ session });

    await session.commitTransaction();
    await session.endSession();
    return new HTTPResponse(res, true, 200, "claim successful", null, {
      attemptedMission,
    });
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    console.log("claimMissionCompletion: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.specialClaimMissionCompletion = async (req, res) => {
  try {
    const userID = req.user._id;
    const missionID = req.params.missionID;

    if (missionID != UD_MISSION_ID) {
      return new HTTPError(
        res,
        403,
        `mission[${missionID}] is not allowed for special claim`,
        `not allowed for special claim`
      );
    }

    const claimedSpecialMission = await User_Mission.findOne({
      user: mongoose.Types.ObjectId(userID),
      mission: mongoose.Types.ObjectId(missionID),
      isCompleted: true,
    }).populate({ path: "mission", select: { listing: 1 } });

    if (!claimedSpecialMission) {
      return new HTTPError(
        res,
        405,
        `user[${userID}] has not completed/claimed mission[${missionID}]`,
        `not allowed for special claim`
      );
    }

    const claimCount = await Coupon.countDocuments({
      listing: claimedSpecialMission.mission.listing,
      collection: "DEFAULT", // TODO: needs some work
      claimedBy: mongoose.Types.ObjectId(userID),
    });
    if (claimCount != 0) {
      return new HTTPError(
        res,
        409,
        `user[${userID}] has already made special claim`,
        "remaking special claim"
      );
    }

    const availableCouponCount = await Coupon.countDocuments({
      listing: claimedSpecialMission.mission.listing,
      collection: "DEFAULT",
      claimed: false,
    });

    if (availableCouponCount == 0) {
      return new HTTPResponse(
        res,
        true,
        204,
        `No more coupons available`,
        null,
        {}
      );
    }

    //TODO: get a unclaimed coupon -> attach user to it
    const newCoupon = await Coupon.findOneAndUpdate(
      {
        listing: claimedSpecialMission.mission.listing,
        collection: "DEFAULT", // TODO: needs some work
        claimed: false,
      },
      {
        claimedBy: mongoose.Types.ObjectId(userID),
        claimed: true,
      },
      { new: true }
    );

    // return coupon in response
    return new HTTPResponse(res, true, 201, "special claim succesfull", null, {
      coupon: newCoupon,
    });
  } catch (error) {
    console.log("specialClaimMissionCompletion: ", error);
  }
};
