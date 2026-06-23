import { Injectable } from '@nestjs/common';

@Injectable()
export class SocraticService {
  decideMode(message: string) {
    const t = (message || '').toLowerCase();
    // Prefer Socratic mode for problem-solving and homework help
    if (/ejercicio|problema|resolver|tarea|paso|demostrar|demuestra|prueba|por qué|por que/.test(t)) return 'SOCRATIC';
    // For direct requests to 'give solution' return EXPLICIT
    if (/dame la respuesta|la solución|resolver completo|respuesta completa/.test(t)) return 'EXPLICIT';
    // Exam prep triggers COACH
    if (/examen|parcial|simulacro|preparar|prueba/.test(t)) return 'COACH';
    return 'GUIDED';
  }

  generateSocraticPrompts(question: string) {
    // Return a short sequence of prompting steps
    return [
      'Primera pista: ¿Qué conceptos crees que están involucrados en este problema?',
      'Segunda pista: ¿Qué resultado esperarías si aplicas la definición/teorema X?',
      'Tercera pista: Intenta un caso sencillo o númerico y observa el comportamiento.',
    ];
  }
}
