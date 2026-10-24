import { Module } from '@nestjs/common';
import { MongoModule } from '../ai/mongo.module';
import { AvatarsController } from './avatars.controller';
import { MediaController } from './media.controller';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';

@Module({
  imports: [MongoModule],
  controllers: [MediaController, AvatarsController],
  providers: [MediaService, MediaRepository],
})
export class MediaModule {}
