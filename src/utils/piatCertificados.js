// Certificados PIAT: una inscripción/pago en Diplomado I, cuatro certificados.
const CURSO_PRINCIPAL = "piat-dip-i";
const DIPLOMADOS = ["piat-dip-i", "piat-dip-ii", "piat-dip-iii", "piat-dip-iv"];
const NOMBRES = {
  "piat-dip-i": "PIAT - Diplomado I",
  "piat-dip-ii": "PIAT - Diplomado II",
  "piat-dip-iii": "PIAT - Diplomado III",
  "piat-dip-iv": "PIAT - Diplomado IV",
};
const esDiplomado = (sigla) => DIPLOMADOS.includes(sigla);
const inscripcionCurso = (sigla) => esDiplomado(sigla) ? CURSO_PRINCIPAL : sigla;
module.exports = { CURSO_PRINCIPAL, DIPLOMADOS, NOMBRES, esDiplomado, inscripcionCurso };
