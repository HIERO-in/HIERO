import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity.js';
import { CreatePropertyDto } from './dto/create-property.dto.js';
import { UpdatePropertyDto } from './dto/update-property.dto.js';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
  ) {}

  create(dto: CreatePropertyDto): Promise<Property> {
    const property = this.propertyRepository.create(dto);
    return this.propertyRepository.save(property);
  }

  async findAll(): Promise<any[]> {
    const properties = await this.propertyRepository.find();
    return properties.map((p) => ({ ...p, platformLinks: p.platformLinks }));
  }

  async findOne(id: number): Promise<any> {
    const property = await this.propertyRepository.findOneBy({ id });
    if (!property) {
      throw new NotFoundException(`Property #${id} not found`);
    }
    return { ...property, platformLinks: property.platformLinks };
  }

  async update(id: number, dto: UpdatePropertyDto): Promise<Property> {
    const property = await this.findOne(id);
    Object.assign(property, dto);
    return this.propertyRepository.save(property);
  }

  async remove(id: number): Promise<void> {
    const prop = await this.propertyRepository.findOneBy({ id });
    if (!prop) throw new NotFoundException(`Property #${id} not found`);
    await this.propertyRepository.remove(prop);
  }
}
