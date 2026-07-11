import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

interface NormalizedJob {
  title: string;
  company: string;
  description: string;
  location: string | null;
  modality: 'ON_SITE' | 'REMOTE' | 'HYBRID';
  seniority: 'STUDENT' | 'INTERN' | 'JUNIOR' | 'MID' | 'SENIOR';
  contractType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  isRemote: boolean;
  studentFriendly: boolean;
  requirements: string[];
  skills: string[];
  source: string;
  sourceUrl: string;
  externalId: string;
  publishedAt: string;
}

@Injectable()
export class JobSyncService {
  private readonly logger = new Logger(JobSyncService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async syncAll() {
    this.logger.log('Starting daily job sync...');
    await this.syncArbeitnow();
    await this.syncRemoteOk();
    await this.syncJobicy();
    this.logger.log('Daily job sync completed');
  }

  async syncAllManual() {
    this.logger.log('Starting manual job sync...');
    const results = await Promise.allSettled([
      this.syncArbeitnow(),
      this.syncRemoteOk(),
      this.syncJobicy(),
    ]);
    const summary = results.map((r, i) => {
      const name = ['Arbeitnow', 'RemoteOK', 'Jobicy'][i];
      return r.status === 'fulfilled' ? `${name}: OK` : `${name}: ${r.reason?.message || 'error'}`;
    });
    this.logger.log(`Manual sync completed: ${summary.join(' | ')}`);
    return { synced: true, details: summary };
  }

  private async syncArbeitnow() {
    const response = await fetch('https://www.arbeitnow.com/api/job-board-api', {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Arbeitnow HTTP ${response.status}`);
    const body: any = await response.json();
    const jobs = (body.data || []) as any[];

    const normalized = jobs.map((j: any): NormalizedJob => ({
      title: j.title || 'Sin título',
      company: j.company_name || 'Desconocida',
      description: this.stripHtml(j.description || ''),
      location: j.location || null,
      modality: j.remote ? 'REMOTE' : 'ON_SITE',
      seniority: this.inferSeniority(j.tags, j.title),
      contractType: this.inferContractType(j.job_types),
      salaryMin: null,
      salaryMax: null,
      isRemote: !!j.remote,
      studentFriendly: this.isStudentFriendly(j.title, j.job_types),
      requirements: [],
      skills: (j.tags || []).slice(0, 20),
      source: 'arbeitnow',
      sourceUrl: j.url || '',
      externalId: j.slug || String(j.id || ''),
      publishedAt: j.created_at || new Date().toISOString(),
    }));

    const inserted = await this.batchInsert(normalized);
    this.logger.log(`Arbeitnow: ${normalized.length} fetched, ${inserted} new`);
    return inserted;
  }

  private async syncRemoteOk() {
    const response = await fetch('https://remoteok.com/api', {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`RemoteOK HTTP ${response.status}`);
    const body = await response.json();
    const jobs = (Array.isArray(body) ? body.slice(1) : []) as any[];

    const normalized = jobs.map((j: any): NormalizedJob => ({
      title: j.position || 'Sin título',
      company: j.company || 'Desconocida',
      description: this.stripHtml(j.description || ''),
      location: 'Remoto',
      modality: 'REMOTE',
      seniority: this.inferSeniority(j.tags, j.position),
      contractType: j.contractType || null,
      salaryMin: j.salaryMin ? Number(j.salaryMin) : null,
      salaryMax: j.salaryMax ? Number(j.salaryMax) : null,
      isRemote: true,
      studentFriendly: this.isStudentFriendly(j.position, j.tags),
      requirements: [],
      skills: (j.tags || []).slice(0, 20),
      source: 'remoteok',
      sourceUrl: j.url || '',
      externalId: String(j.id || ''),
      publishedAt: j.date || new Date().toISOString(),
    }));

    const inserted = await this.batchInsert(normalized);
    this.logger.log(`RemoteOK: ${normalized.length} fetched, ${inserted} new`);
    return inserted;
  }

  private async syncJobicy() {
    const response = await fetch('https://jobicy.com/api/v2/remote-jobs?count=50', {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Jobicy HTTP ${response.status}`);
    const body: any = await response.json();
    const jobs = (body.jobs || []) as any[];

    const normalized = jobs.map((j: any): NormalizedJob => ({
      title: j.jobTitle || 'Sin título',
      company: j.companyName || 'Desconocida',
      description: this.stripHtml(j.jobDescription || ''),
      location: j.jobGeo || null,
      modality: 'REMOTE',
      seniority: this.mapSeniority(j.jobLevel),
      contractType: this.mapContractType(j.jobType),
      salaryMin: j.salaryMin ? Number(j.salaryMin) : null,
      salaryMax: j.salaryMax ? Number(j.salaryMax) : null,
      isRemote: true,
      studentFriendly: this.isStudentFriendly(j.jobTitle, j.jobType),
      requirements: [],
      skills: [],
      source: 'jobicy',
      sourceUrl: j.url || '',
      externalId: String(j.id || ''),
      publishedAt: j.pubDate || new Date().toISOString(),
    }));

    const inserted = await this.batchInsert(normalized);
    this.logger.log(`Jobicy: ${normalized.length} fetched, ${inserted} new`);
    return inserted;
  }

  private async batchInsert(jobs: NormalizedJob[]): Promise<number> {
    if (jobs.length === 0) return 0;

    const existing = await this.prisma.job.findMany({
      where: { sourceUrl: { in: jobs.map(j => j.sourceUrl) } },
      select: { sourceUrl: true },
    });
    const existingUrls = new Set(existing.map(e => e.sourceUrl));

    const newJobs = jobs.filter(j => !existingUrls.has(j.sourceUrl));
    if (newJobs.length === 0) return 0;

    await this.prisma.job.createMany({
      data: newJobs.map(j => ({
        title: j.title,
        company: j.company,
        description: j.description.slice(0, 5000),
        location: j.location,
        modality: j.modality,
        seniority: j.seniority,
        contractType: j.contractType,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        isRemote: j.isRemote,
        studentFriendly: j.studentFriendly,
        requirements: j.requirements,
        skills: j.skills,
        source: j.source,
        sourceUrl: j.sourceUrl,
        externalId: j.externalId,
        publishedAt: new Date(j.publishedAt),
      })),
      skipDuplicates: true,
    });

    return newJobs.length;
  }

  private isStudentFriendly(title: string, tags: string | string[] | null): boolean {
    const t = title.toLowerCase();
    const allTags = (Array.isArray(tags) ? tags.join(' ') : tags || '').toLowerCase();
    const text = `${t} ${allTags}`;
    if (/\b(part(-| )?time|medio tiempo|mediodía|intern|pasant|práctica|trainee|freelance|flexible)\b/.test(text)) return true;
    if (/\b(weekend|fin de semana|nocturno|night|student|estudiante|entry level|entry.level)\b/.test(text)) return true;
    return false;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private inferSeniority(tags: string[] = [], title = ''): 'STUDENT' | 'INTERN' | 'JUNIOR' | 'MID' | 'SENIOR' {
    const all = [...tags, title].join(' ').toLowerCase();
    if (/\b(senior|sr\.?|lead|principal|staff|architect)\b/.test(all)) return 'SENIOR';
    if (/\b(mid|intermediate|mid-level)\b/.test(all)) return 'MID';
    if (/\b(junior|jr\.?|trainee|entry|graduate)\b/.test(all)) return 'JUNIOR';
    if (/\b(intern|internship|practicum)\b/.test(all)) return 'INTERN';
    if (/\b(student|studente|practicante)\b/.test(all)) return 'STUDENT';
    return 'MID';
  }

  private inferContractType(jobTypes: string[] = []): string | null {
    if (!jobTypes.length) return null;
    const type = jobTypes[0].toLowerCase();
    if (type.includes('full')) return 'Full-Time';
    if (type.includes('part')) return 'Part-Time';
    if (type.includes('contract') || type.includes('freelance')) return 'Contract';
    if (type.includes('intern')) return 'Internship';
    return null;
  }

  private mapSeniority(level: string | null): 'STUDENT' | 'INTERN' | 'JUNIOR' | 'MID' | 'SENIOR' {
    if (!level) return 'MID';
    const l = level.toLowerCase();
    if (l.includes('senior') || l.includes('lead') || l.includes('principal')) return 'SENIOR';
    if (l.includes('mid') || l.includes('intermediate')) return 'MID';
    if (l.includes('junior') || l.includes('entry') || l.includes('graduate')) return 'JUNIOR';
    if (l.includes('intern')) return 'INTERN';
    if (l.includes('student')) return 'STUDENT';
    return 'MID';
  }

  private mapContractType(type: string | string[] | null): string | null {
    if (!type) return null;
    const t = (Array.isArray(type) ? type[0] : type).toLowerCase();
    if (t.includes('full') || t.includes('permanent')) return 'Full-Time';
    if (t.includes('part')) return 'Part-Time';
    if (t.includes('contract') || t.includes('freelance')) return 'Contract';
    if (t.includes('intern')) return 'Internship';
    return 'Full-Time';
  }
}
