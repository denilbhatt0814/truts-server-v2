const User = require("../../models/user");
const { XpTxn } = require("../../models/xpTxn");

module.exports = {
  allocator1: {
    exec: function (data1, data2) {},
    parameters: [
      { data1: String, required: true },
      { data2: Number, required: false },
    ],
    areValidArguments: function (arguments) {},
  },
  TRUTS_XP: {
    parameters: [
      {
        field: "trutsXP",
        name: "Truts XP",
        type: Number,
        required: true,
      },
      {
        field: "rewardID",
        name: "Reward ID",
        type: String,
        required: false,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if ("trutsXP" in arguments && typeof arguments.trutsXP === "number") {
        return true;
      }
      return false;
    },
    // returns allocation success state
    exec: async function (arguments, session) {
      const { trutsXP, rewardID, userID } = arguments;
      const user = await User.findById(userID).select({ _id: 1 });
      if (!user) {
        return false;
      }

      const date = new Date().toISOString().split("T")[0];
      let txn = new XpTxn({
        reason: {
          tag: "spin_wheel",
          id: date,
        },
        user: user._id,
        value: trutsXP,
        meta: {
          title: "Spin-Wheel Reward",
          description: `You won ${trutsXP} XP for spin-wheel on ${date}`,
          data: {
            rewardID,
          },
        },
      });
      txn = await txn.save({ session });
      if (!txn) {
        return null;
      }
      return {
        title: "Congratulations!",
        text: `${trutsXP} XP`,
        description: `Enjoy your well-deserved reward!`,
        icon_url: `https://truts.xyz/missions/coin.svg`,
        redirect_url: ``,
      };
    },
  },
  NOTHING: {
    parameters: [
      {
        field: "rewardID",
        name: "Reward ID",
        type: String,
        required: false,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      return true;
    },
    // returns allocation success state
    exec: async function (arguments, session) {
      const { rewardID, userID } = arguments;

      return {
        title: `Thank you for participating!`,
        text: `0 XPs`,
        description: `Try your luck again tomorrow! 🍀`,
        icon_url: `https://truts.xyz/missions/coin.svg`,
        redirect_url: ``,
      };
    },
  },
};
