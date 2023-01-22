const { default: mongoose } = require("mongoose");
const { Mission } = require("../models/mission");
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
    const communityID = req.params.communityID;
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
    let searchQ = {};
    if ("communityID" in req.query) {
      searchQ.community = req.query.communityID;
    }

    let missions = await Mission.find(searchQ);
    return new HTTPResponse(res, true, null, null, { missions });
  } catch (error) {
    console.log("getMissions: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.performTask = async (req, res) => {
  try {
    // PARSE TASK ID & USER ID (userID from authenticated route)
    const taskID = req.params.id;
    const userID = req.query.userID; // TODO: query this from middleware

    let mission = await Mission.findOne({
      "tasks._id": mongoose.Types.ObjectId(taskID),
    }).populate("taskTemplate");

    console.log(mission);

    if (!mission) {
      return new HTTPError(
        res,
        400,
        `No mission refering to taskID: ${taskID}`,
        "mission not found"
      );
    }

    // Add missions/task to UserMission
    const task = mission.tasks.find((task) => task._id == taskID);
    const taskValidator = taskValidators[task.taskTemplate.validator];
    const arguments = { ...task.validationDetails, userID };
    const isValid = taskValidator.exec(arguments);

    if (!isValid) {
      return new HTTPError(
        res,
        400,
        `taskID: ${taskID} [mission: ${mission._id}] couldn't be validated`,
        "Task validation falied"
      );
    }

    // If task is validated
    // TODO: CHECK: when can the task status be pending ?
    // UPSERT: if user hasn't attempted the mission create new,
    // else update the done task in the old document
    const filterQ = {
      user: mongoose.Types.ObjectId(userID),
      mission: mongoose.Types.ObjectId(mission._id),
    };
    let attemptedMission = await User_Mission.findOne(filterQ);

    if (!attemptedMission) {
      attemptedMission = new User_Mission({
        user: userID,
        mission: mission._id,
        community: mission.community._id,
        tasks: () => {
          let tasks = {};
          mission.tasks.forEach((task) => {
            tasks[task._id] = "INCOMPLETE";
          });
          return tasks;
        },
      });
    }

    attemptedMission.tasks[task._id] = "COMPLETE";
    mission = await attemptedMission.save();

    return new HTTPResponse(
      res,
      true,
      200,
      `taskID: ${taskID} [mission: ${mission._id}] marked complete`,
      null,
      { mission }
    );
  } catch (error) {
    console.log("performMission", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.claimMissionCompletion = async (req, res) => {
  try {
    const missionID = req.query.missionID;
    const userID = req.query.userID; // TODO: Modify userID receive

    const mission = await Mission.findById(missionID).populate("taskTemplate");

    let attemptedMission = await User_Mission.findOne({
      user: mongoose.Types.ObjectId(userID),
      mission: mongoose.Types.ObjectId(missionID),
    });

    if (!attemptedMission) {
      return new HTTPError(
        res,
        400,
        `the user[${userID}] hasn't attempted the mission[${missionID}]`,
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
          `task[${task._id}] isn't complete in mission[${missionID}]`,
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
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (
      !("taskTemplate" in task) ||
      !("name" in task) ||
      !("description" in task) ||
      !("validationDetails" in task)
    ) {
      return new HTTPError(
        res,
        400,
        "Missing fields in tasks - require [{taskTemplate, name, description, validationDetails}]",
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
