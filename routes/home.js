const { home } = require("../controllers/home");
const router = require("express").Router();

router.route("/").get(home);
// router.route("/test").get(async (req, res) => {
//   try {
//     let hasLiked = await LIKE_ON_TWITTER.exec({
//       tweetID: "1635881194171531264",
//       userID: "63f39c64a07edbfd8eb50ce6",
//     });
//     res.json({ hasLiked });
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json({ msg: "internal server error", error });
//   }
// });

module.exports = router;
