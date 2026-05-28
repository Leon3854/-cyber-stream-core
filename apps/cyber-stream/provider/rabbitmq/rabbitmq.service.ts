import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  
  private connection: amqp.AmqpConnectionManager;
  private channel: amqp.ChannelWrapper;

  private readonly exchangeName = 'cyber_stream_exchange';
  private readonly queueName = 'live_events_queue';
  private readonly dlxExchange = 'dead_letter_exchange';
  private readonly dlxQueue = 'dlx_events_queue';

  async onModuleInit() {
    try {
      const amqpUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5673';
      
      // Инициализируем менеджер подключений
      this.connection = amqp.connect([amqpUrl]);
      
      this.connection.on('connect', () => this.logger.log('🚀 Connected to RabbitMQ cluster successfully!'));
      this.connection.on('disconnect', (err) => this.logger.error('❌ RabbitMQ disconnected:', err.err));

      // ФИКС: Очереди настраиваются через механизм setup!
      // Это гарантирует, что при падении Кролика, обертка сама пересоздаст всю топологию при реконнекте!
      this.channel = this.connection.createChannel({
        json: true,
        setup: async (channel: ConfirmChannel) => {
          // 1. Создаем инфраструктуру Отстойника Ядовитых Сообщений (DLX)
          await channel.assertExchange(this.dlxExchange, 'direct', { durable: true });
          await channel.assertQueue(this.dlxQueue, { durable: true });
          await channel.bindQueue(this.dlxQueue, this.dlxExchange, 'dead_letter_routing_key');

          // 2. Создаем Основную Очередь с привязкой к DLX
          await channel.assertExchange(this.exchangeName, 'direct', { durable: true });
          await channel.assertQueue(this.queueName, {
            durable: true,
            arguments: {
              'x-dead-letter-exchange': this.dlxExchange,
              'x-dead-letter-routing-key': 'dead_letter_routing_key',
            },
          });
          await channel.bindQueue(this.queueName, this.exchangeName, 'live_event_key');
          
          this.logger.log('RabbitMQ topology (Exchanges, Queues, DLX) successfully declared in channel wrapper');
        }
      });

    } catch (err) {
      this.logger.error('❌ RabbitMQ connection critical failure:', err);
    }
  }

  /**
   * @description Гарантированная отправка live-события матча в буфер
   */
  async sendGameEvent(eventPayload: any): Promise<boolean> {
    try {
      // ChannelWrapper имеет встроенный метод sendToQueue или publish, возвращающий Promise
      await this.channel.publish(
        this.exchangeName,
        'live_event_key',
        eventPayload, // amqp-connection-manager сам переведет объект в буфер, так как включен флаг { json: true }!
        { persistent: true } // Заставляем Кролика писать пакет на жесткий диск
      );
      return true;
    } catch (err) {
      this.logger.error('❌ Failed to publish live event to RabbitMQ pipeline:', err);
      return false;
    }
  }

  async onModuleDestroy() {
    // В amqp-connection-manager закрытие канала происходит через закрытие соединения
    if (this.connection) {
      await this.connection.close();
      this.logger.log('RabbitMQ connection manager closed gracefully');
    }
  }
}
