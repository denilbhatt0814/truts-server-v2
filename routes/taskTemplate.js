const { createTaskTemplate } = require("../controllers/taskTemplateController");

const router = require("express").Router();

router.route("/taskTemplate").post(createTaskTemplate);
module.exports = router;
