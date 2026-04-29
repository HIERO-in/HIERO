
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PropertiesModule } from './properties/properties.module.js';
import { LaunchesModule } from './launches/launches.module.js';
import { CostsModule } from './costs/costs.module.js';
import { ReservationsModule } from './reservations/reservations.module';
import { MonthlyReportsModule } from './monthly-reports/monthly-reports.module.js';
import { HealthModule } from './health/health.module';
import { TransactionsModule } from './transactions/transactions.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReservationNotesModule } from './reservation-notes/reservation-notes.module';
@Module({
  imports: [

    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    PropertiesModule,
    LaunchesModule,
    CostsModule,
    ReservationsModule,
    MonthlyReportsModule,
    HealthModule,
    TransactionsModule,
    DashboardModule,
    ReservationNotesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
