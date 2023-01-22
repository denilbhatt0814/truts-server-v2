const { TaskTemplate } = require("../models/taskTemplate");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");
const validators = require("../validators/task/validators");

// TEST:
exports.createTaskTemplate = async (req, res) => {
  try {
    const { name, description, validator, trutsXP } = req.body;

    // Add validatorData to the template: parameters required in validator
    const validatorObj = validators[validator];
    if (!validatorObj) {
      return new HTTPError(
        res,
        404,
        `validator named ${validator} does not exist`,
        "Resource(validator) not found!"
      );
    }

    let newTaskTemplate = await TaskTemplate.create({
      name,
      description,
      validator,
      validatorData: validatorObj.parameters,
      trutsXP,
    });

    return new HTTPResponse(res, true, 201, "New taskTemplate added", null, {
      taskTemplate: newTaskTemplate,
    });
  } catch (error) {
    console.log("createTaskTemplate: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};
