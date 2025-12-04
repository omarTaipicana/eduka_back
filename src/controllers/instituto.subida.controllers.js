const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const catchError = require("../utils/catchError");

const Certificado = require("../models/Certificado");
const Inscripcion = require("../models/Inscripcion");
const User = require("../models/User");
// const sendEmail = require("../utils/sendEmail"); // lo usamos luego

const subirCertificadosFirmados = catchError(async (req, res) => {
  const { sigla } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: "Debe subir un archivo ZIP" });
  }

  const zipPath = req.file.path;
  const zip = new AdmZip(zipPath);
  const zipEntries = zip.getEntries();

  const carpetaEduka = path.join(
    __dirname,
    "..",
    "..",
    "uploads",
    "certificados",
    sigla
  );

  const carpetaFinal = path.join(
    __dirname,
    "..",
    "..",
    "uploads",
    "certificados_firmados",
    sigla
  );

  if (!fs.existsSync(carpetaFinal)) {
    fs.mkdirSync(carpetaFinal, { recursive: true });
  }

  const reporte = {
    procesados: [],
    duplicados: [],
    ignorados: [],
    erroneos: [],
  };

  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;
    if (!entry.name.endsWith(".pdf")) continue;

    const fileName = entry.name;
    const lower = fileName.toLowerCase();

    // 1) Buscar cedula (10 dígitos en cualquier parte del nombre)
    const match = fileName.match(/(\d{10})/);
    if (!match) {
      reporte.erroneos.push({
        archivo: fileName,
        motivo: "No contiene cédula de 10 dígitos en el nombre",
      });
      continue;
    }

    const cedula = match[1];

    // 2) Validar que el nombre parezca tener la segunda firma
    const firmadoInstituto =
      lower.includes("firma") ||
      lower.includes("signed") ||
      lower.includes("signer") ||
      lower.includes("final") ||
      lower.includes("double");

    if (!firmadoInstituto) {
      reporte.ignorados.push({
        archivo: fileName,
        cedula,
        motivo: "El archivo no parece tener firma del instituto (por nombre)",
      });
      continue;
    }

    // 3) Buscar usuario por cédula
    const user = await User.findOne({ where: { cI: cedula } });
    if (!user) {
      reporte.erroneos.push({
        archivo: fileName,
        cedula,
        motivo: "No se encontró usuario con esa cédula",
      });
      continue;
    }

    // 4) Buscar inscripción por userId + curso (sigla)
    const inscripcion = await Inscripcion.findOne({
      where: { userId: user.id, curso: sigla },
    });

    if (!inscripcion) {
      reporte.erroneos.push({
        archivo: fileName,
        cedula,
        motivo: "No se encontró inscripción para esa cédula/curso",
      });
      continue;
    }

    // 5) Ver si ya hay certificado final para esta inscripción+curso
    const certExistente = await Certificado.findOne({
      where: { inscripcionId: inscripcion.id, curso: sigla },
    });

    if (certExistente && certExistente.estado === "firmado_instituto") {
      reporte.duplicados.push({
        archivo: fileName,
        cedula,
        motivo: "Ya existía un certificado firmado por el instituto",
      });
      continue;
    }

    // 6) Guardar PDF final en carpeta certificados_firmados/<sigla>/
    const finalFileName = `${cedula}_${sigla}_final.pdf`;
    const finalPath = path.join(carpetaFinal, finalFileName);

    fs.writeFileSync(finalPath, entry.getData());

    // 7) Borrar certificado “simple” de EDUKA si existe
    const posibleSimple1 = path.join(carpetaEduka, `${cedula}_${sigla}_firmado.pdf`);
    const posibleSimple2 = path.join(carpetaEduka, `${cedula}_${sigla}.pdf`);

    [posibleSimple1, posibleSimple2].forEach((p) => {
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    });

    // 8) URL pública del certificado final
    const relativeUrl = `/uploads/certificados_firmados/${sigla}/${finalFileName}`;

    // 9) Crear o actualizar Certificado en BD
    if (certExistente) {
      certExistente.url = relativeUrl;
      certExistente.estado = "firmado_instituto";
      await certExistente.save();
    } else {
      await Certificado.create({
        inscripcionId: inscripcion.id,
        curso: sigla,
        grupo: null, // luego si quieres lo llenamos por template
        url: relativeUrl,
        entregado: true
      });
    }

    // 10) Agregar al reporte de procesados
    reporte.procesados.push({
      archivo: fileName,
      cedula,
      guardadoComo: finalFileName,
    });
  }

  // borrar ZIP temporal
  try {
    fs.unlinkSync(zipPath);
  } catch (err) {
    console.error("⚠️ No se pudo borrar el ZIP temporal:", err);
  }

  return res.json({
    mensaje: "Procesado finalizado",
    reporte,
  });
});

module.exports = { subirCertificadosFirmados };
