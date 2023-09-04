const User = require("../../models/user");
const { Review } = require("../../models/newReview");
const Dao = require("../../models/dao");
const { Listing_Social } = require("../../models/listing_social");
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
const redisClient = require("../../databases/redis-client");
const { Listing } = require("../../models/listing");
const wallet = require("../../models/wallet");
const config = require("../../config/config");
const { TaskForm } = require("../../models/task_form");

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
      return user.discord && user.discord.id ? true : false;
    },
  },
  TWITTER_ACCOUNT: {
    exec: function (user) {
      return user.twitter && user.twitter.id && user.twitter.username
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
  INSTAGRAM_ACCOUNT: {
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

      // TEST:
      let user;
      let userFromCache = await redisClient.get(
        `USER:VALIDATORS:$${data.userID}`
      );
      if (!userFromCache) {
        user = await User.findById(data.userID);
        await redisClient.setEx(
          `USER:VALIDATORS:$${data.userID}`,
          30,
          JSON.stringify(user)
        );
        console.log("Added to cache");
      } else {
        user = JSON.parse(userFromCache);
        console.log("from cache");
      }
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
      const listing = await Listing.findById(listingID).select({ _id: 1 });
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

      // TEST:
      let user;
      let userFromCache = await redisClient.get(
        `USER:VALIDATORS:$${data.userID}`
      );
      if (!userFromCache) {
        user = await User.findById(data.userID);
        await redisClient.setEx(
          `USER:VALIDATORS:$${data.userID}`,
          30,
          JSON.stringify(user)
        );
        console.log("Added to cache");
      } else {
        user = JSON.parse(userFromCache);
        console.log("from cache");
      }

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
      const { listingID, userID } = arguments;
      const user = await User.findById(userID).select("+discord.refresh_token");
      // const listing = await Dao.findById(listingID);
      const social = await Listing_Social.findOne({
        listing: mongoose.Types.ObjectId(listingID),
        platform: "DISCORD",
      });

      if (!social || !social.meta?.guild_id) {
        console.log("partOfDiscordServer: ", {
          user,
          social,
          partOfGuild: true,
        });
        return true;
      }
      if (Date.now() >= user.discord.token_expiry) {
        // TODO: USE DIRECTLY METHOD IN USER MODEL FOR THIS
        // If token has expired
        await user.updateDiscordDetails();
      } else {
        await user.updateDiscordGuilds();
      }

      // CHECK IF PART OF LISTING
      let partOfGuild = user.discord.guilds.find(
        (guild) => guild.id == social.meta.guild_id
      );

      console.log("partOfDiscordServer: ", {
        user,
        social,
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

      let user;
      let userFromCache = await redisClient.get(
        `USER:VALIDATORS:$${data.userID}`
      );
      if (!userFromCache) {
        user = await User.findById(data.userID);
        await redisClient.setEx(
          `USER:VALIDATORS:$${data.userID}`,
          30,
          JSON.stringify(user)
        );
      } else {
        user = JSON.parse(userFromCache);
      }
      if (!user) {
        return dependencyStatus;
      }

      dependencyStatus.forEach((status) => {
        status.satisfied = dependecyCheckers[status.dependency].exec(user);
      });

      return dependencyStatus;
    },
    exec: async function (arguments) {
      // NOTE: FOLLOWING API not working on Basic Plan
      // // NOTE: optimize find by using select
      // // here any twitter account can be validated not just a listing's twtr account
      // const { twitterUsername, userID } = arguments;
      // const user = await User.findById(userID).select(
      //   "+twitter.access_token +twitter.refresh_token +twitter.following"
      // );
      // if (!user.twitter) {
      //   console.log(
      //     `FOLLOWS_ON_TWITTER: user's [${user._id}] twitter not found connected `
      //   );
      //   return false;
      // }

      // const followsOnTwitter = await user.followsTwitterAccount(
      //   twitterUsername
      // );

      // if (!followsOnTwitter) {
      //   return false;
      // }
      // return true;
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

      let user;
      let userFromCache = await redisClient.get(
        `USER:VALIDATORS:$${data.userID}`
      );
      if (!userFromCache) {
        user = await User.findById(data.userID);
        await redisClient.setEx(
          `USER:VALIDATORS:$${data.userID}`,
          30,
          JSON.stringify(user)
        );
      } else {
        user = JSON.parse(userFromCache);
      }
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
      // const user = await User.findById(userID).select(
      //   "+twitter.access_token +twitter.refresh_token"
      // );
      // if (!user.twitter) {
      //   console.log(
      //     `RETWEET_ON_TWITTER: user's [${user._id}] twitter not found connected `
      //   );
      //   return false;
      // }

      // // logic to check if user has retweeted
      // // If token has expired
      // if (Date.now() + 60000 >= user.twitter.token_expiry) {
      //   await user.updateTwitterDetails();
      // }

      // // function to make a query -> check if user in 1st 100
      // // else requery w/ pagination token
      // const hasRetweeted = await checkUserHasRetweeted(
      //   user.twitter.id,
      //   tweetID,
      //   user.twitter.access_token
      // );

      // return hasRetweeted;
      return true;
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

      let user;
      let userFromCache = await redisClient.get(
        `USER:VALIDATORS:$${data.userID}`
      );
      if (!userFromCache) {
        user = await User.findById(data.userID);
        await redisClient.setEx(
          `USER:VALIDATORS:$${data.userID}`,
          30,
          JSON.stringify(user)
        );
      } else {
        user = JSON.parse(userFromCache);
      }
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
      // if (!user.twitter) {
      //   console.log(
      //     `LIKE_ON_TWITTER: user's [${user._id}] twitter not found connected `
      //   );
      //   return false;
      // }

      // // logic to check if user has liked
      // // If token has expired
      // if (Date.now() + 60000 >= user.twitter.token_expiry) {
      //   await user.updateTwitterDetails();
      // }

      // // function to make a query -> check if tweet in 1st 100
      // // else requery w/ pagination token
      // const hasLiked = await checkUserHasLiked(
      //   user.twitter.id,
      //   tweetID,
      //   user.twitter.access_token
      // );

      // return hasLiked;
      return true;
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

      let user;
      let userFromCache = await redisClient.get(
        `USER:VALIDATORS:$${data.userID}`
      );
      if (!userFromCache) {
        user = await User.findById(data.userID);
        await redisClient.setEx(
          `USER:VALIDATORS:$${data.userID}`,
          30,
          JSON.stringify(user)
        );
      } else {
        user = JSON.parse(userFromCache);
      }
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
  HOLDER_OF_EVM_TOKEN: {
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
      {
        field: "minimumTokenBalance",
        name: "Minimum Token Balance",
        type: Number,
        required: true,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if (
        "chainID" in arguments &&
        "contractAddress" in arguments &&
        "minimumTokenBalance" in arguments
      ) {
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

      let user;
      let userFromCache = await redisClient.get(
        `USER:VALIDATORS:$${data.userID}`
      );
      if (!userFromCache) {
        user = await User.findById(data.userID);
        await redisClient.setEx(
          `USER:VALIDATORS:$${data.userID}`,
          30,
          JSON.stringify(user)
        );
      } else {
        user = JSON.parse(userFromCache);
      }
      if (!user) {
        return dependencyStatus;
      }

      dependencyStatus.forEach((status) => {
        status.satisfied = dependecyCheckers[status.dependency].exec(user);
      });

      return dependencyStatus;
    },
    exec: async function (arguments) {
      const { chainID, contractAddress, minimumTokenBalance, userID } =
        arguments;

      const user = await User.findById(userID, { wallets: 1 });
      if (!user.wallets) {
        console.log(
          `HOLDER_OF_EVM_TOKEN: user[${user._id}] has no wallet connected`
        );
        return false;
      }

      // then search for EVM wallet
      const EVM_Wallet = user.wallets.find(
        (wallet) => wallet.chain == "EVM" && wallet.verified
      );

      if (!EVM_Wallet) {
        console.log(
          `HOLDER_OF_EVM_TOKEN: user's [${user._id}] EVM wallet not found connected`
        );
        return false;
      }

      // CHAIN LOGIC
      let chainMapping = {
        1: "eth-mainnet",
        137: "matic-mainnet",
        42161: "arb-mainnet",
        10: "opt-mainnet",
        5000: "mantle-mainnet",
      };

      const url = `https://api.covalenthq.com/v1/${chainMapping[chainID]}/address/${EVM_Wallet.address}/balances_v2/`;
      const axios_resp = await axios.get(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${config.COVALENT_API_KEY}`,
          "Accept-Encoding": "gzip,deflate,compress",
        },
      });

      const tokenInWallet = axios_resp.data.data.items.find(
        (token) =>
          token.contract_address.toLowerCase() == contractAddress.toLowerCase()
      );

      if (!tokenInWallet) {
        return false;
      }

      if (
        tokenInWallet.balance / Math.pow(10, tokenInWallet.contract_decimals) >=
        minimumTokenBalance
      ) {
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
          dependency: "SOL_WALLET",
          satisfied: false,
          id: 1,
        },
      ];

      if (!data.userID) {
        return dependencyStatus;
      }
      let user;
      let userFromCache = await redisClient.get(
        `USER:VALIDATORS:$${data.userID}`
      );
      if (!userFromCache) {
        user = await User.findById(data.userID);
        await redisClient.setEx(
          `USER:VALIDATORS:$${data.userID}`,
          30,
          JSON.stringify(user)
        );
      } else {
        user = JSON.parse(userFromCache);
      }
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
  HOLDER_OF_SOL_NFT_V2: {
    parameters: [
      {
        field: "updateAuthority",
        name: "Update Authority",
        type: String,
        required: true,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if ("updateAuthority" in arguments) {
        return true;
      }
      return false;
    },
    getDependecyStatus: async function (data) {
      let dependencyStatus = [
        {
          dependency: "SOL_WALLET",
          satisfied: false,
          id: 1,
        },
      ];

      if (!data.userID) {
        return dependencyStatus;
      }
      let user;
      let userFromCache = await redisClient.get(
        `USER:VALIDATORS:$${data.userID}`
      );
      if (!userFromCache) {
        user = await User.findById(data.userID);
        await redisClient.setEx(
          `USER:VALIDATORS:$${data.userID}`,
          30,
          JSON.stringify(user)
        );
      } else {
        user = JSON.parse(userFromCache);
      }
      if (!user) {
        return dependencyStatus;
      }

      dependencyStatus.forEach((status) => {
        status.satisfied = dependecyCheckers[status.dependency].exec(user);
      });

      return dependencyStatus;
    },
    exec: async function (arguments) {
      const { updateAuthority, userID } = arguments;
      const user = await User.findById(userID, { wallets: 1 });
      if (!user.wallets) {
        console.log(
          `HOLDER_OF_SOL_NFT_V2: user[${user._id}] has no wallet connected `
        );
        return false;
      }

      const SOL_WALLET = user.wallets.find(
        (wallet) => wallet.chain == "SOL" && wallet.verified
      );
      if (!SOL_WALLET) {
        console.log(
          `HOLDER_OF_SOL_NFT_V2: user's [${user._id}] SOL wallet not found connected`
        );
        return false;
      }

      // check user is holding particular nft or not

      let url = `https://api-mainnet.magiceden.dev/v2/wallets/${SOL_WALLET.address}/tokens`;
      const axios_resp = await axios.get(url);
      const tokenList = axios_resp.data;

      for (let token of tokenList) {
        if (token.updateAuthority == updateAuthority && token.supply >= 1) {
          return true;
        }
      }
      return false;
    },
  },
  HOLDER_SOL_TOKEN: {
    parameters: [
      {
        field: "mintAddress",
        name: "Mint Address",
        type: String,
        required: true,
      },
      {
        field: "minimumTokenBalance",
        name: "Minimum Token Balance",
        type: Number,
        required: true,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if ("mintAddress" in arguments && "minimumTokenBalance" in arguments) {
        return true;
      }
      return false;
    },
    // TODO
    getDependecyStatus: async function (data) {
      let dependencyStatus = [
        {
          dependency: "SOL_WALLET",
          satisfied: false,
          id: 1,
        },
      ];

      if (!data.userID) {
        return dependencyStatus;
      }
      let user;
      let userFromCache = await redisClient.get(
        `USER:VALIDATORS:$${data.userID}`
      );
      if (!userFromCache) {
        user = await User.findById(data.userID);
        await redisClient.setEx(
          `USER:VALIDATORS:$${data.userID}`,
          30,
          JSON.stringify(user)
        );
      } else {
        user = JSON.parse(userFromCache);
      }
      if (!user) {
        return dependencyStatus;
      }

      dependencyStatus.forEach((status) => {
        status.satisfied = dependecyCheckers[status.dependency].exec(user);
      });

      return dependencyStatus;
    },
    exec: async function (arguments) {
      const { mintAddress, minimumTokenBalance, userID } = arguments;
      const user = await User.findById(userID, { wallets: 1 });
      if (!user.wallets) {
        console.log(
          `HOLDER_OF_SOL_NFT: user[${user._id}] has no wallet connected `
        );
        return false;
      }

      const SOL_WALLET = user.wallets.find(
        (wallet) => wallet.chain == "SOL" && wallet.verified
      );
      if (!SOL_WALLET) {
        console.log(
          `HOLDER_OF_SOL_NFT: user's [${user._id}] SOL wallet not found connected`
        );
        return false;
      }

      const url = `https://api.helius.xyz/v0/addresses/${SOL_WALLET.address}/balances?api-key=${config.HELIUS_API_KEY}`;

      const axios_resp = await axios.get(url);
      const { tokens } = axios_resp.data;

      for (let token of tokens) {
        if (
          token.mint == mintAddress &&
          token.amount / Math.pow(10, token.decimals) >= minimumTokenBalance
        ) {
          return true;
        }
      }

      return false;
    },
  },
  INTERACTED_WITH_SMART_CONTRACT: {
    parameters: [
      {
        field: "chainID",
        name: "Chain ID",
        type: String,
        required: true,
      },
      {
        field: "smartContractAddress",
        name: "Smart Contract Address",
        type: String,
        required: true,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if ("SmartContractAddress" in arguments && "chainID" in arguments) {
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

      let user;
      let userFromCache = await redisClient.get(
        `USER:VALIDATORS:$${data.userID}`
      );
      if (!userFromCache) {
        user = await User.findById(data.userID);
        await redisClient.setEx(
          `USER:VALIDATORS:$${data.userID}`,
          30,
          JSON.stringify(user)
        );
      } else {
        user = JSON.parse(userFromCache);
      }
      if (!user) {
        return dependencyStatus;
      }

      dependencyStatus.forEach((status) => {
        status.satisfied = dependecyCheckers[status.dependency].exec(user);
      });

      return dependencyStatus;
    },
    exec: async function (arguments) {
      const { chainID, smartContractAddress, userID } = arguments;
      const user = await User.findById(userID, { wallets: 1 });
      if (!user.wallets) {
        console.log(
          `INTERACTED_WITH_SMART_CONTRACT: user[${user._id}] has no wallet connected`
        );
        return false;
      }

      const EVM_Wallet = user.wallets.find(
        (wallet) => wallet.chain == "EVM" && wallet.verified
      );

      if (!EVM_Wallet) {
        console.log(
          `INTERACTED_WITH_SMART_CONTRACT: user's [${user._id}] EVM wallet not found connected`
        );
        return false;
      }

      // CHAIN LOGIC has been changed - ask denil
      let chainMapping = {
        1: "eth-mainnet",
        137: "matic-mainnet",
        42161: "arbitrum-mainnet",
        10: "optimism-mainnet",
      };

      let transactionFound = false,
        page_param = -1,
        axios_resp;

      do {
        axios_resp = await fetchTransactionList(
          EVM_Wallet.address,
          page_param,
          chainMapping[chainID]
        );
        page_param = axios_resp.data.data.current_page - 1;

        let count = axios_resp.data.data.items.length;
        for (let i = 0; i < count && !transactionFound; i++) {
          if (
            axios_resp.data.data.items[i].to_address ==
            smartContractAddress.toLowerCase()
          ) {
            transactionFound = true;
          }
        }
      } while (axios_resp.data.data.links.prev != null && !transactionFound);

      if (transactionFound) return true;
      else return false;

      function fetchTransactionList(walletAddress, page_param, chainName) {
        return axios.get(
          `https://api.covalenthq.com/v1/${chainName}/address/${walletAddress}/transactions_v3${
            page_param === -1 ? `` : `/page/${page_param}`
          }/?no-logs=true`,
          {
            headers: {
              Authorization: `Bearer ${config.COVALENT_API_KEY}`,
            },
          }
        );
      }
    },
  },
  JOINED_TELEGRAM: {
    exec: function () {
      return true;
    },
    parameters: [
      { field: "url", name: "URL", type: String, required: true },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
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

      // TEST:
      let user;
      let userFromCache = await redisClient.get(
        `USER:VALIDATORS:$${data.userID}`
      );
      if (!userFromCache) {
        user = await User.findById(data.userID);
        await redisClient.setEx(
          `USER:VALIDATORS:$${data.userID}`,
          30,
          JSON.stringify(user)
        );
        console.log("Added to cache");
      } else {
        user = JSON.parse(userFromCache);
        console.log("from cache");
      }
      if (!user) {
        return dependencyStatus;
      }

      dependencyStatus.forEach((status) => {
        status.satisfied = dependecyCheckers[status.dependency].exec(user);
      });

      return dependencyStatus;
    },
  },
  FOLLOWS_ON_INSTAGRAM: {
    exec: function () {
      return true;
    },
    parameters: [
      { field: "url", name: "URL", type: String, required: true },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
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

      // TEST:
      let user;
      let userFromCache = await redisClient.get(
        `USER:VALIDATORS:$${data.userID}`
      );
      if (!userFromCache) {
        user = await User.findById(data.userID);
        await redisClient.setEx(
          `USER:VALIDATORS:$${data.userID}`,
          30,
          JSON.stringify(user)
        );
        console.log("Added to cache");
      } else {
        user = JSON.parse(userFromCache);
        console.log("from cache");
      }
      if (!user) {
        return dependencyStatus;
      }

      dependencyStatus.forEach((status) => {
        status.satisfied = dependecyCheckers[status.dependency].exec(user);
      });

      return dependencyStatus;
    },
  },
  TWEET_LINK_VERIFICATION: {
    parameters: [
      { field: "userID", name: "User ID", type: String, required: false },
      { field: "taskID", name: "Task ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      return true;
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

      // TEST:
      let user;
      let userFromCache = await redisClient.get(
        `USER:VALIDATORS:$${data.userID}`
      );
      if (!userFromCache) {
        user = await User.findById(data.userID);
        await redisClient.setEx(
          `USER:VALIDATORS:$${data.userID}`,
          30,
          JSON.stringify(user)
        );
        console.log("Added to cache");
      } else {
        user = JSON.parse(userFromCache);
        console.log("from cache");
      }
      if (!user) {
        return dependencyStatus;
      }

      dependencyStatus.forEach((status) => {
        status.satisfied = dependecyCheckers[status.dependency].exec(user);
      });

      return dependencyStatus;
    },
    exec: async function (arguments) {
      const { userID, taskID } = arguments;
      console.log(arguments);
      // fetch submitted link
      const taskForm = await TaskForm.findOne({ user: userID, task: taskID });
      const user = await User.findById(userID).select("twitter");

      if (!user) {
        console.log("not user");
        return false;
      }

      if (!taskForm) {
        console.log("not submission");
        return false;
      }

      const { link } = taskForm.formData;

      // regex match
      const username = user.twitter.username;
      const regexPattern = new RegExp(
        `https:\\/\\/twitter\\.com\\/${username}\\/status\\/\\d+`
      );

      if (!regexPattern.test(link)) {
        console.log("not match");
        return false;
      }

      return true;
    },
  },
};
