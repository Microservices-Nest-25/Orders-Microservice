import { OrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, isUUID } from 'class-validator';

export class ChangeOrderStatusDto {

    @IsUUID(4)
    id: string;    

    @IsOptional()
    @IsEnum( OrderStatus, {message: `Valid status are: ${ OrderStatus }`} )
    status: OrderStatus;

}