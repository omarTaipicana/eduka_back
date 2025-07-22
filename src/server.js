const app = require("./app");
const sequelize = require("./utils/connection");
const sequelizeM = require("./utils/connectionM");

const PORT = process.env.PORT || 8081;

const main = async () => {
  try {
    sequelize.sync();
    sequelizeM.sync();

    console.log("DB connected");
    console.log("DBM connected");

    app.listen(PORT);
    console.log(`Server running on port ${PORT}`);
  } catch (error) {
    console.log(error);
  }
};

main();
