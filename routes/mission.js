const {
  createMission,
  getMissions,
} = require("../controllers/missionController");

const router = require("express").Router();

router.route("/mission").get(getMissions).post(createMission);
module.exports = router;
