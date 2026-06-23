import { Injectable } from '@nestjs/common';

@Injectable()
export class RecommendationService {
  recommendResources(topic: string) {
    return [{ type: 'video', title: `Intro a ${topic}`, url: '' }, { type: 'article', title: `Guía sobre ${topic}`, url: '' }];
  }
}
