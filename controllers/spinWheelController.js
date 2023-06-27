const { default: mongoose } = require("mongoose");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");
const { SpinHistory } = require("../models/spinHistory");
const { SpinWheel } = require("../models/spinWheel");
const { SpinReward } = require("../models/spinReward");
const spinRewardAllocators = require("../validators/allocators/spinRewardAllocators");

exports.createWheel = async (req, res) => {
  try {
    const { name, rewards, startDate, endDate } = req.body;

    // verify if the rewards exist, verify if the slot number doesn't repeat and stay
    const verification = await verifyRewardsInWheel(res, rewards);
    if (verification instanceof HTTPError) {
      return;
    }

    const newWheel = await SpinWheel.create({
      name,
      rewards,
      startDate,
      endDate,
    });

    return new HTTPResponse(
      res,
      true,
      201,
      "New wheel created successfully!!",
      null,
      {
        wheel: newWheel,
      }
    );
  } catch (error) {
    console.log("createWheel: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// Add AUTH
exports.spinTheWheel = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction();
  try {
    const userID = req.user._id;

    // check if user has already spun wheel today
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    let spinHistory = await SpinHistory.findOne(
      {
        user: mongoose.Types.ObjectId(userID),
        spinnedAt: {
          $gte: startOfToday,
        },
      },
      null,
      { session }
    );
    if (spinHistory) {
      await session.abortTransaction();
      await session.endSession();
      return new HTTPError(
        res,
        403,
        `User[${userID}] has already spun the wheel today, Please try again tomorrow.`,
        "spin not allowed"
      );
    }

    // TODO: can be fetched from redis as well
    const wheel = await SpinWheel.findOne({ isLive: true }, null, {
      session,
    }).select("+rewards.odds");

    // Select a reward
    let selectedReward = seletReward(wheel.rewards);
    let reward = await SpinReward.findOne(
      { _id: selectedReward.reward },
      null,
      {
        session,
      }
    ).populate("allocatorTemplate");

    // Allocate the reward
    const spinRewardAllocator =
      spinRewardAllocators[reward.allocatorTemplate.allocator];
    const arguments = {
      ...reward.allocationDetails,
      rewardID: reward._id,
      userID,
    };
    const rewardMeta = await spinRewardAllocator.exec(arguments, session);

    if (!rewardMeta) {
      await session.abortTransaction();
      await session.endSession();
      return new HTTPError(
        res,
        500,
        `rewardID: ${reward._id} [wheel: ${wheel._id}] could not be allocated`,
        "Spin reward allocation falied"
      );
    }

    spinHistory = new SpinHistory({
      user: mongoose.Types.ObjectId(userID),
      reward: reward._id,
    });
    await spinHistory.save({ session });

    await session.commitTransaction();
    await session.endSession();
    return new HTTPResponse(res, true, 200, "Spin successfull!!", null, {
      reward: {
        slot: selectedReward.slot,
        meta: rewardMeta,
        ...reward.toObject(),
      },
    });
  } catch (error) {
    console.log("spinTheWheel: ", error);
    await session.abortTransaction();
    await session.endSession();
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getWheel = async (req, res) => {
  try {
    const wheel = await SpinWheel.findOne({ isLive: true }).populate(
      "rewards.reward"
    );
    return new HTTPResponse(res, true, 200, null, null, { wheel });
  } catch (error) {
    console.log("getWheel: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// AUTH Route
exports.checkSpinAbility = async (req, res) => {
  try {
    const userID = req.user._id;
    // check if user has already spun wheel today
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    let spinHistory = await SpinHistory.findOne({
      user: mongoose.Types.ObjectId(userID),
      spinnedAt: {
        $gte: startOfToday,
      },
    });

    if (spinHistory) {
      let tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      return new HTTPResponse(res, true, 200, null, null, {
        spin: {
          ability: false,
          nextSpin: tomorrow,
        },
      });
    }

    return new HTTPResponse(res, true, 200, null, null, {
      spin: {
        ability: true,
        nextSpin: null,
      },
    });
  } catch (error) {
    console.log("checkSpinAbility: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// UTILITY:
function seletReward(rewards) {
  let cumulativeOdds = [];
  let totalOdds = 0;

  // Loop over each reward
  for (let i = 0; i < rewards.length; i++) {
    // Add the odds of the current reward to the total odds
    totalOdds += rewards[i].odds;

    // Add the total odds so far to the cumulative odds array
    cumulativeOdds.push(totalOdds);
  }

  // Generate a random number between 0 and the total odds (100 in our case)
  let randomOdds = Math.random() * totalOdds;

  // Find the index of the first element in the cumulative odds array
  // that is greater than or equal to the random number
  // say random number is 4 and array is [1, 3, 5, 10] => idx = 2
  // [1 3 3 5 5 10 10 10 10 10]
  let selectedRewardIndex = cumulativeOdds.findIndex(
    (odds) => odds >= randomOdds
  );

  // Select the reward at the calculated index
  let selectedReward = rewards[selectedRewardIndex];

  // Return the selected reward
  return selectedReward;
}

async function verifyRewardsInWheel(res, rewards) {
  // Get the reward IDs from the rewards array
  const rewardIds = rewards.map((reward) => reward.reward);

  // Fetch all the rewards from the database
  const existingRewards = await SpinReward.find({
    _id: { $in: rewardIds },
  }).select({ _id: 1 });

  // Convert the existing rewards to a set for efficient lookups
  const existingRewardIds = new Set(
    existingRewards.map((reward) => reward._id.toString())
  );

  let totalOdds = 0;
  let slots = new Set();

  // Check each reward
  for (let i = 0; i < rewards.length; i++) {
    const reward = rewards[i];

    // Check if the reward exists
    if (!existingRewardIds.has(reward.reward.toString())) {
      return new HTTPError(
        res,
        404,
        `SpinReward[${reward.reward}] does not exist`,
        "reward not found"
      );
    }

    // Check if the slot number is unique and within range
    if (slots.has(reward.slot)) {
      return new HTTPError(
        res,
        400,
        `Slot number ${reward.slot} is repeated`,
        "invalid request"
      );
    }
    if (reward.slot < 1 || reward.slot > rewards.length) {
      return new HTTPError(
        res,
        400,
        `Slot number ${reward.slot} is out of range`,
        "invalid request"
      );
    }
    slots.add(reward.slot);

    // Check if the odds are valid and calculate the total odds
    if (reward.odds < 0 || reward.odds > 100) {
      return new HTTPError(
        res,
        400,
        `Odds for reward with id ${reward.reward} are not valid`,
        "invalid request"
      );
    }
    totalOdds += reward.odds;

    // Check if the total odds exceed 100
    if (totalOdds > 100) {
      return new HTTPError(
        res,
        400,
        `Total odds exceed 100`,
        "invalid request"
      );
    }
  }

  // Check if the total odds are less than 100
  if (totalOdds < 100) {
    return new HTTPError(
      res,
      400,
      `Total odds are less than 100`,
      "invalid request"
    );
  }
}
