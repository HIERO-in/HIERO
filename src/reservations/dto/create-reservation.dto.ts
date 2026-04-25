export class CreateReservationDto {
  reservationCode: string;
  stayCode?: string;
  channelId?: string;

  propertyId: number;
  listingId?: string;

  channelType: string;
  customChannelId?: number;
  customChannelName?: string;

  checkInDate: string;
  checkOutDate: string;
  nights?: number;
  bookedAt?: Date;
  cancelledAt?: Date;

  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  numberOfGuests?: number;
  numberOfAdults?: number;
  numberOfChildren?: number;
  numberOfInfants?: number;
  numberOfPets?: number;

  currency?: string;
  totalRate?: number;
  totalCommission?: number;

  status: string;
  stayStatus?: string;

  remarks?: string;
  channelRemarks?: string;
  tags?: string[];
  inReservationBox?: boolean;

  rawData?: any;
}