import { Logger, Provider } from '@nestjs/common';
import { MongoClient, Collection } from 'mongodb';

const logger = new Logger('MongoProvider');

export const MONGO_CLIENT = 'MONGO_CLIENT';
export const CONVERSATIONS_COLLECTION = 'CONVERSATIONS_COLLECTION';
export const MESSAGES_COLLECTION = 'MESSAGES_COLLECTION';
export const MEMORIES_COLLECTION = 'MEMORIES_COLLECTION';
export const TEACHER_PROFILES_COLLECTION = 'TEACHER_PROFILES_COLLECTION';
export const TEACHER_PROMPT_TEMPLATES_COLLECTION = 'TEACHER_PROMPT_TEMPLATES_COLLECTION';
export const LEARNING_ANALYTICS_COLLECTION = 'LEARNING_ANALYTICS_COLLECTION';
export const KNOWLEDGE_GAPS_COLLECTION = 'KNOWLEDGE_GAPS_COLLECTION';
export const KNOWLEDGE_VECTORS_COLLECTION = 'KNOWLEDGE_VECTORS_COLLECTION';
export const STUDENT_MODELS_COLLECTION = 'STUDENT_MODELS_COLLECTION';
export const GENERATED_RESOURCES_COLLECTION = 'GENERATED_RESOURCES_COLLECTION';
export const LEARNING_PATHS_COLLECTION = 'LEARNING_PATHS_COLLECTION';
export const ADAPTIVE_SESSIONS_COLLECTION = 'ADAPTIVE_SESSIONS_COLLECTION';
export const LEARNING_GOALS_COLLECTION = 'LEARNING_GOALS_COLLECTION';

export const COLLECTION_TOKENS = [
  CONVERSATIONS_COLLECTION,
  MESSAGES_COLLECTION,
  MEMORIES_COLLECTION,
  TEACHER_PROFILES_COLLECTION,
  TEACHER_PROMPT_TEMPLATES_COLLECTION,
  LEARNING_ANALYTICS_COLLECTION,
  KNOWLEDGE_GAPS_COLLECTION,
  KNOWLEDGE_VECTORS_COLLECTION,
  STUDENT_MODELS_COLLECTION,
  GENERATED_RESOURCES_COLLECTION,
  LEARNING_PATHS_COLLECTION,
  ADAPTIVE_SESSIONS_COLLECTION,
  LEARNING_GOALS_COLLECTION,
] as const;

const COLLECTION_NAMES: Record<string, string> = {
  [CONVERSATIONS_COLLECTION]: 'conversations',
  [MESSAGES_COLLECTION]: 'ai_messages',
  [MEMORIES_COLLECTION]: 'teacher_memories',
  [TEACHER_PROFILES_COLLECTION]: 'teacher_profiles',
  [TEACHER_PROMPT_TEMPLATES_COLLECTION]: 'teacher_prompt_templates',
  [LEARNING_ANALYTICS_COLLECTION]: 'learning_analytics',
  [KNOWLEDGE_GAPS_COLLECTION]: 'knowledge_gaps',
  [KNOWLEDGE_VECTORS_COLLECTION]: 'knowledge_vectors',
  [STUDENT_MODELS_COLLECTION]: 'student_models',
  [GENERATED_RESOURCES_COLLECTION]: 'generated_resources',
  [LEARNING_PATHS_COLLECTION]: 'learning_paths',
  [ADAPTIVE_SESSIONS_COLLECTION]: 'adaptive_sessions',
  [LEARNING_GOALS_COLLECTION]: 'learning_goals',
};

let clientInstance: MongoClient | null = null;
let dbName = 'studyhub';
let reconnectPromise: Promise<MongoClient> | null = null;

async function getClient(): Promise<MongoClient> {
  if (clientInstance) {
    try {
      await clientInstance.db('admin').command({ ping: 1 });
      return clientInstance;
    } catch {
      logger.warn('MongoDB connection lost, reconnecting...');
      const staleClient = clientInstance;
      clientInstance = null;
      // Only attempt to close if the topology is not already closed/destroyed
      try {
        const topology = (staleClient as any).topology;
        if (topology && !topology.isDestroyed() && topology.s?.state !== 'closed') {
          await staleClient.close(true);
        }
      } catch {
        // Ignore close errors — the client is already unusable
      }
    }
  }

  if (reconnectPromise) {
    return reconnectPromise;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  dbName = process.env.MONGODB_DB || 'studyhub';

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 20,
    minPoolSize: 2,
    retryReads: true,
    retryWrites: true,
    heartbeatFrequencyMS: 10000,
    tlsInsecure: true,
  });

  client.on('topologyClosed', () => {
    logger.warn('MongoDB topology closed, will reconnect on next request');
    clientInstance = null;
  });

  client.on('serverHeartbeatFailed', (event) => {
    logger.warn(`MongoDB heartbeat failed: ${event.failure?.message || 'unknown'}`);
  });

  reconnectPromise = (async () => {
    try {
      await client.connect();
      logger.log('MongoDB connected');
      clientInstance = client;
    } catch (err) {
      logger.warn('MongoDB not available, AI features disabled: ' + (err as Error).message);
      clientInstance = client;
    }
    return client;
  })();

  try {
    return await reconnectPromise;
  } finally {
    reconnectPromise = null;
  }
}

function createCursorChain(initialPromise: Promise<any>): any {
  let chainP = initialPromise;
  const handler = {
    get(_target: any, prop: string | symbol) {
      if (prop === 'then') return chainP.then.bind(chainP);
      if (prop === 'catch') return chainP.catch.bind(chainP);
      if (prop === 'finally') return chainP.finally.bind(chainP);
      return (...args: any[]) => {
        chainP = chainP.then((cursor: any) => {
          if (cursor && typeof cursor[prop] === 'function') {
            return cursor[prop](...args);
          }
          throw new TypeError(`cursor.${String(prop)} is not a function`);
        });
        return proxy;
      };
    },
  };
  const proxy = new Proxy({}, handler);
  return proxy;
}

function createCollectionProxy(name: string): Collection {
  return new Proxy({} as Collection, {
    get(_, prop: string | symbol) {
      if (prop === 'then' || prop === 'constructor' || prop === Symbol.toPrimitive) return undefined;
      return (...args: any[]) => {
        const chainP = getClient().then(client => {
          const col = client.db(dbName).collection(name);
          const fn = (col as any)[prop];
          if (typeof fn !== 'function') return fn;
          return fn.apply(col, args);
        });
        return createCursorChain(chainP);
      };
    },
  });
}

function createDbProxy(name?: string): any {
  return new Proxy({} as any, {
    get(_, prop: string | symbol) {
      if (prop === 'then' || prop === 'constructor' || prop === Symbol.toPrimitive) return undefined;
      if (prop === 'collection') {
        return (colName: string) => createCollectionProxy(colName);
      }
      return (...args: any[]) => getClient().then(client => {
        const db = client.db(name);
        const val = (db as any)[prop];
        if (typeof val !== 'function') return val;
        return val.apply(db, args);
      });
    },
  });
}

function createClientProxy(): MongoClient {
  return new Proxy({} as MongoClient, {
    get(_, prop: string | symbol) {
      if (prop === 'then' || prop === 'constructor' || prop === Symbol.toPrimitive) return undefined;
      if (prop === 'db') {
        return (name?: string) => createDbProxy(name);
      }
      return (...args: any[]) => getClient().then(client => {
        const val = (client as any)[prop];
        if (typeof val !== 'function') return val;
        return val.apply(client, args);
      });
    },
  });
}

const collectionProxyCache = new Map<string, Collection>();

export function createMongoClientProvider(): Provider {
  return {
    provide: MONGO_CLIENT,
    useFactory: () => createClientProxy(),
  };
}

export function createCollectionProvider(token: string): Provider {
  return {
    provide: token,
    useFactory: () => {
      if (!collectionProxyCache.has(token)) {
        collectionProxyCache.set(token, createCollectionProxy(COLLECTION_NAMES[token]));
      }
      return collectionProxyCache.get(token)!;
    },
  };
}

export const mongoProviders: Provider[] = [
  createMongoClientProvider(),
  ...COLLECTION_TOKENS.map(token => createCollectionProvider(token)),
];
