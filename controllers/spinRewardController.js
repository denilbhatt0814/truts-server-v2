const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");
const { SpinReward } = require("../models/spinReward");
const spinRewardAllocators = require("../validators/allocators/spinRewardAllocators");
const { SpinRewardTemplate } = require("../models/spinRewardTemplate");

exports.createSpinReward = async (req, res) => {
  try {
    const {
      spinRewardTemplate,
      name,
      allocationDetails,
      // TODO: icon
      redirect_url,
    } = req.body;

    let newSpinReward = {
      allocatorTemplate: spinRewardTemplate,
      name,
      allocationDetails,
      // TODO: icon
      redirect_url,
    };

    // check validation details match spinRewardTemplates
    const verification = await verifySpinReward(res, newSpinReward);
    if (verification instanceof HTTPError) {
      return;
    }

    newSpinReward = await SpinReward.create(newSpinReward);

    return new HTTPResponse(res, true, 201, "spinReward created", null, {
      spinReward: newSpinReward,
    });
  } catch (error) {
    console.log("createSpinReward: ", error);
    return HTTPError(res, 500, error, "internal server error");
  }
};

const verifySpinReward = async (res, spinReward) => {
  // TODO: Add redirect_url|icon if needed
  if (
    !("allocatorTemplate" in spinReward) ||
    !("name" in spinReward) ||
    !("allocationDetails" in spinReward)
  ) {
    return new HTTPError(
      res,
      400,
      "Missing fields in spinRewards - require [{ spinRewardTemplate, name, allocationDetails }]",
      "Invalid input"
    );
  }

  // Fetch validator and verify validationDetails
  const template = await SpinRewardTemplate.findById(
    spinReward.allocatorTemplate
  );
  if (!template) {
    return new HTTPError(
      res,
      400,
      `Spin Reward template w/ id: ${spinReward.allocatorTemplate} not found`,
      "template not found"
    );
  }

  const spinRewardAllocator = spinRewardAllocators[template.allocator];
  if (!spinRewardAllocator) {
    return new HTTPError(
      res,
      404,
      `Error finding spinRewardAllocator[${template.allocator}] in list of allocators`,
      "allocator not found"
    );
  }
  if (!spinRewardAllocator.areValidArguments(spinReward.allocationDetails)) {
    return new HTTPError(
      res,
      400,
      `Argument validation for ${spinReward.allocatorTemplate} failed!`,
      "invalid or missing details in allocationDetails"
    );
  }
};
