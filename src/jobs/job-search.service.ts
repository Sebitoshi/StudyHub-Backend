import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

@Injectable()
export class JobSearchService {
  private readonly logger = new Logger(JobSearchService.name);

  async searchForProfile(userId: number, skills: string[], cargo?: string, ciudad?: string, pais?: string): Promise<SearchResult[]> {
    const keyword = [cargo, ...skills.slice(0, 2), ciudad].filter(Boolean).join(' ');
    if (!keyword) return [];

    const allResults: SearchResult[] = [];
    const seen = new Set<string>();

    const scrapers = [
      () => this.scrapeTalent(keyword, ciudad),
      () => this.scrapeJooble(keyword, ciudad),
      () => this.scrapeJobisJob(keyword, ciudad),
    ];

    for (const scraper of scrapers) {
      try {
        const results = await scraper();
        for (const r of results) {
          if (!seen.has(r.url)) {
            seen.add(r.url);
            allResults.push(r);
          }
        }
      } catch (err) {
        this.logger.warn(`${scraper.name} scrape failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    this.logger.log(`Discovery for "${keyword}": ${allResults.length} unique URLs found`);
    return allResults;
  }

  private async scrapeTalent(keyword: string, location?: string): Promise<SearchResult[]> {
    const loc = location ? `&l=${encodeURIComponent(location)}` : '';
    const url = `https://www.talent.com/jobs?k=${encodeURIComponent(keyword)}${loc}`;

    const html = await this.fetchPage(url);
    if (!html) return [];

    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $('a[href*="/job"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const fullUrl = href.startsWith('http') ? href : `https://www.talent.com${href}`;
      results.push({
        url: fullUrl,
        title: $(el).text().trim() || '',
        snippet: '',
      });
    });

    return results.filter(r => r.title.length > 3);
  }

  private async scrapeJooble(keyword: string, location?: string): Promise<SearchResult[]> {
    const loc = location ? `-${encodeURIComponent(location)}` : '';
    const url = `https://co.jooble.org/trabajo/${encodeURIComponent(keyword)}${loc}`;

    const html = await this.fetchPage(url);
    if (!html) return [];

    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $('a[class*="job"], a[href*="/vacancy"], a[href*="/job"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const fullUrl = href.startsWith('http') ? href : `https://co.jooble.org${href}`;
      results.push({
        url: fullUrl,
        title: $(el).text().trim() || '',
        snippet: '',
      });
    });

    return results.filter(r => r.title.length > 3);
  }

  private async scrapeJobisJob(keyword: string, location?: string): Promise<SearchResult[]> {
    const loc = location ? `-${encodeURIComponent(location)}` : '';
    const url = `https://www.jobisjob.com.mx/empleos/${encodeURIComponent(keyword)}${loc}`;

    const html = await this.fetchPage(url);
    if (!html) return [];

    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $('a[class*="job-title"], a[href*="/empleo"], a[href*="/job"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const fullUrl = href.startsWith('http') ? href : `https://www.jobisjob.com.mx${href}`;
      results.push({
        url: fullUrl,
        title: $(el).text().trim() || '',
        snippet: '',
      });
    });

    return results.filter(r => r.title.length > 3);
  }

  private async fetchPage(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        this.logger.warn(`Fetch failed ${url} HTTP ${res.status}`);
        return null;
      }
      return await res.text();
    } catch (err) {
      this.logger.warn(`Fetch error ${url}: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
}
