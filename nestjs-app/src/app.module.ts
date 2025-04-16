import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { OrdersModule } from './orders/orders.module';
import { KafkaModule } from './kafka/kafka.module';
import { ElasticsearchModule } from './elasticsearch/elasticsearch.module';
import configuration from './config/configuration';
import { LoggerModule } from './logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT, 10),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      autoLoadEntities: true,
      synchronize: true, // Not recommended for production
    }),
    OrdersModule,
    KafkaModule,
    ElasticsearchModule,
    LoggerModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
