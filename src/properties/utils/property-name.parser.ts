/**
 * Hostex 숙소 이름 파싱
 * 예시: "L6_관악빌4c 102_Q1 ss1_TV(ott)"
 *
 * 패턴:
 *   [런칭단계]_[건물명] [호수]_[침대구성]_[어메니티]
 */

export interface ParsedPropertyName {
  launchStage: string | null; // L6
  buildingName: string | null; // 관악빌4c
  roomNumber: string | null; // 102
  nickname: string | null; // "관악빌4c 102"
  queenBeds: number;
  kingBeds: number;
  doubleBeds: number;
  singleBeds: number;
  totalBeds: number;
  amenities: string[];
}

export function parsePropertyName(title: string): ParsedPropertyName {
  const result: ParsedPropertyName = {
    launchStage: null,
    buildingName: null,
    roomNumber: null,
    nickname: null,
    queenBeds: 0,
    kingBeds: 0,
    doubleBeds: 0,
    singleBeds: 0,
    totalBeds: 0,
    amenities: [],
  };

  if (!title) return result;

  // 언더스코어로 섹션 분리
  const sections = title.split('_');

  // 1. 첫 섹션: 런칭 단계 (L1~L9 등)
  if (sections[0]?.match(/^L\d+$/i)) {
    result.launchStage = sections[0].toUpperCase();
  }

  // 2. 두 번째 섹션: 건물명 + 호수 (예: "관악빌4c 102")
  if (sections[1]) {
    const locationMatch = sections[1].trim().match(/^(.+?)\s+(\d+[A-Za-z]?)$/);
    if (locationMatch) {
      result.buildingName = locationMatch[1].trim();
      result.roomNumber = locationMatch[2].trim();
      result.nickname = `${result.buildingName} ${result.roomNumber}`;
    } else {
      result.nickname = sections[1].trim();
    }
  }

  // 3. 세 번째 섹션: 침대 구성 (Q1 ss1 등)
  if (sections[2]) {
    const bedSection = sections[2].trim();

    // 퀸 (Q1, Q2...)
    const queenMatch = bedSection.match(/Q(\d+)/i);
    if (queenMatch) result.queenBeds = parseInt(queenMatch[1]);

    // 킹 (K1, K2...)
    const kingMatch = bedSection.match(/K(\d+)/i);
    if (kingMatch) result.kingBeds = parseInt(kingMatch[1]);

    // 더블 (D1 - 단 Q와 겹치지 않게)
    const doubleMatch = bedSection.match(/(?:^|\s)D(\d+)/i);
    if (doubleMatch) result.doubleBeds = parseInt(doubleMatch[1]);

    // 싱글 (ss1, ss2... 대소문자 무관)
    const singleMatch = bedSection.match(/ss(\d+)/i);
    if (singleMatch) result.singleBeds = parseInt(singleMatch[1]);

    result.totalBeds =
      result.queenBeds +
      result.kingBeds +
      result.doubleBeds +
      result.singleBeds;
  }

  // 4. 네 번째 이후: 어메니티 (TV(ott), WD 등)
  if (sections.length > 3) {
    const amenitySection = sections.slice(3).join('_');
    // 괄호로 묶인 것도 포함, 공백/쉼표로 분리
    const amenities = amenitySection
      .split(/[\s,]+/)
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    result.amenities = amenities;
  }

  return result;
}

// 테스트용 (개발 중 확인)
export function testParser() {
  const tests = [
    'L6_관악빌4c 102_Q1 ss1_TV(ott)',
    'L1_신림타운 301_K1_TV WD',
    'L3_봉천하우스 B1_Q1 D1 ss2_TV(ott) AC',
  ];
  tests.forEach((t) => {
    console.log(`Input:  ${t}`);
    console.log(`Output:`, parsePropertyName(t));
    console.log('---');
  });
}