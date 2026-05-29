import { Module } from "@nestjs/common";
import { RabbitmqService } from "./rabbitmq.service";
import { ConfigModule } from "@nestjs/config";


@Module({
	imports: [ConfigModule],
	exports: [RabbitmqService],
	providers: [RabbitmqService]
	
})
export class RabbitMQModule{};