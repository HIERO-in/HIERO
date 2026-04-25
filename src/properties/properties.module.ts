import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Property } from './entities/property.entity.js';
import { PropertyContract } from './entities/property-contract.entity.js';
import { PropertyLandlord } from './entities/property-landlord.entity.js';
import { PropertiesService } from './properties.service.js';
import { PropertiesController } from './properties.controller.js';
import { HostexPropertyService } from './services/hostex-property.service.js';
import { PropertySyncService } from './services/property-sync.service.js';
import { PropertiesExportService } from './services/properties-export.service.js';
import { PropertiesImportService } from './services/properties-import.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Property, PropertyContract, PropertyLandlord]),
    HttpModule,
  ],
  controllers: [PropertiesController],
  providers: [
    PropertiesService,
    HostexPropertyService,
    PropertySyncService,
    PropertiesExportService,
    PropertiesImportService,
  ],
  exports: [PropertiesService],
})
export class PropertiesModule {}