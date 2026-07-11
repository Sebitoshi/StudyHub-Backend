import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

interface CrawledJob {
  title: string;
  company: string;
  description: string;
  location: string | null;
  country: string | null;
  city: string | null;
  modality: 'ON_SITE' | 'REMOTE' | 'HYBRID';
  seniority: 'STUDENT' | 'INTERN' | 'JUNIOR' | 'MID' | 'SENIOR';
  contractType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  isRemote: boolean;
  studentFriendly: boolean;
  requirements: string[];
  skills: string[];
  sourceUrl: string;
  publishedAt: string;
}

@Injectable()
export class JobCrawlerService {
  private readonly logger = new Logger(JobCrawlerService.name);

  async crawl(url: string): Promise<CrawledJob | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        this.logger.warn(`Crawl failed ${url} HTTP ${response.status}`);
        return null;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const jsonLd = this.extractJsonLd($);
      if (jsonLd) return jsonLd;

      return this.extractFromHtml($, url);
    } catch (err) {
      this.logger.warn(`Crawl error ${url}: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  private extractJsonLd($: cheerio.CheerioAPI): CrawledJob | null {
    const scripts = $('script[type="application/ld+json"]').toArray();
    for (const script of scripts) {
      try {
        const raw = $(script).text();
        const data = JSON.parse(raw);
        const job = this.normalizeJsonLd(data);
        if (job) return job;
      } catch { }
    }
    return null;
  }

  private normalizeJsonLd(data: any): CrawledJob | null {
    const types = [data['@type'], data['@graph']?.map((n: any) => n['@type'])].flat().filter(Boolean);
    const jobData = data['@graph']?.find((n: any) => n['@type'] === 'JobPosting') || data;

    if (!jobData.title) return null;

    const locationStr = jobData.jobLocation?.address
      ? [jobData.jobLocation.address.addressLocality, jobData.jobLocation.address.addressRegion, jobData.jobLocation.address.addressCountry]
          .filter(Boolean).join(', ')
      : jobData.jobLocation?.name || null;

    const city = jobData.jobLocation?.address?.addressLocality || null;
    const country = jobData.jobLocation?.address?.addressCountry || null;

    const salary = jobData.baseSalary || jobData.estimatedSalary;
    const salaryMin = salary?.value?.minValue ? Number(salary.value.minValue) : salary?.value?.value ? Number(salary.value.value) : null;
    const salaryMax = salary?.value?.maxValue ? Number(salary.value.maxValue) : null;

    const employmentType = jobData.employmentType || jobData.employmentType;
    const modality = jobData.jobLocationType?.toLowerCase().includes('remote')
      ? 'REMOTE' as const
      : jobData.jobLocationType?.toLowerCase().includes('hybrid')
        ? 'HYBRID' as const
        : 'ON_SITE' as const;

    const skillsRaw = jobData.skills || jobData.qualifications || jobData.educationRequirements || '';
    const skills = typeof skillsRaw === 'string'
      ? skillsRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
      : Array.isArray(skillsRaw) ? skillsRaw : [];

    return {
      title: jobData.title,
      company: jobData.hiringOrganization?.name || jobData.name || 'Desconocida',
      description: this.stripHtml(jobData.description || ''),
      location: locationStr,
      country,
      city,
      modality,
      seniority: this.inferSeniority([], jobData.title),
      contractType: this.mapEmploymentType(employmentType),
      salaryMin,
      salaryMax,
      isRemote: modality === 'REMOTE',
      requirements: [],
      skills,
      studentFriendly: this.isStudentFriendly(jobData.title, employmentType, modality),
      sourceUrl: jobData.url || '',
      publishedAt: jobData.datePosted || new Date().toISOString(),
    };
  }

  private extractFromHtml($: cheerio.CheerioAPI, url: string): CrawledJob | null {
    const title = $('h1').first().text().trim() || $('title').text().trim();
    if (!title) return null;

    const company = $('[class*="company"], [class*="employer"], [class*="hiring"]').first().text().trim() || 'Desconocida';

    const descEl = $('[class*="description"], [class*="desc"], [itemprop="description"], .job-description, .jobDescription');
    const description = descEl.length ? descEl.text().trim() : $('body').text().trim().slice(0, 5000);

    const locationText = $('[class*="location"], [class*="ubicacion"], [itemprop="address"], .job-location').first().text().trim() || null;

    return {
      title,
      company,
      description: this.stripHtml(description),
      location: locationText,
      country: null,
      city: null,
      modality: 'ON_SITE',
      seniority: this.inferSeniority([], title),
      contractType: null,
      salaryMin: null,
      salaryMax: null,
      isRemote: url.toLowerCase().includes('remote') || locationText?.toLowerCase().includes('remoto') || false,
      requirements: [],
      skills: [],
      studentFriendly: this.isStudentFriendly(title, null, null),
      sourceUrl: url,
      publishedAt: new Date().toISOString(),
    };
  }

  private stripHtml(text: string): string {
    return text.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000);
  }

  private mapEmploymentType(type: string | string[] | null): string | null {
    if (!type) return null;
    const t = (Array.isArray(type) ? type[0] : type).toLowerCase();
    if (t.includes('full') || t.includes('permanent') || t.includes('full_time')) return 'Full-Time';
    if (t.includes('part') || t.includes('part_time')) return 'Part-Time';
    if (t.includes('contract') || t.includes('freelance') || t.includes('temporary') || t.includes('temp')) return 'Contract';
    if (t.includes('intern')) return 'Internship';
    return 'Full-Time';
  }

  private isStudentFriendly(title: string, employmentType: string | string[] | null, modality: string | null): boolean {
    const t = title.toLowerCase();
    const et = employmentType ? (Array.isArray(employmentType) ? employmentType[0] : employmentType).toLowerCase() : '';
    if (et.includes('part') || et.includes('intern') || et.includes('temp')) return true;
    if (t.includes('part-time') || t.includes('medio tiempo') || t.includes('mediodía')
      || t.includes('flexible') || t.includes('intern') || t.includes('pasant')
      || t.includes('práctica') || t.includes('trainee') || t.includes('weekend')
      || t.includes('fin de semana') || t.includes('nocturno') || t.includes('night')
      || t.includes('estudiante') || t.includes('student') || t.includes('entry level')) return true;
    return false;
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
}
