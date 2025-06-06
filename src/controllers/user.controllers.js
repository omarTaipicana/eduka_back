const catchError = require("../utils/catchError");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");
const EmailCode = require("../models/EmailCode");

const getAll = catchError(async (req, res) => {
  const results = await User.findAll();
  return res.json(results);
});

const create = catchError(async (req, res) => {
  const {
    cI,
    email,
    password,
    firstName,
    lastName,
    cellular,
    dateBirth,
    province,
    city,
    genre,
    isVerified,
    frontBaseUrl,
  } = req.body;
  const bcryptPassword = await bcrypt.hash(password, 10);
  const result = await User.create({
    cI,
    email,
    password: bcryptPassword,
    firstName,
    lastName,
    cellular,
    dateBirth,
    province,
    city,
    genre,
    isVerified,
  });

  const code = require("crypto").randomBytes(32).toString("hex");
  const link = `${frontBaseUrl}/${code}`;

  await EmailCode.create({
    code: code,
    userId: result.id,
  });

  await sendEmail({
    to: email,
    subject: "Verificación de correo electrónico - EDUKA",
    html: `
  <div style="font-family: Arial, sans-serif; background-color: #f0f8ff; padding: 20px; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); overflow: hidden;">
      
      <!-- Encabezado con logo -->
      <div style="text-align: center; background-color: #007BFF; padding: 20px;">
        <img src="https://res.cloudinary.com/desgmhmg4/image/upload/v1747890355/eduka_sf_gaus5o.png" alt="EDUKA" style="width: 150px;" />
      </div>

      <!-- Cuerpo del mensaje -->
      <div style="padding: 30px; text-align: center;">
        <h1 style="color: #007BFF;">Hola ${firstName} ${lastName},</h1>
        <h2 style="font-weight: normal;">Gracias por registrarte en <strong>EDUKA</strong></h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Para completar tu registro y activar tu cuenta, por favor haz clic en el siguiente botón para verificar tu correo electrónico:
        </p>

        <!-- Botón de verificación -->
        <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #00aaff; color: white; font-size: 16px; font-weight: bold; border-radius: 8px; text-decoration: none; margin-top: 20px;">
          Verificar cuenta
        </a>

        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          Si tú no solicitaste este registro, puedes ignorar este mensaje.
        </p>
      </div>

      <!-- Pie -->
      <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #999;">
        © ${new Date().getFullYear()} EDUKA. Todos los derechos reservados.
      </div>

    </div>
  </div>
  `,
  });

  return res.status(201).json(result);
});

const getOne = catchError(async (req, res) => {
  const { id } = req.params;
  const result = await User.findByPk(id);
  if (!result) return res.sendStatus(404);
  return res.json(result);
});

const remove = catchError(async (req, res) => {
  const { id } = req.params;
  await User.destroy({ where: { id } });
  return res.sendStatus(204);
});

const update = catchError(async (req, res) => {
  const {
    cI,
    email,
    password,
    firstName,
    lastName,
    cellular,
    dateBirth,
    province,
    city,
    genre,
    isVerified,
  } = req.body;
  const { id } = req.params;
  const result = await User.update(
    {
      cI,
      firstName,
      lastName,
      cellular,
      dateBirth,
      province,
      city,
      genre,
      isVerified,
    },
    { where: { id }, returning: true }
  );
  if (result[0] === 0) return res.sendStatus(404);
  return res.json(result[1][0]);
});

const login = catchError(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email: email } });
  if (!user) return res.status(401).json({ message: "Usuario Incorrecto" });
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid)
    return res.status(401).json({ message: "Contraseña Incorrecta" });
  if (!user.isVerified)
    return res
      .status(401)
      .json({ message: "El usuario no ha verificado su correo electrónico" });

  const token = jwt.sign({ user }, process.env.TOKEN_SECRET, {
    expiresIn: "1d",
  });

  return res.json({ token });
});

const verifyCode = catchError(async (req, res) => {
  const { code } = req.params;
  const emailCode = await EmailCode.findOne({ where: { code: code } });
  if (!emailCode) return res.status(404).json({ message: "Código Incorrecto" });

  const user = await User.findByPk(emailCode.userId);
  user.isVerified = true;
  await user.save();

  //   const user = await User.update(
  //     { isVerified: true },
  //     { where: emailCode.userId, returning: true }
  //   );

  await emailCode.destroy();

  return res.json({ message: "Usuario verificado correctamente", user });
});

const getLoggedUser = catchError(async (req, res) => {
  const loggedUser = req.user;
  const id = loggedUser.id;

  const result = await User.findByPk(id);
  if (!result) return res.sendStatus(404);

  return res.json(result);
});

const sendEmailResetPassword = catchError(async (req, res) => {
  const { email, frontBaseUrl } = req.body;
  const user = await User.findOne({ where: { email: email } });
  if (!user) return res.status(401).json({ message: "Usuario Incorrecto" });
  const code = require("crypto").randomBytes(32).toString("hex");
  const link = `${frontBaseUrl}/${code}`;
  await EmailCode.create({
    code: code,
    userId: user.id,
  });
  await sendEmail({
    to: email,
    subject: "Restablecer tu contraseña - EDUKA",
    html: `
  <div style="font-family: Arial, sans-serif; background-color: #f0f8ff; padding: 20px; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); overflow: hidden;">

      <!-- Encabezado con logo -->
      <div style="text-align: center; background-color: #007BFF; padding: 20px;">
        <img src="https://res.cloudinary.com/desgmhmg4/image/upload/v1747890355/eduka_sf_gaus5o.png" alt="EDUKA" style="width: 150px;" />
      </div>

      <!-- Cuerpo del mensaje -->
      <div style="padding: 30px; text-align: center;">
        <h1 style="color: #007BFF;">Hola, ${user.firstName} ${user.lastName}</h1>
        <h2 style="font-weight: normal;">¿Olvidaste tu contraseña?</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          No te preocupes. Para restablecer tu contraseña, simplemente haz clic en el siguiente botón:
        </p>

        <!-- Botón de restablecimiento -->
        <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #00aaff; color: white; font-size: 16px; font-weight: bold; border-radius: 8px; text-decoration: none; margin-top: 20px;">
          Restablecer contraseña
        </a>

        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          Si no solicitaste este cambio, puedes ignorar este mensaje con seguridad.
        </p>
      </div>

      <!-- Pie -->
      <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #999;">
        © ${new Date().getFullYear()} EDUKA. Todos los derechos reservados.
      </div>

    </div>
  </div>
  `,
  });

  return res.json(user);
});

const resetPassword = catchError(async (req, res) => {
  const { password } = req.body;
  const { code } = req.params;
  const emailCode = await EmailCode.findOne({ where: { code: code } });
  if (!emailCode) return res.status(401).json({ message: "Codigo Incorrecto" });
  const bcryptPassword = await bcrypt.hash(password, 10);
  const id = emailCode.userId;

  const result = await User.update(
    {
      password: bcryptPassword,
    },
    { where: { id }, returning: true }
  );

  await emailCode.destroy();
  if (result[0] === 0) return res.sendStatus(404);
  return res.json(result[1][0]);
});

module.exports = {
  getAll,
  create,
  getOne,
  remove,
  update,
  login,
  verifyCode,
  getLoggedUser,
  sendEmailResetPassword,
  resetPassword,
};
