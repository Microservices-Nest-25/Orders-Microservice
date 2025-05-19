import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto } from './dto';
import { PRODUCT_SERVICE } from 'src/config/services';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  
  private readonly logger = new Logger( OrdersService.name );
  
  constructor(
    @Inject(PRODUCT_SERVICE) private readonly productsClient: ClientProxy
  ) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log( 'Prisma Client connected to the database' );
  }

  async create(createOrderDto: CreateOrderDto) {
    try {
      const productsIds = createOrderDto.items.map( item => item.productId );

      const products = await firstValueFrom(
        this.productsClient.send(
          { cmd: 'validate_products' },
          productsIds
        )
      );

      const totalAmount = createOrderDto.items.reduce((acc, orderItem) => {
        const price = products.find( product => product.id === orderItem.productId ).price;
        return acc + price * orderItem.quantity;
      }, 0)

      const totalItems = createOrderDto.items.reduce((acc, orderItem) => {
        return acc + orderItem.quantity;
      }, 0);

      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItems: {
            createMany: {
              data: createOrderDto.items.map( orderItem => ({
                ...orderItem,
                price: products.find( product => product.id === orderItem.productId ).price,
              }))
            }
          }
        },
        include: {
          OrderItems: {
            select: {
              price: true,
              quantity: true,
              productId: true,
            }
          }
        }
      }
    );

      return {
        ...order,
        OrderItems: order.OrderItems.map( orderItem => ({
          ...orderItem,
          name: products.find( product => product.id === orderItem.productId ).name,
        }))
      };

    } catch (error) {
      throw new RpcException({
        message: 'Error validating products, please check logs', 
        status: HttpStatus.BAD_REQUEST
      });
    } 
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const { page, limit, status } = orderPaginationDto;

    const totalOrders = await this.order.count({
      where: { status }
    });

    return {
      data: await this.order.findMany({
        skip: (page! - 1) * limit!,
        take: limit!,
        where: { status },
      }),
      meta: {
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalOrders / limit!),
        totalItems: totalOrders,
      }
    }
  }

  async findOne(id: string) {
    const order = await this.order.findFirst({
      where: { id },
      include: {
        OrderItems: {
          select: {
            price: true,
            quantity: true,
            productId: true,
          }
        }
      }
    });

    if (!order) {
      throw new RpcException({
        message: `Order with id ${ id } not found`,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const productIds = order.OrderItems.map( orderItem => orderItem.productId );

    const products = await firstValueFrom(
      this.productsClient.send(
        { cmd: 'validate_products' },
        productIds
      )
    );

    return {
      ...order,
      OrderItems: order.OrderItems.map( orderItem => ({
        ...orderItem,
        name: products.find( product => product.id === orderItem.productId ).name,
      }))
    };
  }

  async changeStatus( changeOrderStatusDto: ChangeOrderStatusDto ) {
    const { id, status } = changeOrderStatusDto;

    const order = await this.findOne(id);

    if (order.status === status) return order;

    return this.order.update({
      where: { id },
      data: { status }
    });
  }

}
