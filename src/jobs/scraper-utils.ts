const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
];

const ACCEPTS = [
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
];

const ACCEPT_LANGS = ['es-ES,es;q=0.9,en;q=0.8', 'es-CO,es;q=0.9,en;q=0.7', 'es-MX,es;q=0.9,en;q=0.8', 'es,en;q=0.9', 'en-US,en;q=0.9,es;q=0.8'];

const REFERERS = [
  'https://www.google.com/',
  'https://www.bing.com/',
  'https://www.google.com.co/',
  'https://co.search.yahoo.com/',
  '',
];

export function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export function randomHeaders(): Record<string, string> {
  return {
    'User-Agent': randomUA(),
    Accept: ACCEPTS[Math.floor(Math.random() * ACCEPTS.length)],
    'Accept-Language': ACCEPT_LANGS[Math.floor(Math.random() * ACCEPT_LANGS.length)],
    'Accept-Encoding': 'gzip, deflate, br',
    Referer: REFERERS[Math.floor(Math.random() * REFERERS.length)],
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
    'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': Math.random() > 0.5 ? '"Windows"' : '"macOS"',
    DNT: '1',
    Connection: 'keep-alive',
  };
}

export function randomDelay(min = 2000, max = 7000): Promise<void> {
  return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1) + min)));
}

export function shortPause(): Promise<void> {
  return randomDelay(800, 2500);
}

export function randomTimeout(min = 12000, max = 25000): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function fetchWithHumanBehavior(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = randomTimeout();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      headers: randomHeaders(),
      signal: controller.signal,
      redirect: 'follow',
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
