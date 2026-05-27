import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {Redis} from "ioredis";

@Injectable()

/**
 * @description - Сервис для высоконагруженых систем 
 */
export class RedisService implements OnModuleInit, OnModuleDestroy {

	private readonly logger = new Logger(RedisService.name)
	private client: Redis

	/**
	 * @description - Хук жизненного цикла. Гарантирует, что Redis будет готов ДО того, 
	 * как в Service прилетит первый запрос.
	*/
	async onModuleInit() {
		const redisUrl = process.env.REDIS_URL;

		let redisConfig: any;

		if (redisUrl && redisUrl.startsWith('redis://')) {
			redisConfig = {
        path: redisUrl
      };
		} else {
			redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      };
		}

		this.client.on('error', (err) => this.logger.error('Redis Error', err));
    this.client.on('connect', () =>
      this.logger.log('✅ Redis Connected (Highload Optimized)'),
    );
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
			const data = await this.client.get(`stream:${key}`);
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
	 * 
	 * @param key - получаем ключ 
	 * @param ttl - временной лаг
	 * @returns - возвращаем булеан значение либо правда либо ложь
	 * @description - записываем уникальный ключ со сроком "свежости" на 24 часа в EX-секунадах
	 * если NX есть то выдаем null и не записыаем
	 */
	async setIdempotencyKey(key: string, ttl: number=86400):Promise<boolean> {
		const result = await this.client.set(`stream:${key}`, 'loked', 'EX', ttl, 'NX');

		if(result ==='OK') {
			this.logger.log(`Key [${key}] stored. Success.`);
      return true;
		}
		// Если попали сюда — значит, это дубликат!
		this.logger.warn(`Duplicate detected! Key [${key}] already exists.`);
		return false;
	}

	/**
	 * @param - key ключ
	 * @description - Удаление уникального ключа. Можно будет исопльзовать для Saga
	 * при срыве операции на старте
	 */
	async deleteIdempotencyKey(key: string): Promise<void> {
		await this.client.del(`product:${key}`);
		this.logger.log(`Key [${key}] removed (rollback/cleanup).`);
	}

	/**
	 * @description - Мягкое завершение работы
	*/
	async onModuleDestroy() {
		if(this.client) {
			await this.client.quit()
		}
	}
}