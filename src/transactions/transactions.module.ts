import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HostexTransaction } from './entities/hostex-transaction.entity';
import { UploadLog } from './entities/upload-log.entity';
import { TransactionsService } from './services/transactions.service';
import { TransactionParserService } from './services/transaction-parser.service';
import { TransactionsController } from './transactions.controller';
import { PropertiesModule } from '../properties/properties.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([HostexTransaction, UploadLog]),
    PropertiesModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionParserService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
