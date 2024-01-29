const { default: mongoose } = require("mongoose");
const { XpTxn } = require("../../models/xpTxn");
const spinRewardAllocators = require("./spinRewardAllocators");
const User = require("../../models/user");

const streakRewardAllocators = {
  XP_ALLOCATION: {
    exec: async function (streakDay, userID, xpValue) {
      try {
        const session = await mongoose.startSession();
        await session.startTransaction();

        const xpTxn = new XpTxn({
          reason: {
            tag: "streakReward",
            id: streakDay,
          },
          user: userID,
          value: xpValue,
          meta: {
            title: `Made ${streakDay} Day Spin Streak!`,
            description: "",
          },
        });

        await xpTxn.save({ session });

        // Mark reward claim - SEPERATE THIS FOR NEW FUNC
        const rewardDetails = {
          reward: `${xpValue} XPs`,
          date: new Date(),
        };

        await User.updateOne(
          { _id: userID },
          { $set: { [`streakRewardClaims.${streakDay}`]: rewardDetails } },
          { session }
        );

        await session.commitTransaction();
        await session.endSession();
      } catch (error) {
        console.log("", error);
      }
    },
  },
};

exports.streakDayToRewardMapping = {
  15: {
    reward: {
      name: "1000 XPs",
      allocate: async function (userID) {
        return await streakRewardAllocators.XP_ALLOCATION.exec(
          15,
          userID,
          1000
        );
      },
    },
  },

  30: {
    reward: {
      name: "2500 XPs",
      allocate: async function (userID) {
        return await streakRewardAllocators.XP_ALLOCATION.exec(
          30,
          userID,
          2500
        );
      },
    },
  },

  60: {
    reward: {
      name: "4500 XPs",
      allocate: async function (userID) {
        return await streakRewardAllocators.XP_ALLOCATION.exec(
          60,
          userID,
          4500
        );
      },
    },
  },

  100: {
    reward: {
      name: "7000 XPs",
      allocate: async function (userID) {
        return await streakRewardAllocators.XP_ALLOCATION.exec(
          100,
          userID,
          7000
        );
      },
    },
  },

  125: {
    reward: {
      name: "9000 XPs",
      allocate: async function (userID) {
        return await streakRewardAllocators.XP_ALLOCATION.exec(
          125,
          userID,
          9000
        );
      },
    },
  },

  150: {
    reward: {
      name: "12000 XPs",
      allocate: async function (userID) {
        return await streakRewardAllocators.XP_ALLOCATION.exec(
          150,
          userID,
          12000
        );
      },
    },
  },
};
