// Genera un PDF 1.4 mínimo con texto real (offsets xref correctos)
const fs = require('fs');

const lineas = [
  'Mitocondria: organelo encargado de la respiracion celular.',
  'Produce ATP mediante la fosforilacion oxidativa.',
  'La glucolisis ocurre en el citoplasma y produce piruvato.',
  'El ciclo de Krebs ocurre en la matriz mitocondrial.',
  'Los ribosomas sintetizan proteinas a partir del ARN mensajero.',
];

const contenido = [
  'BT /F1 14 Tf 50 760 Td 20 TL',
  lineas.map((l) => `(${l}) Tj T*`).join('\n'),
  'ET',
].join('\n');

const objetos = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  `<< /Length ${Buffer.byteLength(contenido)} >>\nstream\n${contenido}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
];

let pdf = '%PDF-1.4\n';
const offsets = [0];
objetos.forEach((o, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
});
const xrefStart = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
for (let i = 1; i <= objetos.length; i += 1) {
  pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

fs.mkdirSync('/tmp/pdf-check', { recursive: true });
fs.writeFileSync('/tmp/pdf-check/estudio.pdf', pdf, 'latin1');
console.log('PDF creado:', Buffer.byteLength(pdf), 'bytes');
