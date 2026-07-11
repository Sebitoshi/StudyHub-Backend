import { Module } from '@nestjs/common';
import { mongoProviders, MONGO_CLIENT, COLLECTION_TOKENS } from './mongo.provider';

@Module({
  providers: [...mongoProviders],
  exports: [MONGO_CLIENT, ...COLLECTION_TOKENS],
})
export class MongoModule {}
