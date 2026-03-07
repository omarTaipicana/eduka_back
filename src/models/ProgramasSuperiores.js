const { DataTypes } = require("sequelize");
const sequelize = require("../utils/connection");

const ProgramasSuperiores = sequelize.define("programasSuperiores", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  codigo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },

  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  precioTotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },

  duracionMeses: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },

  tipo: {
    type: DataTypes.ENUM("tecnologia", "maestria", "licenciatura", "combo"),
    defaultValue: "licenciatura",
  },
});

module.exports = ProgramasSuperiores;
