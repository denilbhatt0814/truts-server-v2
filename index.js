require("dotenv").config();
require("./config/db.js").connectWithDb();

const app = require("./app.js");
const { PORT } = require("./config/config.js");

app.listen(PORT, () => {
  console.log(`Server is running at port: ${PORT} `);
});
