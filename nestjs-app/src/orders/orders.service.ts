import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './orders.entity';
import { Repository } from 'typeorm';
import { KafkaService } from '../kafka/kafka.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { OrderDocument } from '../elasticsearch/interfaces/order-document.interface';
import { OrdersRepository } from './repositories/orders.repository';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly kafkaService: KafkaService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const order = this.ordersRepository.create(createOrderDto);
    const savedOrder = await this.ordersRepository.save(order);
    this.kafkaService.emit('order_created', { orderId: savedOrder.id, ...savedOrder });
    await this.elasticsearchService.index<OrderDocument>('orders', {
      id: savedOrder.id.toString(),
      ...savedOrder,
    });
    return savedOrder;
  }

  async findAll(): Promise<Order[]> {
    return this.ordersRepository.find();
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" not found`);
    }
    return order;
  }

  async update(id: string, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    this.ordersRepository.merge(order, updateOrderDto);
    const updatedOrder = await this.ordersRepository.save(order);
    this.kafkaService.emit('order_status_updated', {
      orderId: updatedOrder.id,
      status: updatedOrder.status,
    });
    await this.elasticsearchService.index<OrderDocument>('orders', {
      id: updatedOrder.id.toString(),
      ...updatedOrder,
    });
    return updatedOrder;
  }

  async remove(id: string): Promise<void> {
    const order = await this.findOne(id);
    await this.ordersRepository.remove(order);
    await this.elasticsearchService.delete('orders', id.toString());
  }

  async search(query: any): Promise<Order[]> {
    return this.elasticsearchService.search<OrderDocument>('orders', {
      query: {
        bool: {
          must: Object.keys(query).map((key) => {
            if (key === 'id') {
              return { term: { _id: query[key] } };
            } else if (key === 'status') {
              return { term: { status: query[key] } };
            } else if (key === 'startDate' && query.endDate) {
              return {
                range: {
                  createdAt: {
                    gte: query.startDate,
                    lte: query.endDate,
                  },
                },
              };
            } else if (key === 'item') {
              return { nested: { path: 'items', query: { match: {
