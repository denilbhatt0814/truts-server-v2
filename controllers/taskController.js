const { default: mongoose } = require("mongoose");
const { Mission } = require("../models/mission");
// const { Task } = require("../models/task");
const { TaskTemplate } = require("../models/taskTemplate");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");
const taskValidators = require("../validators/task/validators");
const { User_Mission } = require("../models/user_mission");
const redisClient = require("../databases/redis-client");

// TODO: complete here from cleanseAndVerifyOfTask
// TEST: also add routes
exports.addOneTaskToMission = async (req, res) => {
  try {
    const missionID = req.params.missionID;
    const {
      taskTemplate,
      name,
      description,
      validationDetails,
      redirect_url,
      stepNum,
    } = req.body;

    // TODO: add check to see if the mission is a TASKS mission type

    let mission = await Mission.findById(missionID);
    if (!mission) {
      return new HTTPError(
        res,
        404,
        `mission[${missionID}] doesn't exist`,
        "resource not found"
      );
    }

    // check if the mission is a TASKs type
    if (mission.type != "TASKS") {
      return new HTTPError(
        res,
        409,
        "Trying to add task to non TASKS type mission.",
        "conflicting type"
      );
    }

    const newTask = {
      taskTemplate,
      name,
      description,
      validationDetails,
      redirect_url,
      stepNum,
    };

    // check validation details match taskTemplates
    const verification = await cleanseAndVerifyTasks(res, [
      newTask,
      ...mission.tasks,
    ]);
    if (verification instanceof HTTPError) {
      return;
    }

    if (!mission.tasks) {
      mission.tasks = [];
    } else {
      // if tasks already present, check no repeating stepNum
      if (mission.tasks.some((task) => task.stepNum == newTask.stepNum)) {
        return new HTTPError(
          res,
          400,
          `A task with stepNum ${newTask.stepNum} already exists`,
          `invalid stepNum`
        );
      }
    }

    mission.tasks.push(newTask);
    mission.markModified("tasks");
    mission = await mission.save();

    return new HTTPResponse(res, true, 201, "task created", null, { mission });
  } catch (error) {
    console.log("addOneTaskToMission: ", error);
    return;
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
