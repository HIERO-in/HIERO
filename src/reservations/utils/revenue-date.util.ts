export interface RevenueDateInput {
  channelType: string;
  customChannelName?: string;
  checkInDate: string;
  checkOutDate: string;
  bookedAt?: Date;
}

export function calculateRevenueDate(input: RevenueDateInput): string {
  const { channelType, customChannelName, checkInDate, checkOutDate, bookedAt } = input;

  const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const kr = (customChannelName || '').trim();
  if (kr === '리브') return checkInDate;
  if (kr === '삼삼엠투') return addDays(checkInDate, 1);
  if (kr === '자리톡') return addDays(checkInDate, 5);

  const ct = (channelType || '').toLowerCase();
  switch (ct) {
    case 'airbnb':
      return addDays(checkInDate, 1);
    case 'booking_com':
    case 'booking':
      return checkInDate;
    case 'agoda':
      return checkOutDate;
    default:
      return bookedAt ? bookedAt.toISOString().split('T')[0] : checkInDate;
  }
}