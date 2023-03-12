const { home } = require("../controllers/home");
const router = require("express").Router();

router.route("/").get(home);
// router.route("/test").get(async (req, res) => {
//   try {
//     const isverified = await RETWEET_ON_TWITTER.exec({
//       tweetID: "1634625223059460096",
//       userID: "63f39c64a07edbfd8eb50ce6",
//     });
//     res.send({ isverified });
//   } catch (error) {
//     return new HTTPError(res, 500, "internal server error");
//   }
// });

module.exports = router;
