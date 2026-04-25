// Hostex API 응답 타입 정의

export interface HostexMoney {
  currency: string;
  amount: number;
}

export interface HostexRateDetail {
  type: string;  // ACCOMMODATION, HOST_SERVICE_FEE 등
  description: string;
  currency: string;
  amount: number;
}

export interface HostexRates {
  total_rate: HostexMoney;
  total_commission: HostexMoney;
  rate: HostexMoney;
  commission: HostexMoney;
  details: HostexRateDetail[];
}

export interface HostexCustomChannel {
  id: number;
  name: string;  // Airbnb, 리브, 삼삼엠투, 자리톡 등
}

export interface HostexReservation {
  reservation_code: string;
  stay_code: string;
  channel_id: string;
  property_id: number;
  listing_id: string;

  channel_type: string;  // airbnb, hostex_direct, booking_com 등
  custom_channel: HostexCustomChannel | null;

  check_in_date: string;  // YYYY-MM-DD
  check_out_date: string;
  booked_at: string | null;  // ISO datetime
  cancelled_at: string | null;
  created_at: string;

  guest_name: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  number_of_guests: number;
  number_of_adults: number;
  number_of_children: number;
  number_of_infants: number;
  number_of_pets: number;

  rates: HostexRates;

  status: string;  // accepted, cancelled 등
  stay_status: string;  // checkin_pending, checked_in, checked_out 등

  remarks: string | null;
  channel_remarks: string | null;
  tags: string[];
  in_reservation_box: boolean;

  conversation_id: string | null;
  creator: string;
  custom_fields: any;
  guests: any[];
}

export interface HostexReservationListResponse {
  request_id: string;
  data: {
    total: number;
    reservations: HostexReservation[];
  };
}