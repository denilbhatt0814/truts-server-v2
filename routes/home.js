const { home } = require("../controllers/home");
const router = require("express").Router();

router.route("/").get(home);
// router.route("/test").get(async (req, res) => {
//   try {
//     const isverified = await HOLDER_OF_SOL_NFT.exec({
//       firstVerifiedCreator: "GMerst9KRfW6sCTpPiVNZFbmTmupeaFca2gTUgBuQAj",
//       userID: "63f39c64a07edbfd8eb50ce6",
//     });
//     res.send({ isverified });
//   } catch (error) {
//     return new HTTPError(res, 500, "internal server error");
//   }
// });

module.exports = router;
