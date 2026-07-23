import {
  Controller,
  Post,
  Logger,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResumeAnalyzerService } from './resume-analyzer.service';

@ApiTags('Resume Analyzer')
@ApiBearerAuth()
@Controller('resume-analyzer')
@UseGuards(AuthGuard('jwt'))
export class ResumeAnalyzerController {
  private readonly logger = new Logger(ResumeAnalyzerController.name);

  constructor(private readonly resumeAnalyzerService: ResumeAnalyzerService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Analizar CV desde archivo subido (PDF/DOCX)' })
  @ApiResponse({ status: 201, description: 'CV analizado exitosamente' })
  @ApiResponse({ status: 400, description: 'Archivo no subido o formato inválido' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async analyzeFile(
    @CurrentUser() user: { id: number },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file)
      throw new BadRequestException('Debe subir un archivo PDF o DOCX');
    return this.resumeAnalyzerService.analyzeFile(user.id, file);
  }

  @Post('analyze-profile')
  @ApiOperation({
    summary: 'Analizar CV desde el perfil existente del usuario',
  })
  @ApiResponse({ status: 201, description: 'Perfil analizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Perfil no encontrado' })
  async analyzeProfile(@CurrentUser() user: { id: number }) {
    return this.resumeAnalyzerService.analyzeProfile(user.id);
  }
}
