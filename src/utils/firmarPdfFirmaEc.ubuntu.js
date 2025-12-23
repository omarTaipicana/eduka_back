// utils/firmarPdfFirmaEc.ubuntu.js
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const PYTHON_BIN = process.env.PYTHON_BIN || "/var/www/eduka_back/.venv/bin/python3";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || err.message).toString()));
      resolve({ stdout, stderr });
    });
  });
}

module.exports = async function firmarPdfFirmaEcUbuntu(pdfPath, opts = {}) {
  if (!fs.existsSync(pdfPath)) throw new Error("El PDF no existe: " + pdfPath);

  const p12Path = process.env.FIRMA_P12_PATH;
  const p12Pass = process.env.FIRMA_P12_PASSWORD;

  if (!p12Path || !fs.existsSync(p12Path)) throw new Error("FIRMA_P12_PATH inválido o no existe.");
  if (!p12Pass) throw new Error("FIRMA_P12_PASSWORD falta en .env");

  // Coordenadas (tu página 830.64 x 595.32)
  const page = opts.page ?? 1; // usa -1 para última página
  const rect = opts.rect ?? [560, 40, 810, 120]; // abajo-derecha (ajustable)
  const fieldName = opts.fieldName ?? "Signature1";

  const ext = path.extname(pdfPath);
  const withField = pdfPath.replace(ext, `_con_campo${ext}`);
  const signedPath = pdfPath.replace(ext, `_firmado${ext}`);

  // 1) Crear campo de firma
  const fieldArg = `${page}/${rect.join(",")}/${fieldName}`;
  await run(PYTHON_BIN, [
    "-m",
    "pyhanko.cli",
    "sign",
    "addfields",
    "--field",
    fieldArg,
    pdfPath,
    withField,
  ]);

  // 2) Firmar PDF
  await run(PYTHON_BIN, [
    "-m",
    "pyhanko.cli",
    "sign",
    "addsig",
    "--field",
    fieldName,
    "--p12-file",
    p12Path,
    "--p12-pass",
    p12Pass,
    withField,
    signedPath,
  ]);

  if (!fs.existsSync(signedPath)) throw new Error("No se generó el PDF firmado: " + signedPath);

  return signedPath;
};
