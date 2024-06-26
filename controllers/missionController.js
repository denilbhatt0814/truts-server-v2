const { default: mongoose } = require("mongoose");
const { Mission } = require("../models/mission");
const { Dao } = require("../models/dao");
const { MissionTag } = require("../models/missionTag");
const { TaskTemplate } = require("../models/taskTemplate");
const { User_Mission } = require("../models/user_mission");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");
const taskValidators = require("../validators/task/validators");

/**
 * NOTE: TODO:  ADD TIMESTAMPS IN ALL SCHEMAS
 * THIS COMPLETE FEATURE OF MISSIONS REQUIRES TO PROTECTED
 * UNDER AUTH BY ADMIN OR COMMUNITY MANAGER
 */

exports.createMission = async (req, res) => {
  try {
    const communityID = req.body.communityID;
    const { name, description, tags, tasks, communityXP, startDate, endDate } =
      req.body;

    // TODO: VERIFY IF COMMUNITY EXISTS - another middleware

    // cleansing and verification of tasks
    await cleanseAndVerifyTasks(res, tasks);

    const mission = await Mission.create({
      name,
      description,
      tags,
      tasks,
      community: communityID,
      communityXP,
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

exports.getMissions = async (req, res) => {
  try {
    // UNDER-WORK: querying in this could be optimized | This is temperory
    let searchQ = { visible: true };
    if ("communityID" in req.query) {
      searchQ.community = mongoose.Types.ObjectId(req.query.communityID);
    }

    let missions = await Mission.find(searchQ)
      .populate("tags")
      .populate({ path: "community", select: { dao_name: 1, dao_logo: 1 } })
      .select({ tasks: 0 });
    return new HTTPResponse(res, true, 200, null, null, { missions });
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
      .populate({ path: "community", select: { dao_name: 1, dao_logo: 1 } });

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
      // return new HTTPError(
      //   res,
      //   400,
      //   `user[${userID}] has not attempted mission[${missionID}] OR mission does not exit`,
      //   "mission not attempted"
      // );
      const mission = await Mission.findById(missionID);
      if (!mission) {
        return new HTTPError(
          res,
          404,
          `mission[${missionID}] does not exist`,
          "mission not found"
        );
      }
      let tasks = {};
      mission.tasks.forEach((task) => {
        tasks[task._id] = "INCOMPLETE";
      });
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
            community: mission.community,
            tasks,
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

    console.log(mission);

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
        community: mission.community._id,
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

exports.claimMissionCompletion = async (req, res) => {
  try {
    const missionID = req.params.missionID;
    const userID = req.user._id;

    const mission = await Mission.findById(missionID).populate(
      "tasks.taskTemplate"
    );

    let attemptedMission = await User_Mission.findOne({
      user: mongoose.Types.ObjectId(userID),
      mission: mongoose.Types.ObjectId(missionID),
    });

    if (!attemptedMission) {
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
    let trutsXP = 0;
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
    attemptedMission.communityXP = mission.communityXP;
    attemptedMission.trutsXP = trutsXP;

    // if no return -> All tasks completed
    attemptedMission.isCompleted = true;
    attemptedMission.completedAt = new Date();
    await attemptedMission.save();

    return new HTTPResponse(res, true, 200, "claim successful", null, {
      attemptedMission,
    });
  } catch (error) {
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
    let template = await TaskTemplate.findById(task.taskTemplate);
    if (!template) {
      return new HTTPError(
        res,
        400,
        `Task template w/ id: ${task.taskTemplate} not found`,
        "template not found"
      );
    }

    let taskValidator = taskValidators[template.validator];
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
