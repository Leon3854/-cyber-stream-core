import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export interface DraftAnalysisResponse {
  winRateA: number;
  winRateB: number;
  analysis: string;
}

@Injectable()
export class ClaudeService implements OnModuleInit {
  private readonly logger = new Logger(ClaudeService.name);
  private anthropic: Anthropic | null = null;

  onModuleInit() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey || apiKey === 'YOUR_CLAUDE_KEY') {
      this.logger.warn('⚠️ ANTHROPIC_API_KEY не задан или содержит дефолтное значение. Claude SDK переведен в режим ДЕМО-ЭМУЛЯЦИИ.');
      return;
    }

    try {
      this.anthropic = new Anthropic({ apiKey });
      this.logger.log('🚀 Anthropic Claude SDK успешно инициализирован на платформе');
    } catch (err) {
      this.logger.error('❌ Ошибка инициализации Anthropic SDK:', err);
    }
  }

  /**
   * @description Анализ драфта героев Dota 2 с помощью Claude AI SDK
   * @param heroesA - Пик команды Team Spirit (например, ["Magnus", "Lina", "Slark"])
   * @param heroesB - Пик соперника (например, ["Puck", "Doom", "Io"])
   */
  async analyzeDraft(heroesA: string[], heroesB: string[]): Promise<DraftAnalysisResponse> {
    this.logger.log(`🤖 Запуск AI-анализа драфта. Team A: [${heroesA.join(', ')}] vs Team B: [${heroesB.join(', ')}]`);

    // СЕНЬОРСКИЙ ХАК-СТРАХОВКА: Если ключа нет, выдаем эталонный демо-ответ для ТЗ, чтобы ничего не ложилось!
    if (!this.anthropic) {
      return this.generateMockAnalysis(heroesA, heroesB);
    }

    try {
      // Стреляем асинхронным запросом в Claude 3.5 Sonnet
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.3, // Низкая температура для строгой аналитики без галлюцинаций
        system: 'Ты — главный аналитик киберспортивной организации Team Spirit по Dota 2. Твоя задача — оценить драфт двух команд, выдать винрейт для каждой стороны и написать краткий, жесткий профессиональный вердикт.',
        messages: [
          {
            role: 'user',
            content: `Проанализируй драфт матча. 
            Команда А (Team Spirit): ${heroesA.join(', ')}. 
            Команда Б (Соперник): ${heroesB.join(', ')}. 
            Выдай ответ СТРОГО в формате JSON: {"winRateA": число, "winRateB": число, "analysis": "текст вердикта"}`
          }
        ]
      });

      // Парсим JSON, прилетевший от Клода
      const rawText = message.content[0].type === 'text' ? message.content[0].text : '';
      return JSON.parse(rawText) as DraftAnalysisResponse;

    } catch (err) {
      this.logger.error('❌ Ошибка при вызове Anthropic Claude API, включаем fallback:', err);
      return this.generateMockAnalysis(heroesA, heroesB);
    }
  }

  /**
   * @description Эмулятор ответов Claude для демонстрации работы без траты токенов
   */
  private generateMockAnalysis(heroesA: string[], heroesB: string[]): DraftAnalysisResponse {
    const containsMagnus = heroesA.some(h => h.toLowerCase().includes('magnus'));
    const winRateA = containsMagnus ? 65 : 52; // Сеньорская киберспортивная пасхалка про Коллапса! 😉
    const winRateB = 100 - winRateA;

    return {
      winRateA,
      winRateB,
      analysis: `[Claude AI Эмуляция]: Драфт Team Spirit выглядит более сбалансированным. ${
        containsMagnus 
          ? 'Пик Magnus открывает ультимативный потенциал для Collapse на сложной линии через RP-комбинации. Высокая синергия в лейт-стадии.' 
          : 'Хороший темп в мид-гейме, однако пик соперника имеет сильный контр-инициации потенциал. Ключевая битва будет за Рошана.'
      }`
    };
  }
}
