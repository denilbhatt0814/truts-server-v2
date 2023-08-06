const { default: mongoose } = require("mongoose");
const { home } = require("../controllers/home");
const validators = require("../validators/task/validators");
const router = require("express").Router();

router.route("/").get(home);
// router.route("/test").get(async (req, res) => {
//   try {
//     const arguments = {
//       updateAuthority: "H5hcFVZc37PHsQQuMQnZfEtExARNMhCKcy5p9oAySLfq",
//       userID: new mongoose.Types.ObjectId("63f3c9c1a07edbfd8eb878a6"),
//     };
//     const success = await validators["HOLDER_OF_SOL_NFT_V2"].exec(arguments);
//     return res.json({ success });
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json({ msg: "internal server error", error });
//   }
// });

module.exports = router;
