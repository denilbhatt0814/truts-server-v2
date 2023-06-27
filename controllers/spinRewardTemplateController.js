const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");
const spinRewardAllocators = require("../validators/allocators/spinRewardAllocators");
const { SpinRewardTemplate } = require("../models/spinRewardTemplate");

// TEST:
exports.createSpinRewardTemplate = async (req, res) => {
  try {
    const { name, description, allocator } = req.body;

    // Add allocationData to the template: parameters required in allocator
    const allocatorObj = spinRewardAllocators[allocator];
    if (!allocatorObj) {
      return new HTTPError(
        res,
        404,
        `allocator named ${allocator} does not exist`,
        "Resource(allocator) not found!"
      );
    }

    let newSpinRewardTemplate = await SpinRewardTemplate.create({
      name,
      description,
      allocator,
      alloctionData: allocatorObj.parameters,
    });

    return new HTTPResponse(
      res,
      true,
      201,
      "New spinRewardTemplate added",
      null,
      {
        spinRewardTemplate: newSpinRewardTemplate,
      }
    );
  } catch (error) {
    console.log("createSpinRewardTemplate: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};
