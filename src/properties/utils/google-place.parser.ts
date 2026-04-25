/**
 * Hostex의 google_place_payload에서 주소 컴포넌트 추출
 */

export interface ParsedGooglePlace {
  city: string | null;
  district: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  formattedAddress: string | null;
}

export function parseGooglePlace(payload: any): ParsedGooglePlace {
  const result: ParsedGooglePlace = {
    city: null,
    district: null,
    neighborhood: null,
    postalCode: null,
    formattedAddress: null,
  };

  // payload가 문자열인 경우 JSON 파싱
  let data = payload;
  if (typeof payload === 'string') {
    try {
      data = JSON.parse(payload);
    } catch {
      return result;
    }
  }

  if (!data || typeof data !== 'object') return result;

  result.formattedAddress = data.formatted_address || null;

  const components = data.address_components || [];
  for (const comp of components) {
    const types: string[] = comp.types || [];
    const longName = comp.long_name || '';

    // 시 (Seoul)
    if (types.includes('administrative_area_level_1')) {
      result.city = longName;
    }
    // 구 (Gwanak-gu)
    else if (types.includes('sublocality_level_1')) {
      result.district = longName;
    }
    // 동 (Sillim-ro 31ga-gil)
    else if (types.includes('sublocality_level_4')) {
      result.neighborhood = longName;
    }
    // 우편번호
    else if (types.includes('postal_code')) {
      result.postalCode = longName;
    }
  }

  return result;
}