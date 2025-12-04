const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const catchError = require("../utils/catchError");

// ================================
// 1) LISTAR CERTIFICADOS POR CURSO
// ================================
const listarCertificadosPorCurso = catchError(async (req, res) => {
  const { sigla } = req.params;

  if (!sigla) {
    return res.status(400).json({ message: "Falta parámetro sigla de curso" });
  }

  const carpeta = path.join(
    __dirname,
    "..",
    "..",
    "uploads",
    "certificados",
    sigla
  );

  if (!fs.existsSync(carpeta)) {
    return res.json({ curso: sigla, archivos: [] });
  }

  const archivos = fs.readdirSync(carpeta).filter((f) => f.endsWith(".pdf"));

  const response = archivos.map((file) => {
    const cedula = file.split("_")[0]; // extraemos cedula del nombre
    return {
      cedula,
      nombreArchivo: file,
      url: `/uploads/certificados/${sigla}/${file}`,
    };
  });

  return res.json({
    curso: sigla,
    archivos: response,
  });
});

// ===============================================
// 2) DESCARGAR EN ZIP LOS CERTIFICADOS SELECCIONADOS
// ===============================================
const descargarCertificadosSeleccionados = catchError(async (req, res) => {
  const { sigla } = req.params;
  const { archivos } = req.body;

  if (!sigla) {
    return res.status(400).json({ error: "Falta parámetro sigla" });
  }

  if (!archivos || !Array.isArray(archivos) || archivos.length === 0) {
    return res
      .status(400)
      .json({ error: "Debe enviar un array 'archivos' con al menos un nombre" });
  }

  const baseDir = path.join(
    __dirname,
    "..",
    "..",
    "uploads",
    "certificados",
    sigla
  );

  if (!fs.existsSync(baseDir)) {
    return res.status(404).json({ error: "No existe la carpeta del curso" });
  }

  // Headers de respuesta ZIP
  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=certificados_${sigla}.zip`
  );

  const archive = archiver("zip", { zlib: { level: 9 } });

  // Pipe ZIP → response
  archive.pipe(res);

  for (const fileName of archivos) {
    const filePath = path.join(baseDir, fileName);

    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: fileName });
    } else {
      console.warn("⚠️ Archivo no encontrado, no se incluye en ZIP:", fileName);
    }
  }

  archive.finalize();
});

module.exports = {
  listarCertificadosPorCurso,
  descargarCertificadosSeleccionados,
};
