// controllers/usuariosSecundarios.controller.js
const sequelizeM = require('../utils/connectionM');

const getAllUserM = async (req, res) => {
  try {
    // 1. Obtener todos los usuarios
    const [users] = await sequelizeM.query("SELECT * FROM mdl_user");

    // 2. Obtener todos los cursos en que están matriculados
    const [enrolments] = await sequelizeM.query(`
      SELECT 
        u.id AS userid,
        c.id AS courseid,
        c.shortname AS course
      FROM mdl_user u
      JOIN mdl_user_enrolments ue ON u.id = ue.userid
      JOIN mdl_enrol e ON ue.enrolid = e.id
      JOIN mdl_course c ON e.courseid = c.id
    `);

    // 3. Obtener las calificaciones por ítem (mod)
    const [grades] = await sequelizeM.query(`
      SELECT 
        gg.userid,
        gi.courseid,
        gi.itemname,
        gg.finalgrade
      FROM mdl_grade_grades gg
      JOIN mdl_grade_items gi ON gg.itemid = gi.id
      WHERE gi.itemtype = 'mod' AND gi.itemname IS NOT NULL
    `);

    // 4. Obtener la nota final del curso (itemtype = 'course')
    const [finalGrades] = await sequelizeM.query(`
      SELECT 
        gg.userid,
        gi.courseid,
        gg.finalgrade
      FROM mdl_grade_grades gg
      JOIN mdl_grade_items gi ON gg.itemid = gi.id
      WHERE gi.itemtype = 'course'
    `);

    // 5. Estructurar las notas por usuario → curso → ítem
    const userCourseGradesMap = {};

    grades.forEach(({ userid, courseid, itemname, finalgrade }) => {
      if (!userCourseGradesMap[userid]) userCourseGradesMap[userid] = {};
      if (!userCourseGradesMap[userid][courseid]) userCourseGradesMap[userid][courseid] = {};
      userCourseGradesMap[userid][courseid][itemname] = finalgrade;
    });

    // Agregar la nota final del curso como 'Nota Final'
    finalGrades.forEach(({ userid, courseid, finalgrade }) => {
      if (!userCourseGradesMap[userid]) userCourseGradesMap[userid] = {};
      if (!userCourseGradesMap[userid][courseid]) userCourseGradesMap[userid][courseid] = {};
      userCourseGradesMap[userid][courseid]['Nota Final'] = finalgrade;
    });

    // 6. Armar cursos con notas por usuario
    const userCoursesMap = {};
    enrolments.forEach(({ userid, courseid, course }) => {
      if (!userCoursesMap[userid]) userCoursesMap[userid] = [];
      const grades = userCourseGradesMap[userid]?.[courseid] || {};
      userCoursesMap[userid].push({ fullname: course, grades });
    });

    // 7. Unir todo al resultado final
    const result = users.map(user => ({
      ...user,
      courses: userCoursesMap[user.id] || []
    }));

    res.json(result);
  } catch (error) {
    console.error("Error al obtener usuarios con cursos y notas:", error);
    res.status(500).json({ error: "Error al obtener los datos." });
  }
};

const getUserByUsernameM = async (req, res) => {
  try {
    const { username } = req.params;

    // 1. Obtener el usuario por username o email
    const [[user]] = await sequelizeM.query(`
      SELECT * FROM mdl_user WHERE username = ? OR email = ?
    `, { replacements: [username, username] });

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // 2. Obtener sus cursos
    const [enrolments] = await sequelizeM.query(`
      SELECT 
        c.id AS courseid,
        c.shortname AS course
      FROM mdl_user u
      JOIN mdl_user_enrolments ue ON u.id = ue.userid
      JOIN mdl_enrol e ON ue.enrolid = e.id
      JOIN mdl_course c ON e.courseid = c.id
      WHERE u.id = ?
    `, { replacements: [user.id] });

    // 3. Obtener calificaciones por ítem
    const [grades] = await sequelizeM.query(`
      SELECT 
        gi.courseid,
        gi.itemname,
        gg.finalgrade
      FROM mdl_grade_grades gg
      JOIN mdl_grade_items gi ON gg.itemid = gi.id
      WHERE gg.userid = ? AND gi.itemtype = 'mod' AND gi.itemname IS NOT NULL
    `, { replacements: [user.id] });

    // 4. Obtener calificación final del curso
    const [finalGrades] = await sequelizeM.query(`
      SELECT 
        gi.courseid,
        gg.finalgrade
      FROM mdl_grade_grades gg
      JOIN mdl_grade_items gi ON gg.itemid = gi.id
      WHERE gg.userid = ? AND gi.itemtype = 'course'
    `, { replacements: [user.id] });

    // 5. Organizar notas
    const gradesMap = {};
    grades.forEach(({ courseid, itemname, finalgrade }) => {
      if (!gradesMap[courseid]) gradesMap[courseid] = {};
      gradesMap[courseid][itemname] = finalgrade;
    });
    finalGrades.forEach(({ courseid, finalgrade }) => {
      if (!gradesMap[courseid]) gradesMap[courseid] = {};
      gradesMap[courseid]['Nota Final'] = finalgrade;
    });

    // 6. Armar la lista de cursos del usuario
    const courses = enrolments.map(({ courseid, course }) => ({
      fullname: course,
      grades: gradesMap[courseid] || {}
    }));

    res.json({ ...user, courses });
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    res.status(500).json({ error: "Error al obtener los datos del usuario." });
  }
};



module.exports = { getAllUserM, getUserByUsernameM  };
