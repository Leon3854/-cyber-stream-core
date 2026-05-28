import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()

/**
 * @description - Сервис для высоконагруженых систем 
 */
export class RedisService implements OnModuleInit, OnModuleDestroy {

	private readonly logger = new Logger(RedisService.name)
	private redisClient: Redis

	/**
	 * @description - Хук жизненного цикла. Гарантирует, что Redis будет готов ДО того, 
	 * как в Service прилетит первый запрос.
	*/
	async onModuleInit() {
		const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
		this.redisClient = new Redis(redisUrl);

		this.redisClient.on('connect', () => {
      this.logger.log('🚀 Redis client successfully connected to highload cache layer');
    });

    this.redisClient.on('error', (err) => {
      this.logger.error('❌ Redis connection critical error:', err);
    });
	}



	/**
	 * 
	 * @param key -получаем ключ со стороны клиента
	 * @returns 
	 * @description - Метод проверяет есть ли уникальный ключ в бд и если есть то 
   * все остальные ключи будут игнорироваться и тем самым не даст повторного выполнения, по
   * путно проверая все получаемые ключи на уникальность и неповторимость
	 */
	async getIdempotencyResult<T=any>(key: string):Promise<T | null> {
		try {
			const data = await this.redisClient.get(`stream:${key}`);
			if(!data) {
				return null;
			}
			return JSON.parse(data) as T;
		} catch (err) {
			this.logger.error(
				`Error fetching idempotency key "${key}":`,
        err.message,
			);
			return null;
		}
	}


	/**
   * @description Атомарный распределенный замок с TTL для укрощения дубликатов пакетов Steam/Букмекеров
   * @param messageId - Уникальный UUID игрового события (kill, tower, odds)
   * @returns Promise<boolean> - true (пакет новый, пропускаем), false (дубликат, жесткий блок)
   */
  async setIdempotencyKey(messageId: string): Promise<boolean> {
    const key = `message:${messageId}`;
    
    // ФИЗИКА ПРОЦЕССА: 
    // 'NX' — запишет ключ только если его ЕЩЕ НЕТ в базе (атомарная проверка)
    // 'EX', 15 — автоматически сотрет ключ через 15 секунд, защищая память от OOM (Out of Memory)
    const result = await this.redisClient.set(key, 'locked', 'EX', 15, 'NX');
    
    // Если результат 'OK' -> замок успешно занят, это первый уникальный запрос
    return result === 'OK';
  }


	/**
	 * @param - key ключ
	 * @description - Удаление уникального ключа. Можно будет исопльзовать для Saga
	 * при срыве операции на старте
	 */
	async deleteIdempotencyKey(messageId: string): Promise<void> {
    const key = `message:${messageId}`;
    await this.redisClient.del(key);
    this.logger.warn(`Idempotency rollback executed for key: ${key}`);
  }

	/**
	 * @description - Мягкое завершение работы
	*/
	onModuleDestroy() {
    if (this.redisClient) {
      this.redisClient.disconnect();
      this.logger.log('Redis client disconnected gracefully');
    }
  }
}