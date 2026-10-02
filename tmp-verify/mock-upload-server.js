// Servidor temporal de verificación: imita el contrato del backend para probar la
// subida por trozos desde el frontend. Se borra al terminar.
const http = require('http');

const sessions = new Map();

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Content-Type': 'application/json',
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:4300');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors());
    return res.end();
  }

  let bytes = 0;
  req.on('data', (chunk) => {
    bytes += chunk.length;
  });
  req.on('end', () => {
    const query = Object.fromEntries(url.searchParams);
    console.log(JSON.stringify({ method: req.method, path: url.pathname, query, bytes }));

    if (url.pathname === '/ai/uploads/chunk') {
      const index = Number(query.index);
      const total = Number(query.total);
      let uploadId = query.uploadId;
      if (!uploadId) {
        uploadId = `up_${Date.now()}`;
        sessions.set(uploadId, { received: 0, total });
      }
      const session = sessions.get(uploadId) || { received: 0, total };
      session.received += 1;
      sessions.set(uploadId, session);
      res.writeHead(200, cors());
      return res.end(
        JSON.stringify({
          uploadId,
          received: session.received,
          total,
          complete: session.received >= total,
          chunkSize: 3 * 1024 * 1024,
        }),
      );
    }

    if (url.pathname === '/ai/flashcards/file') {
      const session = sessions.get(query.uploadId);
      res.writeHead(200, cors());
      return res.end(
        JSON.stringify({
          flashcards: [
            {
              id: 'mock-1',
              question: 'Tarjeta generada del PDF (chunks: ' + (session ? session.received : 0) + ')',
              answer: 'Respuesta del mock con **markdown** y $x^2$',
              topic: 'Apuntes subidos',
              subject: 'general',
            },
          ],
          source: { filename: 'apuntes.pdf', characters: 1234 },
        }),
      );
    }

    if (url.pathname === '/ai/resources/quiz/file') {
      const session = sessions.get(query.uploadId);
      const quiz = [1, 2, 3].map((n) => ({
        question: `Pregunta ${n} del PDF (chunks: ${session ? session.received : 0})`,
        choices: ['A', 'B', 'C', 'D'],
        answer: 'A',
        explanation: 'Explicación',
      }));
      res.writeHead(200, cors());
      return res.end(
        JSON.stringify({
          resource: {
            id: 'mock-quiz',
            title: 'Simulacro desde PDF',
            type: 'QUIZ',
            difficulty: 'INTERMEDIATE',
            content: { quiz },
          },
          source: { filename: 'apuntes.pdf', characters: 1234, topic: 'Apuntes subidos' },
        }),
      );
    }

    if (url.pathname === '/ai/flashcards') {
      res.writeHead(200, cors());
      return res.end(JSON.stringify({ flashcards: [] }));
    }
    if (url.pathname === '/ai/resources') {
      res.writeHead(200, cors());
      return res.end(JSON.stringify({ resources: [] }));
    }
    if (url.pathname === '/ai/knowledge-gaps') {
      res.writeHead(200, cors());
      return res.end(JSON.stringify({ gaps: [] }));
    }

    res.writeHead(404, cors());
    res.end(JSON.stringify({ message: `no mockeado: ${req.method} ${url.pathname}` }));
  });
});

server.listen(4300, () => console.log('mock escuchando en 4300'));
