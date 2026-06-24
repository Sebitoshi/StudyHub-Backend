import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GroqService } from '../groq.service';
import { MongoClient } from 'mongodb';

@Injectable()
export class JobMatchingService {
  constructor(
    private prisma: PrismaService,
    private groq: GroqService,
    @Inject('MONGO_CLIENT') private mongoClient: MongoClient,
  ) {}

  async calculateMatch(userId: number, jobId: number) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException('Empleo no encontrado');

    const dbName = process.env.MONGODB_DB || 'studyhub';
    const db = this.mongoClient.db(dbName);
    const cacheCollection = db.collection('job_matches');
    
    // 1. Check cache (snapshot) within the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cachedMatch = await cacheCollection.findOne(
      { userId, jobId, createdAt: { $gte: oneDayAgo } },
      { sort: { createdAt: -1 } }
    );

    if (cachedMatch) {
      return {
        matchScore: cachedMatch.matchScore,
        hiringProbability: cachedMatch.hiringProbability,
        strengths: cachedMatch.strengths,
        missingSkills: cachedMatch.missingSkills,
        recommendations: cachedMatch.recommendations,
        cached: true,
        createdAt: cachedMatch.createdAt
      };
    }

    // 2. Extract User Skills
    const userSkills = await this.prisma.userSkill.findMany({
      where: { userId },
      include: { skill: true },
    });
    const userSkillNames = userSkills.map(us => us.skill.nombre.toLowerCase());

    // 3. Math Match
    const jobSkills = job.skills || [];
    const jobSkillNames = jobSkills.map(s => s.toLowerCase());

    let matchScore = 0;
    const strengths: string[] = [];
    const missingSkills: string[] = [];

    if (jobSkillNames.length > 0) {
      let coincidentes = 0;
      for (const reqSkill of jobSkillNames) {
        if (userSkillNames.includes(reqSkill)) {
          coincidentes++;
          strengths.push(jobSkills[jobSkillNames.indexOf(reqSkill)]); // keep original casing
        } else {
          missingSkills.push(jobSkills[jobSkillNames.indexOf(reqSkill)]);
        }
      }
      matchScore = Math.round((coincidentes / jobSkillNames.length) * 100);
    } else {
      // If no skills are defined in the job, fallback to 100% or based on requirements text matching
      matchScore = 100;
    }

    // Also get profile summary for Groq context
    const profile = await this.prisma.academicProfile.findUnique({ where: { userId } });
    
    // 4. Groq Enrichment
    let hiringProbability = matchScore;
    let recommendations: string[] = [];
    let summary = '';

    try {
      const prompt = `Analiza este estudiante para la vacante.
PERFIL:
- Carrera: ${profile?.carrera || 'No especificada'}
- Semestre: ${profile?.semestreActual || 'No especificado'}
- Skills: ${userSkillNames.join(', ') || 'Ninguna'}

OFERTA:
- Empresa: ${job.company}
- Título: ${job.title}
- Skills Requeridos: ${jobSkills.join(', ')}

MATCH SCORE MATEMÁTICO: ${matchScore}%
MISSING SKILLS: ${missingSkills.join(', ') || 'Ninguno'}
STRENGTHS: ${strengths.join(', ') || 'Ninguna'}

Genera un JSON EXACTO con las siguientes claves (no uses markdown):
{
  "summary": "resumen breve del fit de este candidato",
  "recommendations": ["recomendacion 1", "recomendacion 2"],
  "hiringProbability": numero de 0 a 100 evaluando probabilidad realista
}`;

      const groqResponse = await this.groq.chat([{ role: 'user', content: prompt }]);
      const cleanedJsonStr = groqResponse.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedJsonStr);
      
      hiringProbability = parsed.hiringProbability ?? matchScore;
      recommendations = parsed.recommendations ?? [];
      summary = parsed.summary ?? '';
    } catch (e) {
      console.error('Error parsing Groq response for Job Match:', e);
      // Fallback to defaults
    }

    const finalMatch = {
      userId,
      jobId,
      matchScore,
      hiringProbability,
      strengths,
      missingSkills,
      recommendations,
      summary,
      createdAt: new Date(),
    };

    // 5. Save Snapshot to MongoDB
    await cacheCollection.insertOne(finalMatch);

    // Remove _id from response
    const { _id, ...response } = finalMatch as any;

    return {
      ...response,
      cached: false
    };
  }
}
