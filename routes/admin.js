const {
  createAdminTeam,
  getAdminTeam,
  getMyAdminTeams,
} = require("../controllers/adminController");
const { isLoggedIn, onlySuperAdmin } = require("../middlewares/user");

const router = require("express").Router();

router
  .route("/admin")
  .get(isLoggedIn, getMyAdminTeams)
  .post(isLoggedIn, onlySuperAdmin, createAdminTeam);

router
  .route("/admin/:adminTeamID")
  .get(isLoggedIn, onlySuperAdmin, getAdminTeam);

module.exports = router;
