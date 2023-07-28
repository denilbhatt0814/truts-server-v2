const { default: mongoose } = require("mongoose");
const { home } = require("../controllers/home");
const validators = require("../validators/task/validators");
const router = require("express").Router();

router.route("/").get(home);
router.route("/test").get(async (req, res) => {
  try {
    const arguments = {
      chainID: 137,
      contractAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      minimumTokenBalance: 1,
      userID: new mongoose.Types.ObjectId("63f39c64a07edbfd8eb50ce6"),
    };
    const success = await validators["HOLDER_OF_EVM_TOKEN"].exec(arguments);
    return res.json({ success });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ msg: "internal server error", error });
  }
});

module.exports = router;
