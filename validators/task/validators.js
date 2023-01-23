const User = require("../../models/user");
const Review = require("../../models/review");
const Dao = require("../../models/dao");

module.exports = {
  validator1: {
    exec: function (data1, data2) {},
    parameters: [{ data1: String }, { data2: Number }],
    areValidArguments: function (arguments) {},
  },
  REVIEWED_IN_COMMUNITY: {
    parameters: [
      { communityID: { name: "Community ID", type: String } },
      { userID: { name: "User ID", type: String } },
    ],
    areValidArguments: function (arguments) {
      if ("communityID" in arguments) {
        return true;
      }
      return false;
    },
    exec: async function (arguments) {
      // TODO: This validator might need to be rewriten
      // after new review module
      const { communityID, userID } = arguments;
      const user = await User.findById(userID);
      const community = await Dao.findById(communityID);
      const atLeastOneReview = await Review.findOne({
        user_discord_id: user.discord.id,
        dao_name: community.dao_name,
      });
      console.log("atLeastOneReview: ", { user, community, atLeastOneReview });
      if (!atLeastOneReview) {
        return false;
      }
      return true;
    },
  },
};
