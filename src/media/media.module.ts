import { Module } from '@nestjs/common';
import { MongoModule } from '../ai/mongo.module';
import { AvatarsController } from './avatars.controller';
import { MediaController } from './media.controller';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';
import { NoteImagesController } from './note-images.controller';

@Module({
  imports: [MongoModule],
  controllers: [MediaController, AvatarsController, NoteImagesController],
  providers: [MediaService, MediaRepository],
  exports: [MediaService],
})
export class MediaModule {}
