const { Task } = require("../models/task");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");

exports.createTask = async (req, res) => {
  try {
    const { taskTemplateID } = req.body;
    const task = await Task.create({
      taskTemplate: taskTemplateID,
    });

    return new HTTPResponse(res, true, 201, "task created", null, { task });
  } catch (error) {
    console.log("createTask: ", error);
    return;
  }
};
