const catchError = require("../utils/catchError");
const sendEmail = require("../utils/sendEmail");
const { Op } = require("sequelize");
const Inscripcion = require("../models/Inscripcion");
const Course = require("../models/Course");
const User = require("../models/User");

const sequelizeM = require("../utils/connectionM");
const sequelize = require("../utils/connection");

const getAll = catchError(async (req, res) => {
  const results = await Inscripcion.findAll({
    include: [
      {
        model: User,
        attributes: ["firstName", "lastName", "cI", "grado", "email"],       },
    ],
  });

  return res.json(results);
});

const getDashboardInscripciones = catchError(async (req, res) => {
  const { desde, hasta } = req.query;

  // Filtro de fechas en Inscripcion
  const where = {};
  if (desde || hasta) {
    where.createdAt = {};
    if (desde) where.createdAt[Op.gte] = new Date(desde);
    if (hasta) {
      const hastaDate = new Date(hasta);
      hastaDate.setDate(hastaDate.getDate() + 1); // sumamos 1 día
      where.createdAt[Op.lt] = hastaDate; // menor que el siguiente día
    }
  }

  // Traemos las inscripciones con datos del usuario relacionados
  const inscripciones = await Inscripcion.findAll({
    attributes: ["createdAt"], // solo lo necesario
    where,
    include: [
      {
        model: User,
        as: "user", // debe coincidir con tu alias en la relación
        attributes: ["grado", "subsistema"], // para los gráficos
      },
    ],
  });

  const totalInscritos = inscripciones.length;

  // Conteo por grado
  const inscritosPorGrado = {};
  inscripciones.forEach((i) => {
    const grado = i.user?.grado || "Sin grado";
    inscritosPorGrado[grado] = (inscritosPorGrado[grado] || 0) + 1;
  });

  // Conteo por subsistema
  const inscritosPorSubsistema = {};
  inscripciones.forEach((i) => {
    const subsistema = i.user?.subsistema || "Sin subsistema";
    inscritosPorSubsistema[subsistema] =
      (inscritosPorSubsistema[subsistema] || 0) + 1;
  });

  // Conteo por día
  const inscritosPorDia = {};
  inscripciones.forEach((i) => {
    const fecha = i.createdAt.toISOString().split("T")[0]; // YYYY-MM-DD
    inscritosPorDia[fecha] = (inscritosPorDia[fecha] || 0) + 1;
  });

  // Conteo por franja horaria
  const franjas = [
    { label: "00H-03H", from: 0, to: 3 },
    { label: "04H-07H", from: 4, to: 7 },
    { label: "08H-11H", from: 8, to: 11 },
    { label: "12H-15H", from: 12, to: 15 },
    { label: "16H-19H", from: 16, to: 19 },
    { label: "20H-23H", from: 20, to: 23 },
  ];

  const inscritosPorFranjaHoraria = franjas.map((f) => ({
    label: f.label,
    value: 0,
  }));

  inscripciones.forEach((i) => {
    const hour = i.createdAt.getHours(); // hora local
    const franja = franjas.find((f) => hour >= f.from && hour <= f.to);
    if (franja) {
      const index = inscritosPorFranjaHoraria.findIndex(
        (f) => f.label === franja.label
      );
      if (index !== -1) inscritosPorFranjaHoraria[index].value++;
    }
  });

  return res.json({
    totalInscritos,
    inscritosPorGrado: Object.entries(inscritosPorGrado).map(
      ([grado, cantidad]) => ({ grado, cantidad })
    ),
    inscritosPorSubsistema: Object.entries(inscritosPorSubsistema).map(
      ([subsistema, cantidad]) => ({ subsistema, cantidad })
    ),
    inscritosPorDia: Object.entries(inscritosPorDia).map(
      ([fecha, cantidad]) => ({
        fecha,
        cantidad,
      })
    ),
    inscritosPorFranjaHoraria,
  });
});

const validateUser = catchError(async (req, res) => {
  const { email, code } = req.body;

  if (!email) {
    return res.status(400).json({ error: "El email es requerido" });
  }

  // Buscar usuario
  const user = await User.findOne({ where: { email } });

  if (!user) {
    return res.status(200).json({
      exists: false,
      enrolled: false,
      user: null,
    });
  }

  // Buscar inscripción del usuario para el curso específico
  const inscripcion = await Inscripcion.findOne({
    where: { userId: user.id, curso: code },
  });

  if (inscripcion) {
    return res.status(200).json({
      exists: true,
      enrolled: true,
      user,
      inscripcion, // solo la inscripción del curso que coincide con code
    });
  }

  return res.status(200).json({
    exists: true,
    enrolled: false,
    user,
  });
});

const create = catchError(async (req, res) => {
  const {
    cedula,
    email,
    nombres,
    apellidos,
    celular,
    grado,
    subsistema,
    curso,
    aceptacion,
    courseId,
  } = req.body;

  if (!email || !courseId) {
    return res.status(400).json({ error: "Email y courseId son requeridos" });
  }

  // Verificar si ya existe un usuario por email
  let user = await User.findOne({ where: { email } });

  if (user) {
    // Actualizar campos si el usuario ya existe
    await user.update({
      cI: cedula,
      cellular: celular,
      grado,
      subsistema,
    });
  } else {
    // Si no existe, lo creo
    user = await User.create({
      cI: cedula,
      email,
      firstName: nombres,
      lastName: apellidos,
      cellular: celular,
      grado,
      subsistema,
    });
  }

  // Verificar si ya está inscrito en este curso
  const existingInscripcion = await Inscripcion.findOne({
    where: { userId: user.id, courseId },
  });

  if (existingInscripcion) {
    return res.status(200).json({
      message: "Ya estabas inscrito en este curso",
      inscripcion: existingInscripcion,
      user,
      course: await Course.findByPk(courseId),
    });
  }

  // Crear inscripción
  const inscripcion = await Inscripcion.create({
    aceptacion,
    curso,
    courseId,
    userId: user.id,
  });

  // Buscar curso
  const course = await Course.findByPk(courseId);

  // Enviar email
  await sendEmail({
    to: email,
    subject: "Inscripción confirmada - EDUKA",
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f0f8ff; padding: 20px; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <div style="text-align: center; background-color: #007BFF; padding: 20px;">
            <img src="https://res.cloudinary.com/desgmhmg4/image/upload/v1747890355/eduka_sf_gaus5o.png" alt="EDUKA" style="width: 150px;" />
          </div>
          <div style="padding: 30px; text-align: center;">
            <h1 style="color: #007BFF;">¡Hola ${nombres} ${apellidos}!</h1>
            <h2 style="font-weight: normal;">Felicitaciones por inscribirte en nuestro curso</h2>
            <h2 style="color: #007BFF;">"${course.nombre}"</h2>
            <p style="font-size: 16px; line-height: 1.6;">
              Estamos emocionados de que hayas elegido este curso para ampliar tus conocimientos. Próximamente recibirás en este correo las credenciales y detalles necesarios para acceder a la plataforma al inicio del curso.
            </p>
            <p style="font-size: 16px; line-height: 1.6;">
              Mantente atento/a a tu bandeja de entrada y, por favor, no dudes en contactarnos si tienes alguna pregunta.
            </p>
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              Si no realizaste esta inscripción, por favor comunícate con nosotros de inmediato.
            </p>
          </div>
          <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} EDUKA. Todos los derechos reservados.
          </div>
        </div>
      </div>
    `,
  });

  const io = req.app.get("io");
  if (io) io.emit("inscripcionCreada", { inscripcion, user, course });

  return res.status(201).json({ inscripcion, user, course });
});

const getOne = catchError(async (req, res) => {
  const { id } = req.params;
  const result = await Inscripcion.findByPk(id);
  if (!result) return res.sendStatus(404);
  return res.json(result);
});

const remove = catchError(async (req, res) => {
  const { id } = req.params;
  await Inscripcion.destroy({ where: { id } });
  return res.sendStatus(204);
});

const update = catchError(async (req, res) => {
  const { id } = req.params;

  const result = await Inscripcion.update(req.body, {
    where: { id },
    returning: true,
  });

  if (result[0] === 0)
    return res.status(404).json({ message: "Inscripción no encontrada" });

  const inscripcionActualizada = result[1][0];

  // Emitir evento a todos los clientes conectados
  const io = req.app.get("io");
  if (io) io.emit("inscripcionActualizada", inscripcionActualizada);

  return res.json(inscripcionActualizada);
});

module.exports = {
  getAll,
  getDashboardInscripciones,
  validateUser,
  create,
  getOne,
  remove,
  update,
};
