import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export type AiModel = 'gpt' | 'claude' | 'gemini';

const SYSTEM_PROMPTS: Record<string, string> = {
  dashboard:
    '당신은 숙박업 운영 어시스턴트입니다. 대시보드 데이터를 바탕으로 오늘의 운영 현황을 브리핑해주세요. 핵심 수치를 강조하고 주의할 점이 있으면 알려주세요.',
  revenue:
    '당신은 숙박업 재무 분석가입니다. 거래 통계 데이터를 분석해서 수익 현황, 주요 비용 항목, 개선 포인트를 설명해주세요.',
  health:
    '당신은 숙박업 포트폴리오 진단 전문가입니다. 건강도 데이터를 바탕으로 전체 포트폴리오 상태를 진단하고, RISK/CRITICAL 등급 숙소에 대한 조치를 제안해주세요.',
  launches:
    '당신은 숙박업 런칭 매니저입니다. 파이프라인 데이터를 바탕으로 각 단계별 진행 상황을 요약하고, 병목이나 주의할 점을 짚어주세요.',
  monthly:
    '당신은 숙박업 재무 분석가입니다. 월간 리포트 데이터를 분석해서 월별 추이, 성장률, 주목할 변화를 설명해주세요.',
};

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor(private config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY'),
    });
  }

  async analyze(
    reportType: string,
    data: any,
    model: AiModel = 'gpt',
  ): Promise<{ analysis: string; model: string }> {
    const systemPrompt = SYSTEM_PROMPTS[reportType] || SYSTEM_PROMPTS.dashboard;
    const dataStr = JSON.stringify(data, null, 2).slice(0, 12000);

    const fullSystem = `${systemPrompt}\n\n## 데이터\n\`\`\`json\n${dataStr}\n\`\`\``;
    const userMsg = '위 데이터를 한국어로 분석해서 핵심 인사이트 3-5개를 알려주세요.';

    if (model === 'gpt') {
      return this.callGPT(fullSystem, userMsg);
    }

    // Claude/Gemini 크레딧 부족 시 GPT 폴백
    return this.callGPT(fullSystem, userMsg);
  }

  private async callGPT(
    system: string,
    user: string,
  ): Promise<{ analysis: string; model: string }> {
    const res = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return {
      analysis: res.choices[0].message.content ?? '',
      model: 'gpt',
    };
  }
}
