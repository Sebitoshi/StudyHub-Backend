import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import toStream = require('buffer-to-stream');

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
      api_key: process.env.CLOUDINARY_API_KEY || '123',
      api_secret: process.env.CLOUDINARY_API_SECRET || 'abc',
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'studyhub_chat',
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { folder },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Cloudinary result is undefined'));
          resolve(result.secure_url);
        },
      );
      toStream(file.buffer).pipe(upload);
    });
  }
}
