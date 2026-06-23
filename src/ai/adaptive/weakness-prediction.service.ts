import { Injectable } from '@nestjs/common';

@Injectable()
export class WeaknessPredictionService {
  predictFromGaps(gaps: Array<any>) {
    // Simple aggregation: return top topics with status DETECTED and highest confidence
    const detected = (gaps || []).filter((g) => g.status === 'DETECTED').sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    return detected.slice(0, 5).map((d) => ({ topic: d.topic, subject: d.subject, confidence: d.confidence }));
  }
}
