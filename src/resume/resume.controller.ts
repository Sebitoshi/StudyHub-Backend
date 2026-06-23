import { Body, Controller, Get, Param, Post, Put, Res, UseGuards, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { ResumeService } from './resume.service';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('resume')
export class ResumeController {
  constructor(private service: ResumeService) {}

  @Get(':userId')
  findByUser(@Param('userId') userId: string) {
    return this.service.findByUser(Number(userId));
  }

  @Post()
  create(@Body() dto: CreateResumeDto) {
    return this.service.create(dto);
  }

  @Put(':userId')
  update(@Param('userId') userId: string, @Body() dto: UpdateResumeDto) {
    return this.service.update(Number(userId), dto);
  }

  @Get(':userId/pdf')
  @UseGuards(AuthGuard('jwt'))
  async pdf(
    @Param('userId') userId: string,
    @CurrentUser() user: { id: number },
    @Res() res: Response,
  ) {
    const resume = await this.service.findByUser(Number(userId));
    if (resume.userId !== user.id) {
      throw new ForbiddenException();
    }

    const buffer = await this.service.generatePdf(Number(userId));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="resume-${userId}.pdf"`);
    res.send(buffer);
  }
}
