const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const catchError = require("../utils/catchError");
const Certificado = require("../models/Certificado");
const Inscripcion = require("../models/Inscripcion");
const User = require("../models/User");


// ================================
// 1) LISTAR CERTIFICADOS POR CURSO
// ================================
const listarCertificadosPorCurso = catchError(async (req, res) => {
  const { sigla } = req.params;

  if (!sigla) {
    return res.status(400).json({ message: "Falta parámetro sigla de curso" });
  }

  const carpeta = path.join(__dirname, "..", "..", "uploads", "certificados", sigla);

  if (!fs.existsSync(carpeta)) {
    return res.json({ curso: sigla, archivos: [] });
  }

  // 1) Leer PDFs del disco
  const archivos = fs.readdirSync(carpeta).filter((f) => f.endsWith(".pdf"));

  // 2) Traer certificados ya registrados en BD para este curso
  //    (obtenemos la cédula via Inscripcion -> User)
  const certificadosBD = await Certificado.findAll({
    where: { curso: sigla },
    attributes: ["id", "curso", "inscripcionId", "entregado"],
    include: [
      {
        model: Inscripcion,
        attributes: ["id"],
        include: [
          {
            model: User,
            attributes: ["cI"],
          },
        ],
      },
    ],
  });

  // 3) Crear un set de cédulas que ya tienen certificado en BD (para ese curso)
  //    Si quieres filtrar solo cuando entregado=true, activa el if.
  const cedulasConCertificado = new Set(
    certificadosBD
      .filter((c) => true /* o: c.entregado === true */)
      .map((c) => c.inscripcion?.user?.cI)
      .filter(Boolean)
  );

  // 4) Armar respuesta solo con los que NO están en BD
  const host = `${req.protocol}://${req.get("host")}`;
  const response = archivos
    .map((file) => {
      const cedula = file.split("_")[0];
      return {
        cedula,
        nombreArchivo: file,
        url: `${host}/uploads/certificados/${sigla}/${file}`,
      };
    })
    .filter((item) => !cedulasConCertificado.has(item.cedula));

  return res.json({ curso: sigla, archivos: response });
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

  // Validar todos los nombres antes de generar el ZIP.
  const names = [...new Set(archivos)];
  if (!/^[a-zA-Z0-9_-]+$/.test(sigla) || names.some(n => typeof n !== "string" || path.basename(n)!==n || /[\\/]/.test(n) || !/\.pdf$/i.test(n))) return res.status(400).json({message:"Nombre de archivo inválido"});
  for (const n of names) if (!fs.existsSync(path.join(baseDir,n)) || !fs.statSync(path.join(baseDir,n)).isFile()) return res.status(404).json({message:`Archivo no disponible: ${n}`});
  const os = require("os");
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(),"eduka-zip-"));
  const zipPath = path.join(dir,"certificados.zip");
  let archive, out;
  try {
    await new Promise((resolve,reject)=>{
      out=fs.createWriteStream(zipPath);
      archive=archiver("zip",{zlib:{level:1}});
      out.on("close",resolve); out.on("error",reject); archive.on("error",reject); archive.on("warning",reject);
      archive.pipe(out); for(const n of names) archive.file(path.join(baseDir,n),{name:n});
      archive.finalize().catch(reject);
    });
    if(res.destroyed) return;
    const filename=`certificados_${sigla}_${new Date().toISOString().replace(/[:.]/g,"-")}.zip`;
    res.setHeader("Content-Type","application/zip");
    res.setHeader("Content-Disposition",`attachment; filename="${filename}"`);
    res.setHeader("Content-Length",(await fs.promises.stat(zipPath)).size);
    res.setHeader("Access-Control-Expose-Headers","Content-Disposition, Content-Length");
    await require("stream/promises").pipeline(fs.createReadStream(zipPath),res);
  } finally {
    if(archive) archive.abort();
    if(out && !out.closed) { out.destroy(); await new Promise(resolve => out.once("close",resolve)); }
    await fs.promises.rm(dir,{recursive:true,force:true});
  }
});

module.exports={listarCertificadosPorCurso,descargarCertificadosSeleccionados};
