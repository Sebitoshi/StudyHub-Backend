import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ExperienceService } from './experience.service';
import { CreateExperienceDto } from './dto/create-experience.dto';
import { UpdateExperienceDto } from './dto/update-experience.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('resume/experience')
@UseGuards(AuthGuard('jwt'))
export class ExperienceController {
  constructor(private readonly service: ExperienceService) {}

  @Post()
  create(@CurrentUser() user: { id: number }, @Body() dto: CreateExperienceDto) {
    return this.service.create(dto, user.id);
  }

  @Get()
  findAll(@CurrentUser() user: { id: number }, @Query('resumeId') resumeId: string) {
    return this.service.findAllByResume(Number(resumeId), user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: { id: number }, @Param('id') id: string) {
    return this.service.findOne(Number(id), user.id);
  }

  @Put(':id')
  update(@CurrentUser() user: { id: number }, @Param('id') id: string, @Body() dto: UpdateExperienceDto) {
    return this.service.update(Number(id), dto, user.id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: number }, @Param('id') id: string) {
    return this.service.remove(Number(id), user.id);
  }
}
