import {
  Column, CreateDateColumn, Entity, Index,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  reservationCode: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  stayCode: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  channelId: string;

  @Index()
  @Column({ type: 'int' })
  propertyId: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  listingId: string;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  channelType: string;

  @Column({ type: 'int', nullable: true })
  customChannelId: number;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  customChannelName: string;

  @Index()
  @Column({ type: 'date' })
  checkInDate: string;

  @Column({ type: 'date' })
  checkOutDate: string;

  @Column({ type: 'int', default: 0 })
  nights: number;

  @Column({ type: 'datetime', nullable: true })
  bookedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  cancelledAt: Date;

  @Index()
  @Column({ type: 'date', nullable: true })
  revenueDate: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  guestName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  guestPhone: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  guestEmail: string;

  @Column({ type: 'int', default: 1 })
  numberOfGuests: number;

  @Column({ type: 'int', default: 0 })
  numberOfAdults: number;

  @Column({ type: 'int', default: 0 })
  numberOfChildren: number;

  @Column({ type: 'int', default: 0 })
  numberOfInfants: number;

  @Column({ type: 'int', default: 0 })
  numberOfPets: number;

  @Column({ type: 'varchar', length: 10, default: 'KRW' })
  currency: string;

  @Column({ type: 'decimal', precision: 12, scale: 0, default: 0 })
  totalRate: number;

  @Column({ type: 'decimal', precision: 12, scale: 0, default: 0 })
  totalCommission: number;

  @Index()
  @Column({ type: 'varchar', length: 30 })
  status: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  stayStatus: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'text', nullable: true })
  channelRemarks: string;

  @Column({ type: 'json', nullable: true })
  tags: string[];

  @Column({ type: 'boolean', default: false })
  inReservationBox: boolean;

  @Column({ type: 'json', nullable: true })
  rawData: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}