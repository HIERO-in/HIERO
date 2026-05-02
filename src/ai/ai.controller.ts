import { Body, Controller, Post } from '@nestjs/common';
import { AiModel, AiService } from './ai.service';

class AnalyzeDto {
  reportType: string;   // dashboard | revenue | health | launches | monthly
  data: any;            // 프론트에서 이미 조회한 raw 데이터
  model?: AiModel;      // gpt (기본) | claude | gemini
}

@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analyze')
  async analyze(@Body() dto: AnalyzeDto) {
    return this.aiService.analyze(
      dto.reportType,
      dto.data,
      dto.model || 'gpt',
    );
  }
}
