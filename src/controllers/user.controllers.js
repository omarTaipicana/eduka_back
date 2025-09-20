const catchError = require("../utils/catchError");
const User = require("../models/User");
const sequelizeM = require('../utils/connectionM');

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");
const EmailCode = require("../models/EmailCode");
const Course = require("../models/Course");
const Inscripcion = require("../models/Inscripcion");
const Pagos = require("../models/Pagos");
const Certificado = require("../models/Certificado");




// ========================== GET ALL USERS ==========================
const getAll = catchError(async (req, res) => {
  try {
    // 1. Usuarios locales
    const users = await User.findAll({ raw: true });
    if (users.length === 0) return res.json([]);

    const emails = users.map(u => u.email);

    // 2. Usuarios Moodle
    const [moodleUsers] = await sequelizeM.query(`
      SELECT id, email
      FROM mdl_user
      WHERE deleted = 0 AND suspended = 0
        AND email IN (?)
    `, { replacements: [emails] });

    const moodleUserIds = moodleUsers.map(u => u.id);

    // 3. Matriculas Moodle
    const [enrolments] = await sequelizeM.query(`
      SELECT ue.userid, c.id AS courseid, c.shortname AS course
      FROM mdl_user_enrolments ue
      JOIN mdl_enrol e ON ue.enrolid = e.id
      JOIN mdl_course c ON e.courseid = c.id
      WHERE ue.userid IN (?)
    `, { replacements: [moodleUserIds] });

    // 4. Calificaciones mod
    const [grades] = await sequelizeM.query(`
      SELECT gg.userid, gi.courseid, gi.itemname, gg.finalgrade
      FROM mdl_grade_grades gg
      JOIN mdl_grade_items gi ON gg.itemid = gi.id
      WHERE gi.itemtype = 'mod' AND gi.itemname IS NOT NULL
        AND gg.userid IN (?)
    `, { replacements: [moodleUserIds] });

    // 5. Calificaciones finales
    const [finalGrades] = await sequelizeM.query(`
      SELECT gg.userid, gi.courseid, gg.finalgrade
      FROM mdl_grade_grades gg
      JOIN mdl_grade_items gi ON gg.itemid = gi.id
      WHERE gi.itemtype = 'course' AND gg.userid IN (?)
    `, { replacements: [moodleUserIds] });

    // 6. Map calificaciones
    const userCourseGradesMap = {};
    grades.forEach(({ userid, courseid, itemname, finalgrade }) => {
      if (!userCourseGradesMap[userid]) userCourseGradesMap[userid] = {};
      if (!userCourseGradesMap[userid][courseid]) userCourseGradesMap[userid][courseid] = {};
      userCourseGradesMap[userid][courseid][itemname] = finalgrade;
    });
    finalGrades.forEach(({ userid, courseid, finalgrade }) => {
      if (!userCourseGradesMap[userid]) userCourseGradesMap[userid] = {};
      if (!userCourseGradesMap[userid][courseid]) userCourseGradesMap[userid][courseid] = {};
      userCourseGradesMap[userid][courseid]["Nota Final"] = finalgrade;
    });

    // 7. Diccionario sigla → nombre
    const allCourses = await Course.findAll({ raw: true });
    const courseMap = {};
    allCourses.forEach(c => {
      courseMap[c.sigla] = c.nombre;
    });

    // 8. Cursos Moodle
    const userCoursesMap = {};
    enrolments.forEach(({ userid, courseid, course }) => {
      if (!userCoursesMap[userid]) userCoursesMap[userid] = [];
      const grades = userCourseGradesMap[userid]?.[courseid] || {};
      userCoursesMap[userid].push({
        sigla: course,
        fullname: courseMap[course] || course,
        grades
      });
    });

    // 9. Diccionario Moodle email → cursos
    const moodleMap = {};
    moodleUsers.forEach(m => {
      moodleMap[m.email] = userCoursesMap[m.id] || [];
    });

    // 10. Inscripciones + pagos + certificados
    const inscripciones = await Inscripcion.findAll({ raw: true });
    const pagos = await Pagos.findAll({ raw: true });
    const certificados = await Certificado.findAll({ raw: true });

    const inscMap = {};
    inscripciones.forEach(i => {
      if (!inscMap[i.email]) inscMap[i.email] = [];
      inscMap[i.email].push(i);
    });

    const pagosMap = {};
    pagos.forEach(p => {
      pagosMap[p.inscripcionId] = p;
    });

    const certMap = {};
    certificados.forEach(c => {
      const key = `${String(c.cedula).trim().toLowerCase()}-${String(c.curso).trim().toLowerCase()}`;
      certMap[key] = c;
    });

    // 11. Resultado final
    const result = users.map(user => {
      const userCourses = moodleMap[user.email] || [];
      const userInscripciones = inscMap[user.email] || [];

      const coursesWithPagoCert = userCourses.map(course => {
        const insc = userInscripciones.find(
          i => String(i.curso).trim().toLowerCase() === String(course.sigla).trim().toLowerCase()
        );

        let pagoData = {};
        let certData = {};

        if (insc) {
          const pago = pagosMap[insc.id];
          if (pago) {
            pagoData = {
              pagoUrl: pago.pagoUrl,
              valorDepositado: pago.valorDepositado,
              verificado: pago.verificado,
              distintivo: pago.distintivo,
              moneda: pago.moneda,
              entregado: pago.entregado
            };
          }
        }

        const certKey = `${String(user.cI).trim().toLowerCase()}-${String(course.sigla).trim().toLowerCase()}`;
        const cert = certMap[certKey];
        if (cert) {
          certData = {
            grupo: cert.verificado,
            fecha: cert.fecha,
            url: cert.url
          };
        }

        return { ...course, ...pagoData, ...certData };
      });

      return { ...user, courses: coursesWithPagoCert };
    });

    res.json(result);
  } catch (error) {
    console.error("Error en getAll:", error);
    res.status(500).json({ error: "Error al obtener los datos." });
  }
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







// ========================== GET ONE USER (Optimizado) ==========================
const getOne = catchError(async (req, res) => {
  try {
    const { id } = req.params;

    // Usuario en tu BD
    const user = await User.findByPk(id, { raw: true });
    if (!user) return res.sendStatus(404);

    const email = user.email;

    // ========================== MOODLE ==========================
    const [moodleUsers] = await sequelizeM.query(`
      SELECT id, email
      FROM mdl_user
      WHERE deleted = 0 AND suspended = 0
        AND email = ?
    `, { replacements: [email] });

    let moodleUserId = moodleUsers.length > 0 ? moodleUsers[0].id : null;

    let userCourses = [];
    if (moodleUserId) {
      // Cursos inscritos
      const [enrolments] = await sequelizeM.query(`
        SELECT ue.userid, c.id AS courseid, c.shortname AS course
        FROM mdl_user_enrolments ue
        JOIN mdl_enrol e ON ue.enrolid = e.id
        JOIN mdl_course c ON e.courseid = c.id
        WHERE ue.userid = ?
      `, { replacements: [moodleUserId] });

      // Notas de actividades
      const [grades] = await sequelizeM.query(`
        SELECT gi.courseid, gi.itemname, gg.finalgrade
        FROM mdl_grade_grades gg
        JOIN mdl_grade_items gi ON gg.itemid = gi.id
        WHERE gi.itemtype = 'mod' AND gi.itemname IS NOT NULL
          AND gg.userid = ?
      `, { replacements: [moodleUserId] });

      // Nota final
      const [finalGrades] = await sequelizeM.query(`
        SELECT gi.courseid, gg.finalgrade
        FROM mdl_grade_grades gg
        JOIN mdl_grade_items gi ON gg.itemid = gi.id
        WHERE gi.itemtype = 'course' AND gg.userid = ?
      `, { replacements: [moodleUserId] });

      const userCourseGradesMap = {};
      grades.forEach(({ courseid, itemname, finalgrade }) => {
        if (!userCourseGradesMap[courseid]) userCourseGradesMap[courseid] = {};
        userCourseGradesMap[courseid][itemname] = finalgrade;
      });
      finalGrades.forEach(({ courseid, finalgrade }) => {
        if (!userCourseGradesMap[courseid]) userCourseGradesMap[courseid] = {};
        userCourseGradesMap[courseid]["Nota Final"] = finalgrade;
      });

      const allCourses = await Course.findAll({ raw: true });
      const courseMap = {};
      allCourses.forEach(c => { courseMap[c.sigla] = c.nombre; });

      userCourses = enrolments.map(({ courseid, course }) => ({
        sigla: course,
        fullname: courseMap[course] || course,
        grades: userCourseGradesMap[courseid] || {}
      }));
    }

    // ========================== INSCRIPCIONES + PAGOS + CERTIFICADOS ==========================
    const inscripciones = await Inscripcion.findAll({ raw: true, where: { email } });

    // 🔥 Optimizado: solo pagos de esas inscripciones
    const inscripcionIds = inscripciones.map(i => i.id);
    const pagos = inscripcionIds.length
      ? await Pagos.findAll({ raw: true, where: { inscripcionId: inscripcionIds } })
      : [];

    // 🔥 Optimizado: solo certificados de la cédula del usuario
    const certificados = await Certificado.findAll({
      raw: true,
      where: { cedula: user.cI }
    });

    // Maps
    const pagosMap = {};
    pagos.forEach(p => { pagosMap[p.inscripcionId] = p; });

    const certMap = {};
    certificados.forEach(c => {
      const key = `${String(c.cedula).trim().toLowerCase()}-${String(c.curso).trim().toLowerCase()}`;
      certMap[key] = c;
    });

    // Merge final
    const coursesWithPagoCert = userCourses.map(course => {
      const insc = inscripciones.find(
        i => String(i.curso).trim().toLowerCase() === String(course.sigla).trim().toLowerCase()
      );

      let pagoData = {};
      let certData = {};

      if (insc) {
        const pago = pagosMap[insc.id];
        if (pago) {
          pagoData = {
            pagoUrl: pago.pagoUrl,
            valorDepositado: pago.valorDepositado,
            verificado: pago.verificado,
            distintivo: pago.distintivo,
            moneda: pago.moneda,
            entregado: pago.entregado
          };
        }
      }

      const certKey = `${String(user.cI).trim().toLowerCase()}-${String(course.sigla).trim().toLowerCase()}`;
      const cert = certMap[certKey];
      if (cert) {
        certData = {
          grupo: cert.verificado,
          fecha: cert.fecha,
          url: cert.url
        };
      }

      return { ...course, ...pagoData, ...certData };
    });

    res.json({ ...user, courses: coursesWithPagoCert });
  } catch (error) {
    console.error("Error en getOne:", error);
    res.status(500).json({ error: "Error al obtener los datos." });
  }
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
    expiresIn: "2h",
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






// ========================== GET LOGGED USER (Optimizado) ==========================
const getLoggedUser = catchError(async (req, res) => {
  try {
    const loggedUser = req.user;
    const id = loggedUser.id;

    // Usuario en tu BD
    const user = await User.findByPk(id, { raw: true });
    if (!user) return res.sendStatus(404);

    const email = user.email;

    // ========================== MOODLE ==========================
    const [moodleUsers] = await sequelizeM.query(`
      SELECT id, email
      FROM mdl_user
      WHERE deleted = 0 AND suspended = 0
        AND email = ?
    `, { replacements: [email] });

    let moodleUserId = moodleUsers.length > 0 ? moodleUsers[0].id : null;

    let userCourses = [];
    if (moodleUserId) {
      // Cursos inscritos
      const [enrolments] = await sequelizeM.query(`
        SELECT ue.userid, c.id AS courseid, c.shortname AS course
        FROM mdl_user_enrolments ue
        JOIN mdl_enrol e ON ue.enrolid = e.id
        JOIN mdl_course c ON e.courseid = c.id
        WHERE ue.userid = ?
      `, { replacements: [moodleUserId] });

      // Notas de actividades
      const [grades] = await sequelizeM.query(`
        SELECT gi.courseid, gi.itemname, gg.finalgrade
        FROM mdl_grade_grades gg
        JOIN mdl_grade_items gi ON gg.itemid = gi.id
        WHERE gi.itemtype = 'mod' AND gi.itemname IS NOT NULL
          AND gg.userid = ?
      `, { replacements: [moodleUserId] });

      // Nota final
      const [finalGrades] = await sequelizeM.query(`
        SELECT gi.courseid, gg.finalgrade
        FROM mdl_grade_grades gg
        JOIN mdl_grade_items gi ON gg.itemid = gi.id
        WHERE gi.itemtype = 'course' AND gg.userid = ?
      `, { replacements: [moodleUserId] });

      const userCourseGradesMap = {};
      grades.forEach(({ courseid, itemname, finalgrade }) => {
        if (!userCourseGradesMap[courseid]) userCourseGradesMap[courseid] = {};
        userCourseGradesMap[courseid][itemname] = finalgrade;
      });
      finalGrades.forEach(({ courseid, finalgrade }) => {
        if (!userCourseGradesMap[courseid]) userCourseGradesMap[courseid] = {};
        userCourseGradesMap[courseid]["Nota Final"] = finalgrade;
      });

      const allCourses = await Course.findAll({ raw: true });
      const courseMap = {};
      allCourses.forEach(c => { courseMap[c.sigla] = c.nombre; });

      userCourses = enrolments.map(({ courseid, course }) => ({
        sigla: course,
        fullname: courseMap[course] || course,
        grades: userCourseGradesMap[courseid] || {}
      }));
    }

    // ========================== INSCRIPCIONES + PAGOS + CERTIFICADOS ==========================
    const inscripciones = await Inscripcion.findAll({ raw: true, where: { email } });

    // 🔥 Optimizado: solo pagos de esas inscripciones
    const inscripcionIds = inscripciones.map(i => i.id);
    const pagos = inscripcionIds.length
      ? await Pagos.findAll({ raw: true, where: { inscripcionId: inscripcionIds } })
      : [];

    // 🔥 Optimizado: solo certificados del usuario
    const certificados = await Certificado.findAll({
      raw: true,
      where: { cedula: user.cI }
    });

    // Maps
    const pagosMap = {};
    pagos.forEach(p => { pagosMap[p.inscripcionId] = p; });

    const certMap = {};
    certificados.forEach(c => {
      const key = `${String(c.cedula).trim().toLowerCase()}-${String(c.curso).trim().toLowerCase()}`;
      certMap[key] = c;
    });

    // Merge
    const coursesWithPagoCert = userCourses.map(course => {
      const insc = inscripciones.find(
        i => String(i.curso).trim().toLowerCase() === String(course.sigla).trim().toLowerCase()
      );

      let pagoData = {};
      let certData = {};

      if (insc) {
        const pago = pagosMap[insc.id];
        if (pago) {
          pagoData = {
            pagoUrl: pago.pagoUrl,
            valorDepositado: pago.valorDepositado,
            verificado: pago.verificado,
            distintivo: pago.distintivo,
            moneda: pago.moneda,
            entregado: pago.entregado
          };
        }
      }

      const certKey = `${String(user.cI).trim().toLowerCase()}-${String(course.sigla).trim().toLowerCase()}`;
      const cert = certMap[certKey];
      if (cert) {
        certData = {
          grupo: cert.verificado,
          fecha: cert.fecha,
          url: cert.url
        };
      }

      return { ...course, ...pagoData, ...certData };
    });

    res.json({ ...user, courses: coursesWithPagoCert });
  } catch (error) {
    console.error("Error en getLoggedUser:", error);
    res.status(500).json({ error: "Error al obtener los datos." });
  }
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
        <h1 style="color: #007BFF;">Hola, ${user.firstName} ${user.lastName
      }</h1>
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
