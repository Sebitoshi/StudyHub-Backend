import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobSearchService } from './job-search.service';
import { JobCrawlerService } from './job-crawler.service';

@Injectable()
export class JobDiscoveryService {
  private readonly logger = new Logger(JobDiscoveryService.name);
  private cooldowns = new Map<number, number>();

  constructor(
    private prisma: PrismaService,
    private jobSearch: JobSearchService,
    private jobCrawler: JobCrawlerService,
  ) {}

  async discoverFromProfile(userId: number, force = false): Promise<{ found: number; saved: number; cooldown?: number }> {
    const lastRun = this.cooldowns.get(userId);
    const now = Date.now();
    const cooldownMs = 3600000; // 1 hora

    if (!force && lastRun && (now - lastRun) < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - (now - lastRun)) / 60000);
      throw new ForbiddenException(`Espera ${remaining} min antes de la próxima búsqueda`);
    }
    this.cooldowns.set(userId, now);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        skills: { include: { skill: true } },
        objectives: { include: { objective: true }, take: 1 },
        professionalProfile: true,
      },
    });

    if (!user) return { found: 0, saved: 0 };

    const skills = user.skills.map(s => s.skill.nombre);
    const cargo = user.objectives[0]?.objective.nombre || user.professionalProfile?.cargoDeseado || undefined;
    const ciudad = user.ciudad || undefined;
    const pais = user.pais || undefined;

    if (skills.length === 0 && !cargo && !ciudad) {
      this.logger.warn(`User ${userId} has no skills, cargo, or location — skipping discovery`);
      return { found: 0, saved: 0 };
    }

    this.logger.log(`Discovering jobs for user ${userId}: skills=${skills.join(',')}, cargo=${cargo}, ciudad=${ciudad}, pais=${pais}`);

    const searchResults = await this.jobSearch.searchForProfile(userId, skills, cargo, ciudad, pais);

    if (searchResults.length === 0) {
      this.logger.log(`No search results found for user ${userId}`);
      return { found: 0, saved: 0 };
    }

    let saved = 0;
    for (const result of searchResults) {
      try {
        const existing = await this.prisma.job.findFirst({
          where: { sourceUrl: result.url },
        });
        if (existing) continue;

        const crawled = await this.jobCrawler.crawl(result.url);
        if (!crawled) continue;

        const country = crawled.country || this.inferCountry(result.snippet + ' ' + crawled.location);
        const city = crawled.city;

        await this.prisma.job.create({
          data: {
            title: crawled.title,
            company: crawled.company,
            description: crawled.description.slice(0, 5000),
            location: crawled.location,
            country,
            city,
            modality: crawled.modality,
            seniority: crawled.seniority,
            contractType: crawled.contractType,
            salaryMin: crawled.salaryMin,
            salaryMax: crawled.salaryMax,
            isRemote: crawled.isRemote,
            studentFriendly: crawled.studentFriendly,
            requirements: crawled.requirements,
            skills: crawled.skills,
            source: 'discovery',
            sourceUrl: result.url,
            publishedAt: new Date(crawled.publishedAt),
            discoveredByUserId: userId,
          },
        });

        saved++;
      } catch (err) {
        this.logger.warn(`Failed to save ${result.url}: ${err instanceof Error ? err.message : err}`);
      }
    }

    this.logger.log(`Discovery for user ${userId}: ${searchResults.length} found, ${saved} new jobs saved`);
    return { found: searchResults.length, saved };
  }

  private inferCountry(text: string): string | null {
    if (!text) return null;
    const lower = text.toLowerCase();
    const countries: Record<string, string[]> = {
      'Colombia': ['colombia', 'col'],
      'México': ['méxico', 'mexico', 'mx'],
      'Argentina': ['argentina', 'arg'],
      'Perú': ['perú', 'peru', 'pe'],
      'Chile': ['chile', 'cl'],
      'España': ['españa', 'spain', 'es'],
      'Ecuador': ['ecuador', 'ec'],
      'Venezuela': ['venezuela', 've'],
      'Estados Unidos': ['estados unidos', 'united states', 'usa', 'ee.uu.', 'eeuu'],
      'Brasil': ['brasil', 'brazil', 'br'],
    };
    for (const [name, keywords] of Object.entries(countries)) {
      if (keywords.some(k => lower.includes(k))) return name;
    }
    return null;
  }
}
