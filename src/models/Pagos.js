const { DataTypes } = require("sequelize");
const sequelize = require("../utils/connection");

const Pagos = sequelize.define("pagos", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  pagoUrl: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  curso: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  valorDepositado: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  confirmacion: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  verificado: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  distintivo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  moneda: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  entregado: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
});

module.exports = Pagos;
