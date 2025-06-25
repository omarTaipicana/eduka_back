const User = require("./User");
const EmailCode = require("./EmailCode");
const Inscripcion = require("./Inscripcion");
const Course = require("./Course");
const Pagos = require("./Pagos");

EmailCode.belongsTo(User);
User.hasOne(EmailCode);

Inscripcion.belongsTo(Course);
Course.hasOne(Inscripcion);

Pagos.belongsTo(Inscripcion);
Inscripcion.hasOne(Pagos);
