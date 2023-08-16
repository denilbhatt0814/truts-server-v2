const redisClient = require("../databases/redis-client");
const { SpinStreakPeriod } = require("../models/spinStreakPeriod");
const User = require("../models/user");
const HTTPError = require("../utils/httpError");
const {
  streakDayToRewardMapping,
} = require("../validators/allocators/spinStreakRewardAllocator");

exports.incrementSpinStreak = async (userId) => {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    // TODO: can fit redis here to optimize - retrieving latest streak record

    // Find the latest streak record for the user
    const lastStreakRecord = await SpinStreakPeriod.findOne({
      user: userId,
    }).sort({ lastDate: -1 });

    // Get today's date without time
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (lastStreakRecord) {
      // Calculate the date difference
      const lastDate = new Date(lastStreakRecord.lastDate);
      lastDate.setHours(0, 0, 0, 0);
      const dateDiff = (today - lastDate) / (1000 * 60 * 60 * 24); // Difference in days

      if (dateDiff === 1) {
        // If the date difference is exactly 1 day, increment the streak
        lastStreakRecord.count += 1;
        lastStreakRecord.lastDate = today;
        await lastStreakRecord.save();
        // NOTE: since we know that there are no special rewards for streak DAY 1
        await checkEligibiltyAndRewardForStreak(userId);
      } else if (dateDiff > 1) {
        // If the date difference is greater than 1, start a new streak period
        await SpinStreakPeriod.create({
          user: userId,
          startDate: today,
          lastDate: today,
        });
      }
      // If the date difference is 0, then it means the streak was already incremented today, so do nothing
    } else {
      // If no previous streak record is found, create a new one
      await SpinStreakPeriod.create({
        user: userId,
        startDate: today,
        lastDate: today,
      });
    }
  } catch (error) {
    console.log("incrementSpinStreak: ", error);
    // TODO: work here
    throw new Error(error.message);
  }
};

async function checkEligibiltyAndRewardForStreak(userID) {
  /**
   *  find streak count for the user, check if user has already recieved reward for this
   *  if not then allocate now and mark somewhere he has recieved
   *  else pass
   *
   *  would need to store a list/dict in userObject to store if recieved the rewards
   *  aslo need a mapping to see what rewards on what day
   *
   */

  try {
    const lastStreakRecord = await getLatestStreakPeriodByUserID(userID);
    const streakCount = lastStreakRecord.count;

    const streakDayToReward = streakDayToRewardMapping[streakCount];
    if (streakDayToReward) {
      const userStreaks = await User.findById(userID).select(
        "streakRewardClaims"
      );

      // check if already claimed:
      if (!userStreaks.streakRewardClaims[streakCount]) {
        // if not -> reward them now
        await streakDayToReward.reward.allocate(userID);
      }
    }
  } catch (error) {
    console.log("checkEligibiltyAndRewardForStreak: ", error);
    // TODO: work here
    throw new Error(error.message);
  }
}

async function getLatestStreakPeriodByUserID(userID) {
  let lastStreakRecordFromCache = await redisClient.get(
    `USER:LATEST_STREAK_PERIOD:${userID}`
  );

  let lastStreakRecord = null;
  if (lastStreakRecordFromCache) {
    lastStreakRecord = JSON.parse(lastStreakRecordFromCache);
  } else {
    lastStreakRecord = await SpinStreakPeriod.findOne({
      user: userID,
    }).sort({ lastDate: -1 });
    if (lastStreakRecord) {
      await redisClient.setEx(
        `USER:LATEST_STREAK_PERIOD:${userID}`,
        60 * 60 * 12,
        JSON.stringify(lastStreakRecord)
      );
    }
  }

  return lastStreakRecord;
}
