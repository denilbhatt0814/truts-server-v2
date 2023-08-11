const { default: mongoose } = require("mongoose");
const { Mission } = require("../models/mission");
// const { Task } = require("../models/task");
const { TaskTemplate } = require("../models/taskTemplate");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");
const taskValidators = require("../validators/task/validators");
const { User_Mission } = require("../models/user_mission");
const redisClient = require("../databases/redis-client");
const { TaskForm } = require("../models/task_form");

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

    // check validation details match taskTemplates
    const verification = await cleanseAndVerifyTasks(res, [
      newTask,
      ...mission.tasks,
    ]);
    if (verification instanceof HTTPError) {
      return;
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

// TEST : AKSHAY
exports.deleteTaskFromMission = async (req, res) => {
  try {
    const missionID = req.params.missionID;
    const taskID = req.params.taskID;
    const mission = await Mission.findById(missionID);
    if (!mission)
      return new HTTPError(
        res,
        404,
        `mission[${missionID}] doesn't exist`,
        "mission not found"
      );

    if (mission.type != "TASKS") {
      return new HTTPError(
        res,
        409,
        `mission[${missionID}] is of type ${mission.type}`,
        "mission type conflict"
      );
    }

    const taskToBeDeletedIdx = mission.tasks.findIndex(
      (task) => task._id.toString() == taskID.toString()
    );

    const deletedTaskStepNum = mission.tasks[taskToBeDeletedIdx].stepNum;
    mission.tasks.splice(taskToBeDeletedIdx, 1);
    for (let task of mission.tasks) {
      if (task.stepNum > deletedTaskStepNum) {
        task.stepNum -= 1;
      }
    }
    const updatedMission = await mission.save();
    // const updatedMission = await Mission.findByIdAndUpdate(
    //   missionID,
    //   { $pull: { tasks: { _id: taskID } } },
    //   { new: true }
    // );

    return new HTTPResponse(
      res,
      true,
      200,
      `task: [${taskID}] deleted successfully`,
      null,
      { mission: updatedMission }
    );
  } catch (error) {
    console.log("deleteTaskFromMission: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// TEST:
exports.submitTaskForm = async (req, res) => {
  try {
    const { missionID, taskID } = req.params;
    const { formData } = req.body;
    const userID = req.user._id;

    const taskForm = await TaskForm.create({
      user: userID,
      mission: new mongoose.Types.ObjectId(missionID),
      task: new mongoose.Types.ObjectId(taskID),
      formData,
    });

    return new HTTPResponse(res, true, 201, null, null, { taskForm });
  } catch (error) {
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};

// TEST : AKSHAY
exports.updateTaskInMission = async (req, res) => {
  try {
    const missionID = req.params.missionID;
    const taskID = req.params.taskID;
    // todo :  add other fields which needs to be updated
    const { taskTemplate, name, description, validationDetails, redirect_url } =
      req.body;

    const mission = await Mission.findById(missionID);
    if (!mission) {
      return new HTTPError(
        res,
        404,
        `mission[${missionID}] does not found`,
        "mission not found"
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

    const taskIdx = mission.tasks.findIndex(
      (task) => task._id.toString() === taskID
    );
    mission.tasks[taskIdx].name = name;
    mission.tasks[taskIdx].description = description;
    mission.tasks[taskIdx].redirect_url = redirect_url;
    mission.tasks[taskIdx].taskTemplate = taskTemplate;
    mission.tasks[taskIdx].validationDetails = validationDetails;

    // check validation details match taskTemplates
    const verification = await cleanseAndVerifyTasks(res, mission.tasks);
    if (verification instanceof HTTPError) {
      return;
    }

    updatedMission = await mission.save();

    return new HTTPResponse(
      res,
      true,
      200,
      `task: [${taskID}] updated successfully`,
      null,
      { mission: updatedMission }
    );
  } catch (error) {
    console.log("updateTaskInMission: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// TEST : AKSHAY
exports.reOrderTask = async (req, res) => {
  try {
    const missionID = req.params.missionID;
    const mission = await Mission.findById(missionID);
    const { reorderMapping } = req.body;

    if (!mission)
      return new HTTPError(
        res,
        404,
        `mission[${missionID}] doesn't exist`,
        "mission not found"
      );

    if (mission.type != "TASKS") {
      return new HTTPError(
        res,
        409,
        `mission[${missionID}] is of type ${mission.type}`,
        "mission type conflict"
      );
    }

    if (
      !verifyUniqueValues(reorderMapping) ||
      !verifyKeysInArray(reorderMapping, mission.tasks)
    ) {
      return new HTTPError(
        res,
        400,
        `check id to sequence mapping`,
        "mapping invalid"
      );
    }

    for (let id in reorderMapping) {
      const taskIdx = mission.tasks.findIndex(
        (task) => task._id.toString() === id
      );
      mission.tasks[taskIdx].stepNum = reorderMapping[id];
    }

    mission.markModified("tasks");
    const updatedMission = await mission.save();

    return new HTTPResponse(
      res,
      true,
      200,
      `tasks reordered successfully`,
      null,
      { mission: updatedMission }
    );
  } catch (error) {
    console.log("reOrderTask: ", error);
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

// UTILS
function verifyUniqueValues(obj) {
  const values = Object.values(obj);
  const uniqueValues = new Set(values);

  return (
    values.length === uniqueValues.size &&
    Math.max(...values) === values.length &&
    Math.min(...values) === 1
  );
}

function verifyKeysInArray(obj, arrayOfObjects) {
  const objectKeys = Object.keys(obj);
  const arrayIds = arrayOfObjects.map((obj) => obj._id.toString());

  return objectKeys.every((key) => arrayIds.includes(key));
}
