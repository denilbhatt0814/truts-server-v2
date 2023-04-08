const User = require("../../models/user");
const { Review } = require("../../models/newReview");
const Dao = require("../../models/dao");
const { refreshToken } = require("../../utils/discordHelper");
const HTTPError = require("../../utils/httpError");
const { default: mongoose } = require("mongoose");
const { ALCHEMY_API_KEY } = require("../../config/config");
const { default: axios } = require("axios");
const {
  checkUserHasRetweeted,
  checkUserHasLiked,
} = require("../../utils/twitterHelper");
const checkIsOwner = require("../../utils/solanaNFT");

function getValue(obj, path) {
  const fields = path.split(".");
  let value = obj;
  for (let field of fields) {
    if (value.hasOwnProperty(field)) {
      value = value[field];
    } else {
      return undefined;
    }
  }
  return value;
}

const dependecyCheckers = {
  DISCORD_ACCOUNT: {
    exec: function (user) {
      return "discord" in user && user.discord.id ? true : false;
    },
  },
  TWITTER_ACCOUNT: {
    exec: function (user) {
      return "twitter" in user && user.twitter.id && user.twitter.username
        ? true
        : false;
    },
  },
  EVM_WALLET: {
    exec: function (user) {
      return user.wallets?.find(
        (wallet) => wallet.chain == "EVM" && wallet.verified
      )
        ? true
        : false;
    },
  },
  SOL_WALLET: {
    exec: function (user) {
      return user.wallets?.find(
        (wallet) => wallet.chain == "SOL" && wallet.verified
      )
        ? true
        : false;
    },
  },
  TELEGRAM_ACCOUNT: {
    // TODO: no way to check this RN
    exec: function (user) {
      return true;
    },
  },
};

module.exports = {
  validator1: {
    exec: function (data1, data2) {},
    parameters: [{ data1: String }, { data2: Number }],
    areValidArguments: function (arguments) {},
    getDependecyStatus: async function (data) {},
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
    getDependecyStatus: async function (data) {
      let dependencyStatus = [
        {
          dependency: "DISCORD_ACCOUNT",
          satisfied: false,
          id: 1,
        },
      ];

      if (!data.userID) {
        return dependencyStatus;
      }

      const user = await User.findById(data.userID);
      if (!user) {
        return dependencyStatus;
      }

      dependencyStatus.forEach((status) => {
        status.satisfied = dependecyCheckers[status.dependency].exec(user);
      });

      return dependencyStatus;
    },
    exec: async function (arguments) {
      // TODO: This validator might need to be rewriten
      // after new review module
      // NOTE: optimize find by using select
      const { listingID, userID } = arguments;
      const user = await User.findById(userID).select({ _id: 1 });
      const listing = await Dao.findById(listingID).select({ _id: 1 });
      const atLeastOneReview = await Review.findOne({
        user: mongoose.Types.ObjectId(user._id),
        listing: mongoose.Types.ObjectId(listing._id),
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
    getDependecyStatus: async function (data) {
      let dependencyStatus = [
        {
          dependency: "DISCORD_ACCOUNT",
          satisfied: false,
          id: 1,
        },
      ];

      if (!data.userID) {
        return dependencyStatus;
      }

      const user = await User.findById(data.userID);
      if (!user) {
        return dependencyStatus;
      }

      dependencyStatus.forEach((status) => {
        status.satisfied = dependecyCheckers[status.dependency].exec(user);
      });

      return dependencyStatus;
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
  FOLLOWS_ON_TWITTER: {
    parameters: [
      {
        field: "twitterUsername",
        name: "Twitter Username",
        type: String,
        required: true,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if ("twitterUsername" in arguments) {
        return true;
      }
      return false;
    },
    getDependecyStatus: async function (data) {
      let dependencyStatus = [
        {
          dependency: "TWITTER_ACCOUNT",
          satisfied: false,
          id: 1,
        },
      ];

      if (!data.userID) {
        return dependencyStatus;
      }

      const user = await User.findById(data.userID);
      if (!user) {
        return dependencyStatus;
      }

      dependencyStatus.forEach((status) => {
        status.satisfied = dependecyCheckers[status.dependency].exec(user);
      });

      return dependencyStatus;
    },
    exec: async function (arguments) {
      // NOTE: optimize find by using select
      // here any twitter account can be validated not just a listing's twtr account
      const { twitterUsername, userID } = arguments;
      const user = await User.findById(userID).select(
        "+twitter.access_token +twitter.refresh_token +twitter.following"
      );
      if (!user.twitter) {
        console.log(
          `FOLLOWS_ON_TWITTER: user's [${user._id}] twitter not found connected `
        );
        return false;
      }

      const followsOnTwitter = await user.followsTwitterAccount(
        twitterUsername
      );

      if (!followsOnTwitter) {
        return false;
      }
      return true;
    },
  },
  RETWEET_ON_TWITTER: {
    parameters: [
      {
        field: "tweetID",
        name: "Tweet Id",
        type: String,
        required: true,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if ("tweetID" in arguments) {
        return true;
      }
      return false;
    },
    getDependecyStatus: async function (data) {
      let dependencyStatus = [
        {
          dependency: "TWITTER_ACCOUNT",
          satisfied: false,
          id: 1,
        },
      ];

      if (!data.userID) {
        return dependencyStatus;
      }

      const user = await User.findById(data.userID);
      if (!user) {
        return dependencyStatus;
      }

      dependencyStatus.forEach((status) => {
        status.satisfied = dependecyCheckers[status.dependency].exec(user);
      });

      return dependencyStatus;
    },
    exec: async function (arguments) {
      const { tweetID, userID } = arguments;
      const user = await User.findById(userID).select(
        "+twitter.access_token +twitter.refresh_token"
      );
      if (!user.twitter) {
        console.log(
          `RETWEET_ON_TWITTER: user's [${user._id}] twitter not found connected `
        );
        return false;
      }

      // logic to check if user has retweeted
      // If token has expired
      if (Date.now() + 60000 >= user.twitter.token_expiry) {
        await user.updateTwitterDetails();
      }

      // function to make a query -> check if user in 1st 100
      // else requery w/ pagination token
      const hasRetweeted = await checkUserHasRetweeted(
        user.twitter.id,
        tweetID,
        user.twitter.access_token
      );

      return hasRetweeted;
    },
  },
  LIKE_ON_TWITTER: {
    parameters: [
      {
        field: "tweetID",
        name: "Tweet Id",
        type: String,
        required: true,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if ("tweetID" in arguments) {
        return true;
      }
      return false;
    },
    getDependecyStatus: async function (data) {
      let dependencyStatus = [
        {
          dependency: "TWITTER_ACCOUNT",
          satisfied: false,
          id: 1,
        },
      ];

      if (!data.userID) {
        return dependencyStatus;
      }

      const user = await User.findById(data.userID);
      if (!user) {
        return dependencyStatus;
      }

      dependencyStatus.forEach((status) => {
        status.satisfied = dependecyCheckers[status.dependency].exec(user);
      });

      return dependencyStatus;
    },
    exec: async function (arguments) {
      const { tweetID, userID } = arguments;
      const user = await User.findById(userID).select(
        "+twitter.access_token +twitter.refresh_token"
      );
      if (!user.twitter) {
        console.log(
          `LIKE_ON_TWITTER: user's [${user._id}] twitter not found connected `
        );
        return false;
      }

      // logic to check if user has liked
      // If token has expired
      if (Date.now() + 60000 >= user.twitter.token_expiry) {
        await user.updateTwitterDetails();
      }

      // function to make a query -> check if tweet in 1st 100
      // else requery w/ pagination token
      const hasLiked = await checkUserHasLiked(
        user.twitter.id,
        tweetID,
        user.twitter.access_token
      );

      return hasLiked;
    },
  },

  // TEST: need to test in Multi-Wallet
  HOLDER_OF_NFT_IN_COLLECTION: {
    parameters: [
      {
        field: "chainID",
        name: "Chain ID",
        type: String,
        required: true,
      },
      {
        field: "contractAddress",
        name: "Contract Address",
        type: String,
        required: true,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if ("contractAddress" in arguments && "chainID" in arguments) {
        return true;
      }
      return false;
    },
    getDependecyStatus: async function (data) {
      let dependencyStatus = [
        {
          dependency: "EVM_WALLET",
          satisfied: false,
          id: 1,
        },
      ];

      if (!data.userID) {
        return dependencyStatus;
      }

      const user = await User.findById(data.userID);
      if (!user) {
        return dependencyStatus;
      }

      dependencyStatus.forEach((status) => {
        status.satisfied = dependecyCheckers[status.dependency].exec(user);
      });

      return dependencyStatus;
    },
    exec: async function (arguments) {
      // TEST: THINGS MIGHT HAVE TO CHANGE WHEN WE GET MULTI-WALLET SUPPORT

      const { chainID, contractAddress, userID } = arguments;
      const user = await User.findById(userID, { wallets: 1 });
      if (!user.wallets) {
        console.log(
          `HOLDER_OF_NFT_IN_COLLECTION: user[${user._id}] has no wallet connected`
        );
        return false;
      }

      // then search for EVM wallet
      const EVM_Wallet = user.wallets.find(
        (wallet) => wallet.chain == "EVM" && wallet.verified
      );

      if (!EVM_Wallet) {
        console.log(
          `HOLDER_OF_NFT_IN_COLLECTION: user's [${user._id}] EVM wallet not found connected`
        );
        return false;
      }

      // CHAIN LOGIC
      let chainMapping = {
        1: "eth-mainnet",
        137: "polygon-mainnet",
        42161: "arb-mainnet",
        10: "opt-mainnet",
      };

      const options = {
        method: "GET",
        url: `https://${chainMapping[chainID]}.g.alchemy.com/nft/v2/${ALCHEMY_API_KEY}/isHolderOfCollection`,
        params: {
          wallet: EVM_Wallet.address,
          contractAddress: contractAddress,
        },
        headers: { accept: "application/json" },
      };
      const axios_resp = await axios.request(options);
      const holdsNFT = axios_resp.data.isHolderOfCollection;

      if (holdsNFT) {
        return true;
      }
      return false;
    },
  },
  HOLDER_OF_SOL_NFT: {
    parameters: [
      {
        field: "firstVerifiedCreator",
        name: "First Verified Creator Address",
        type: String,
        required: true,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if ("firstVerifiedCreator" in arguments) {
        return true;
      }
      return false;
    },
    getDependecyStatus: async function (data) {
      let dependencyStatus = [
        {
          dependency: "EVM_WALLET",
          satisfied: false,
          id: 1,
        },
      ];

      if (!data.userID) {
        return dependencyStatus;
      }

      const user = await User.findById(data.userID);
      if (!user) {
        return dependencyStatus;
      }

      dependencyStatus.forEach((status) => {
        status.satisfied = dependecyCheckers[status.dependency].exec(user);
      });

      return dependencyStatus;
    },
    exec: async function (arguments) {
      // TEST: THINGS MIGHT HAVE TO CHANGE WHEN WE GET MULTI-WALLET SUPPORT

      const { firstVerifiedCreator, userID } = arguments;
      const user = await User.findById(userID, { wallets: 1 });
      if (!user.wallets) {
        console.log(
          `HOLDER_OF_SOL_NFT: user[${user._id}] has no wallet connected `
        );
        return false;
      }

      const SOL_Wallet = user.wallets.find(
        (wallet) => wallet.chain == "SOL" && wallet.verified
      );
      if (!SOL_Wallet) {
        console.log(
          `HOLDER_OF_SOL_NFT: user's [${user._id}] SOL wallet not found connected`
        );
        return false;
      }

      const holdsNFT = await checkIsOwner(
        SOL_Wallet.address,
        firstVerifiedCreator
      );

      if (holdsNFT) {
        return true;
      }
      return false;
    },
  },
  JOINED_TELEGRAM: {
    exec: function () {
      return true;
    },
    parameters: [{ url: String }],
    areValidArguments: function (arguments) {
      if ("url" in arguments) {
        return true;
      }
      return false;
    },
    getDependecyStatus: async function (data) {
      let dependencyStatus = [
        {
          dependency: "TELEGRAM_ACCOUNT",
          satisfied: false,
          id: 1,
        },
      ];

      if (!data.userID) {
        return dependencyStatus;
      }

      const user = await User.findById(data.userID);
      if (!user) {
        return dependencyStatus;
      }

      dependencyStatus.forEach((status) => {
        status.satisfied = dependecyCheckers[status.dependency].exec(user);
      });

      return dependencyStatus;
    },
  },
};
