import { Injectable } from '@nestjs/common';

@Injectable()
export class StudentModelService {
  // Lightweight student model built from academic context + memories + analytics
  buildModel(academicContext: any, memories: any[], analytics: any[]) {
    const model: any = {};
    model.level = academicContext?.level || academicContext?.semester || 'unknown';
    model.subjects = (academicContext?.subjects || []).map((s) => s.name);
    model.preferences = (memories || []).filter((m) => m.type === 'SUBJECT_PREFERENCE').map((m) => m.value);
    model.difficulties = (memories || []).filter((m) => m.type === 'SUBJECT_DIFFICULTY' || m.type === 'WEAK_SKILL').map((m) => m.value);
    model.objectives = (academicContext?.objectives || []).map((o) => o.name);
    model.analytics = analytics || [];
    return model;
  }
}
