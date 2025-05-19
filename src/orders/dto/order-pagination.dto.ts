import { OrderStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsOptional, IsPositive } from "class-validator";

export class OrderPaginationDto {

  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsEnum( OrderStatus, { message: `Valid status are ${ OrderStatus }` })
  status: OrderStatus;

}