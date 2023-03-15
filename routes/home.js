const { home } = require("../controllers/home");
const router = require("express").Router();

router.route("/").get(home);
// router.route("/test").get(async (req, res) => {
//   try {
//     const list = await getTwitterUserFollowing(
//       "3984429201",
//       "eno0QTRWdWM2bHZQQVl2N1N0YjY4dFdxOXlXUi1sdWdvRmUweElvc2VNWWNhOjE2Nzg4ODk3MTE1OTc6MTowOmF0OjE"
//     );
//     console.log(list.length);
//     res.send(list);
//   } catch (error) {
//     return new HTTPError(res, 500, "internal server error");
//   }
// });

module.exports = router;
