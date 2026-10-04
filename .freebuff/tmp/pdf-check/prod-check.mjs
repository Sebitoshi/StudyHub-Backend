// Prueba end-to-end en produccion: registro, PDF directo y sobre por trozos
import { readFileSync } from 'node:fs';

const BASE = 'https://study-hub-backend-sigma.vercel.app';
const EMAIL = 'prueba-pdf-4oct@example.com';
const PASS = 'Prueba123!';

const pdf = readFileSync('/tmp/pdf-check/estudio.pdf');

async function post(path, body, token) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* no json */ }
  return { status: r.status, json, text };
}

async function postFile(path, { token, fields = {}, buf = pdf, name = 'estudio.pdf' }) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  fd.append('file', new Blob([buf], { type: 'application/pdf' }), name);
  const r = await fetch(BASE + path, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* no json */ }
  return { status: r.status, json, text };
}

const out = (etiqueta, res) => {
  const cuerpo = res.json ? JSON.stringify(res.json).slice(0, 400) : res.text.slice(0, 400);
  console.log(`\n=== ${etiqueta} -> ${res.status}\n${cuerpo}`);
};

try {
  // 1) Registrar usuario de prueba (o login si ya existe)
  let res = await post('/auth/register', {
    nombre: 'Prueba', apellido: 'PDF', email: EMAIL, password: PASS, confirmPassword: PASS,
  });
  out('REGISTER', res);
  let token = res.json?.access_token || res.json?.token;
  if (!token) {
    res = await post('/auth/login', { email: EMAIL, password: PASS });
    out('LOGIN', res);
    token = res.json?.access_token || res.json?.token;
  }
  if (!token) throw new Error('Sin token, no puedo continuar');
  console.log('\nTOKEN OK');

  // 2) PDF directo -> flashcards
  res = await postFile('/ai/flashcards/file?topic=Biologia%20celular&count=4', { token });
  out('FLASHCARDS/FILE (PDF directo)', res);

  // 3) Subida por trozos de 1 KB: 2 trozos, luego generar con uploadId
  const mitad = Math.ceil(pdf.length / 2);
  const t1 = pdf.subarray(0, mitad);
  const t2 = pdf.subarray(mitad);
  let up = await postFile('/ai/uploads/chunk?index=0&total=2&filename=estudio.pdf&mimetype=application/pdf', { token, buf: t1 });
  out('UPLOADS/CHUNK trozo 0', up);
  const uploadId = up.json?.uploadId;
  up = await postFile(`/ai/uploads/chunk?index=1&total=2&filename=estudio.pdf&mimetype=application/pdf&uploadId=${uploadId}`, { token, buf: t2 });
  out('UPLOADS/CHUNK trozo 1', up);
  console.log('complete:', up.json?.complete);
  if (uploadId) {
    res = await postFile(`/ai/flashcards/file?topic=Biologia%20celular&count=4&uploadId=${uploadId}`, { token, buf: Buffer.alloc(0) });
    out('FLASHCARDS/FILE (uploadId)', res);
  }

  // 4) PDF directo -> simulacro corto
  res = await postFile('/ai/resources/quiz/file?origin=SIMULACRO&count=3', { token });
  out('QUIZ/FILE (simulacro)', res);

  // 5) Limpieza del usuario de prueba: cancelar subida (si quedo)
  if (uploadId) {
    const del = await fetch(`${BASE}/ai/uploads/${uploadId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    console.log('\nDELETE uploads/:id ->', del.status);
  }
} catch (e) {
  console.log('\nERROR FATAL:', e.message);
}
