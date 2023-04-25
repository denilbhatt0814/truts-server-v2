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
    // UNDER-WORK: querying in this could be optimized | This is temperory
    let searchQ = { visible: true };
    if ("listingID" in req.query) {
      searchQ.listing = mongoose.Types.ObjectId(req.query.listingID);
    }

    let missions = await Mission.find(searchQ)
      .populate("tags")
      .populate({ path: "listing", select: { dao_name: 1, dao_logo: 1 } })
      .select({ tasks: 0 });
    return new HTTPResponse(res, true, 200, null, null, {
      count: missions.length,
      missions,
    });
  } catch (error) {
    console.log("getMissions: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

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
    });

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

exports.performTask = async (req, res) => {
  try {
    // PARSE TASK ID & USER ID (userID from authenticated route)
    const taskID = req.params.taskID;
    const missionID = req.params.missionID;
    const userID = req.user._id;

    let mission = await Mission.findOne({
      "tasks._id": mongoose.Types.ObjectId(taskID),
    }).populate("tasks.taskTemplate");

    if (!mission) {
      return new HTTPError(
        res,
        400,
        `No mission refering to taskID: ${taskID}`,
        "mission not found"
      );
    }

    if (mission.type != "TASKS") {
      return new HTTPError(
        res,
        400,
        `mission[${missionID}] is not of QUIZ type`,
        "bad request"
      );
    }

    if (missionID != mission._id) {
      return new HTTPError(
        res,
        400,
        `task[${taskID}] does not belong to mission[${missionID}]`,
        "illegal task to mission reference"
      );
    }

    // Add missions/task to UserMission
    const task = mission.tasks.find((task) => task._id == taskID);
    const taskValidator = taskValidators[task.taskTemplate.validator];
    const arguments = { ...task.validationDetails, userID };
    const isValid = await taskValidator.exec(arguments);

    if (!isValid) {
      return new HTTPError(
        res,
        400,
        `taskID: ${taskID} [mission: ${mission._id}] could not be validated`,
        "Task validation falied"
      );
    }

    // If task is validated
    // TODO: CHECK: when can the task status be pending ?
    // UPSERT: if user has not attempted the mission create new,
    // else update the done task in the old document
    const filterQ = {
      user: mongoose.Types.ObjectId(userID),
      mission: mongoose.Types.ObjectId(mission._id),
    };
    let attemptedMission = await User_Mission.findOne(filterQ);

    if (!attemptedMission) {
      let tasks = {};
      mission.tasks.forEach((task) => {
        tasks[task._id] = "INCOMPLETE";
      });

      attemptedMission = new User_Mission({
        user: userID,
        mission: mission._id,
        listing: mission.listing._id,
        tasks,
      });
    }
    // } else {
    //   attemptedMission.tasks[task._id] = "COMPLETE";
    //   await attemptedMission.updateOne({
    //     $set: { tasks: attemptedMission.tasks },
    //   });
    // }

    attemptedMission.tasks[task._id] = "COMPLETE";
    attemptedMission.markModified("tasks");
    await attemptedMission.save();

    return new HTTPResponse(
      res,
      true,
      200,
      `taskID: ${taskID} [mission: ${mission._id}] marked complete`,
      null,
      { attemptedMission }
    );
  } catch (error) {
    console.log("performTask: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// UNDER-WORK: dependency checking
exports.checkTaskDependency = async (req, res) => {
  try {
    // PARSE TASK ID & USER ID (userID from authenticated route)
    const taskID = req.params.taskID;
    const missionID = req.params.missionID;
    const userID = req.user._id;

    let mission;
    let missionFromCache = await redisClient.get(`MISSION:TASK:${missionID}`);
    if (!missionFromCache) {
      mission = await Mission.findOne({
        "tasks._id": mongoose.Types.ObjectId(taskID),
      }).populate("tasks.taskTemplate");
      await redisClient.setEx(
        `MISSION:TASK:${missionID}`,
        60 * 3,
        JSON.stringify(mission)
      );
    } else {
      mission = JSON.parse(missionFromCache);
    }

    if (!mission) {
      return new HTTPError(
        res,
        400,
        `No mission refering to taskID: ${taskID}`,
        "mission not found"
      );
    }

    if (missionID != mission._id) {
      return new HTTPError(
        res,
        400,
        `task[${taskID}] does not belong to mission[${missionID}]`,
        "illegal task to mission reference"
      );
    }

    // NOTE: COULD USE CACHING FOR THIS MISSION-TASK METADATA
    //        AS WE'LL NEED MULTIPLE CALLS FOR DEP CHECK
    // TODO: CHANGES HERE:
    // pass in all the data required to check dependecies
    // return status of all dependencies
    const task = mission.tasks.find((task) => task._id == taskID);
    const taskValidator = taskValidators[task.taskTemplate.validator];
    const data = { userID };
    const dependencyStatus = await taskValidator.getDependecyStatus(data);

    return new HTTPResponse(
      res,
      true,
      200,
      `Dependecy Status for taskID: ${taskID} [mission: ${mission._id}]`,
      null,
      { dependencyStatus }
    );
  } catch (error) {
    console.log("checkTaskDependency: ", error);
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
        trutsXP += response.listingXP;
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

// KINDA MIDDLEWARE
const cleanseAndVerifyTasks = async (res, tasks) => {
  let existingSteps = [];
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (task.stepNum > tasks.length || task.stepNum <= 0) {
      return new HTTPError(
        res,
        400,
        `task number (${task.stepNum}) should in range of 1 to total number of tasks(${tasks.length})`,
        "invalid task step number"
      );
    }

    if (task.stepNum in existingSteps) {
      return new HTTPError(
        res,
        400,
        `stepNum: ${task.stepNum} already exists`,
        "invalid task step number"
      );
    }

    // TODO: Add redirect_url if needed
    if (
      !("stepNum" in task) ||
      !("taskTemplate" in task) ||
      !("name" in task) ||
      !("description" in task) ||
      !("validationDetails" in task)
    ) {
      return new HTTPError(
        res,
        400,
        "Missing fields in tasks - require [{stepNum, taskTemplate, name, description, validationDetails}]",
        "Invalid input"
      );
    }

    // Fetch validator and verify validationDetails
    const template = await TaskTemplate.findById(task.taskTemplate);
    if (!template) {
      return new HTTPError(
        res,
        400,
        `Task template w/ id: ${task.taskTemplate} not found`,
        "template not found"
      );
    }

    const taskValidator = taskValidators[template.validator];
    if (!taskValidator) {
      return new HTTPError(
        res,
        404,
        `Error finding taskValidator[${template.validator}] in list of validators`,
        "validator not found"
      );
    }
    if (!taskValidator.areValidArguments(task.validationDetails)) {
      return new HTTPError(
        res,
        400,
        `Argument validation for ${task.taskTemplate} failed!`,
        "invalid or missing details in validationDetails"
      );
    }
  }
};
