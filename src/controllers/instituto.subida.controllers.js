const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const catchError = require("../utils/catchError");

const Certificado = require("../models/Certificado");
const Inscripcion = require("../models/Inscripcion");
const User = require("../models/User");
// const sendEmail = require("../utils/sendEmail"); // lo usamos luego

// ... cabecera igual que ya tienes ...

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

    // 1) Buscar cedula (10 dígitos)
    const match = fileName.match(/(\d{10})/);
    if (!match) {
      reporte.erroneos.push({
        archivo: fileName,
        motivo: "No contiene cédula de 10 dígitos en el nombre",
      });
      continue;
    }

    const cedula = match[1];

    // 2) Leer grupo desde el nombre si viene tipo _g1
    let grupo = null;
    const matchGrupo = fileName.match(/_g(\d+)/i);
    if (matchGrupo) {
      grupo = matchGrupo[1]; // "1", "2", etc.
    }

    // 3) Validar segunda firma por nombre
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

    // 4) Buscar usuario por cédula
    const user = await User.findOne({ where: { cI: cedula } });
    if (!user) {
      reporte.erroneos.push({
        archivo: fileName,
        cedula,
        motivo: "No se encontró usuario con esa cédula",
      });
      continue;
    }

    // 5) Buscar inscripción por userId + curso
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

    // 6) Ver si ya hay certificado final
    const certExistente = await Certificado.findOne({
      where: { inscripcionId: inscripcion.id, curso: sigla },
    });

    if (certExistente && certExistente.entregado) {
      reporte.duplicados.push({
        archivo: fileName,
        cedula,
        motivo: "Ya existía un certificado firmado por el instituto",
      });
      continue;
    }

    // 7) Guardar PDF final
    const finalFileName = `${cedula}_${sigla}_final.pdf`;
    const finalPath = path.join(carpetaFinal, finalFileName);

    fs.writeFileSync(finalPath, entry.getData());

    // 8) Borrar certificados simples de EDUKA si existen
    const posibleSimple1 = path.join(
      carpetaEduka,
      `${cedula}_${sigla}_g${grupo}_firmado.pdf`
    );
    const posibleSimple2 = path.join(carpetaEduka, `${cedula}_${sigla}.pdf`);
    const posibleSimple3 = path.join(
      carpetaEduka,
      `${cedula}_${sigla}_g${grupo}.pdf`
    );

    [posibleSimple1, posibleSimple2, posibleSimple3].forEach((p) => {
      if (p && fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    });

    // 9) URL pública
    const relativeUrl = `/uploads/certificados_firmados/${sigla}/${finalFileName}`;
    const host = `${req.protocol}://${req.get("host")}`;
    const absoluteUrl = `${host}${relativeUrl}`;

    // 10) Crear o actualizar Certificado en BD con grupo
    if (certExistente) {
      certExistente.url = absoluteUrl;
      certExistente.entregado = true;
      if (grupo) certExistente.grupo = grupo;
      await certExistente.save();
    } else {
      await Certificado.create({
        inscripcionId: inscripcion.id,
        curso: sigla,
        grupo, // ← grupo proveniente del template (via nombre de archivo)
        url: absoluteUrl,
        entregado: true,
      });
    }

    reporte.procesados.push({
      archivo: fileName,
      cedula,
      grupo,
      guardadoComo: finalFileName,
    });
  }

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
