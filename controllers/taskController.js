const { Task } = require("../models/task");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");

// TODO: complete here from cleanseAndVerifyOfTask
// TEST: also add routes
exports.addOneTaskToMission = async (req, res) => {
  try {
    const missionID = req.body.missionID;
    const {
      taskTemplate,
      name,
      description,
      validationDetails,
      redirect_url,
      stepNum,
    } = req.body;

    // TODO: add check to see if the mission is a TASKS mission type

    return new HTTPResponse(res, true, 201, "task created", null, { task });
  } catch (error) {
    console.log("createTask: ", error);
    return;
  }
};
