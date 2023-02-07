const User = require("../../models/user");
const Review = require("../../models/review");
const Dao = require("../../models/dao");
const { refreshToken } = require("../../utils/discordHelper");
const HTTPError = require("../../utils/httpError");

module.exports = {
  validator1: {
    exec: function (data1, data2) {},
    parameters: [{ data1: String }, { data2: Number }],
    areValidArguments: function (arguments) {},
  },
  REVIEWED_IN_LISTING: {
    parameters: [
      {
        field: "listingID",
        name: "Listing ID",
        type: String,
        required: true,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if ("listingID" in arguments) {
        return true;
      }
      return false;
    },
    exec: async function (arguments) {
      // TODO: This validator might need to be rewriten
      // after new review module
      // NOTE: optimize find by using select
      const { listingID, userID } = arguments;
      const user = await User.findById(userID);
      const listing = await Dao.findById(listingID);
      const atLeastOneReview = await Review.findOne({
        user_discord_id: user.discord.id,
        dao_name: listing.dao_name,
      });

      // TEST: REMOVE AFTER DEBUG
      console.log("atLeastOneReview: ", { user, listing, atLeastOneReview });
      if (!atLeastOneReview) {
        return false;
      }
      return true;
    },
  },
  PART_OF_DISCORD: {
    parameters: [
      {
        field: "listingID",
        name: "Listing ID",
        type: String,
        required: true,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if ("listingID" in arguments) {
        return true;
      }
      return false;
    },
    exec: async function (arguments) {
      // TODO: This validator might need to be rewriten
      // after new Listing model
      // NOTE: optimize find by using select
      const { listingID, userID } = arguments;
      const user = await User.findById(userID).select("+discord.refresh_token");
      const listing = await Dao.findById(listingID);

      // TODO: USE DIRECTLY METHOD IN USER MODEL FOR THIS
      // If token has expired
      if (Date.now() >= user.discord.token_expiry) {
        await user.updateDiscordDetails();
      } else {
        await user.updateDiscordGuilds();
      }

      // CHECK IF PART OF LISTING
      let partOfGuild = user.discord.guilds.find(
        (guild) => guild.id == listing.guild_id
      );

      // TEST: REMOVE AFTER DEBUG
      console.log("partOfDiscordServer: ", {
        user,
        listing,
        partOfGuild,
      });

      if (!partOfGuild) {
        return false;
      }
      return true;
    },
  },
};
