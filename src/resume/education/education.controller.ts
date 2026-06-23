import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { EducationService } from './education.service';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('resume/education')
@UseGuards(AuthGuard('jwt'))
export class EducationController {
  constructor(private readonly service: EducationService) {}

  @Post()
  create(@CurrentUser() user: { id: number }, @Body() dto: CreateEducationDto) {
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
  update(@CurrentUser() user: { id: number }, @Param('id') id: string, @Body() dto: UpdateEducationDto) {
    return this.service.update(Number(id), dto, user.id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: number }, @Param('id') id: string) {
    return this.service.remove(Number(id), user.id);
  }
}
