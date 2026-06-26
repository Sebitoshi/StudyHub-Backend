import { Provider } from '@nestjs/common';
import { MongoClient, Collection } from 'mongodb';

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

export const mongoProviders: Provider[] = [
  {
    provide: MONGO_CLIENT,
    useFactory: async () => {
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
      const client = new MongoClient(uri);
      try {
        await client.connect();
      } catch (err) {
        console.warn('MongoDB no disponible, funciones de IA desactivadas:', (err as Error).message);
      }
      return client;
    },
  },
  {
    provide: CONVERSATIONS_COLLECTION,
    useFactory: (client: MongoClient) => {
      try {
        const dbName = process.env.MONGODB_DB || 'studyhub';
        return client.db(dbName).collection('conversations');
      } catch { return null as unknown as Collection; }
    },
    inject: [MONGO_CLIENT],
  },
  {
    provide: KNOWLEDGE_GAPS_COLLECTION,
    useFactory: (client: MongoClient) => {
      try {
        const dbName = process.env.MONGODB_DB || 'studyhub';
        return client.db(dbName).collection('knowledge_gaps');
      } catch { return null as unknown as Collection; }
    },
    inject: [MONGO_CLIENT],
  },
  {
    provide: KNOWLEDGE_VECTORS_COLLECTION,
    useFactory: (client: MongoClient) => {
      try {
        const dbName = process.env.MONGODB_DB || 'studyhub';
        return client.db(dbName).collection('knowledge_vectors');
      } catch { return null as unknown as Collection; }
    },
    inject: [MONGO_CLIENT],
  },
  {
    provide: STUDENT_MODELS_COLLECTION,
    useFactory: (client: MongoClient) => {
      try {
        const dbName = process.env.MONGODB_DB || 'studyhub';
        return client.db(dbName).collection('student_models');
      } catch { return null as unknown as Collection; }
    },
    inject: [MONGO_CLIENT],
  },
  {
    provide: GENERATED_RESOURCES_COLLECTION,
    useFactory: (client: MongoClient) => {
      try {
        const dbName = process.env.MONGODB_DB || 'studyhub';
        return client.db(dbName).collection('generated_resources');
      } catch { return null as unknown as Collection; }
    },
    inject: [MONGO_CLIENT],
  },
  {
    provide: LEARNING_PATHS_COLLECTION,
    useFactory: (client: MongoClient) => {
      try {
        const dbName = process.env.MONGODB_DB || 'studyhub';
        return client.db(dbName).collection('learning_paths');
      } catch { return null as unknown as Collection; }
    },
    inject: [MONGO_CLIENT],
  },
  {
    provide: LEARNING_GOALS_COLLECTION,
    useFactory: (client: MongoClient) => {
      try {
        const dbName = process.env.MONGODB_DB || 'studyhub';
        return client.db(dbName).collection('learning_goals');
      } catch { return null as unknown as Collection; }
    },
    inject: [MONGO_CLIENT],
  },
  {
    provide: ADAPTIVE_SESSIONS_COLLECTION,
    useFactory: (client: MongoClient) => {
      try {
        const dbName = process.env.MONGODB_DB || 'studyhub';
        return client.db(dbName).collection('adaptive_sessions');
      } catch { return null as unknown as Collection; }
    },
    inject: [MONGO_CLIENT],
  },
  {
    provide: MESSAGES_COLLECTION,
    useFactory: (client: MongoClient) => {
      try {
        const dbName = process.env.MONGODB_DB || 'studyhub';
        return client.db(dbName).collection('ai_messages');
      } catch { return null as unknown as Collection; }
    },
    inject: [MONGO_CLIENT],
  },
  {
    provide: MEMORIES_COLLECTION,
    useFactory: (client: MongoClient) => {
      try {
        const dbName = process.env.MONGODB_DB || 'studyhub';
        return client.db(dbName).collection('teacher_memories');
      } catch { return null as unknown as Collection; }
    },
    inject: [MONGO_CLIENT],
  },
  {
    provide: TEACHER_PROFILES_COLLECTION,
    useFactory: (client: MongoClient) => {
      try {
        const dbName = process.env.MONGODB_DB || 'studyhub';
        return client.db(dbName).collection('teacher_profiles');
      } catch { return null as unknown as Collection; }
    },
    inject: [MONGO_CLIENT],
  },
  {
    provide: TEACHER_PROMPT_TEMPLATES_COLLECTION,
    useFactory: (client: MongoClient) => {
      try {
        const dbName = process.env.MONGODB_DB || 'studyhub';
        return client.db(dbName).collection('teacher_prompt_templates');
      } catch { return null as unknown as Collection; }
    },
    inject: [MONGO_CLIENT],
  },
  {
    provide: LEARNING_ANALYTICS_COLLECTION,
    useFactory: (client: MongoClient) => {
      try {
        const dbName = process.env.MONGODB_DB || 'studyhub';
        return client.db(dbName).collection('learning_analytics');
      } catch { return null as unknown as Collection; }
    },
    inject: [MONGO_CLIENT],
  },
];
