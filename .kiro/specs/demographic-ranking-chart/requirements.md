# 요구사항 문서

## 소개

CSV 데이터 시각화 앱에 "데모그래픽 사용량 순위" 데이터를 위한 새로운 차트 유형(순위 카드 테이블)을 추가하는 기능이다. 기존 `table` 차트 대신, 연령대별 열에 앱 아이콘과 앱 이름을 카드 형태로 표시하는 전용 `rankingTable` 차트를 제공한다. 보라색 테마를 활용하며, 1200×750 SVG 캔버스 안에 깔끔한 그리드 레이아웃으로 렌더링한다.

## 용어 정의

- **SVG_Renderer**: svgCharts.js에 정의된 SVG 차트 렌더링 객체 (SvgCharts)
- **Parser**: parser.js에 정의된 CSV 파싱 및 데이터 타입 감지 모듈
- **App_Controller**: app.js에 정의된 메인 앱 로직 (buildChart 함수 포함)
- **Theme**: chartTheme.js에 정의된 디자인 토큰 객체 (T)
- **Ranking_Data**: 데모그래픽 사용량 순위 CSV 데이터. 헤더는 ["순위", "10대 이하", "20대", "30대", "40대", "50대", "60대 이상"]이며, 각 행은 순위 번호와 연령대별 앱 이름(텍스트)으로 구성됨
- **Ranking_Card_Cell**: 순위 카드 테이블의 개별 셀. 앱 아이콘(둥근 사각형)과 앱 이름을 포함하는 카드 형태의 UI 요소
- **Icon_Resolver**: SvgCharts._appIcon() 메서드. 앱 이름 또는 패키지명을 받아 로컬 아이콘 URL을 반환하는 유틸리티

## 요구사항

### 요구사항 1: 순위 카드 테이블 차트 유형 등록

**사용자 스토리:** 개발자로서, 새로운 `rankingTable` 차트 유형을 시스템에 등록하여, 데모그래픽 순위 데이터에 전용 시각화를 제공하고 싶다.

#### 인수 조건

1. THE Theme SHALL 'rankingTable' 차트 유형을 T.KINDS 객체에 label, icon, category 속성과 함께 등록한다
2. THE Theme SHALL T.RECOMMENDED 객체의 'demographic_ranking' 항목에 'rankingTable'을 첫 번째 추천 차트로 포함한다

### 요구사항 2: Parser 차트 추천 연동

**사용자 스토리:** 사용자로서, 데모그래픽 사용량 순위 CSV를 업로드하면 자동으로 순위 카드 차트가 추천되어, 별도 설정 없이 적합한 시각화를 볼 수 있게 하고 싶다.

#### 인수 조건

1. WHEN Parser가 'demographic_ranking' 타입을 감지하면, THE Parser SHALL 'rankingTable'을 기본 추천 차트로 반환한다
2. WHEN Parser가 'demographic_ranking' 타입을 감지하면, THE Parser SHALL 추천 차트 목록에 'rankingTable'과 'table'을 모두 포함한다

### 요구사항 3: App Controller 분기 처리

**사용자 스토리:** 사용자로서, 순위 카드 차트가 선택되었을 때 정상적으로 렌더링되어, 빈 카드나 오류 없이 시각화를 확인하고 싶다.

#### 인수 조건

1. WHEN chartKind가 'rankingTable'이면, THE App_Controller SHALL SVG_Renderer의 rankingTable 메서드를 호출하여 차트를 렌더링한다
2. WHEN chartKind가 'rankingTable'이고 숫자 열이 0개이면, THE App_Controller SHALL 빈 카드를 표시하지 않고 정상적으로 렌더링을 진행한다

### 요구사항 4: 순위 카드 테이블 SVG 렌더링

**사용자 스토리:** 사용자로서, 데모그래픽 순위 데이터를 연령대별 앱 아이콘과 이름이 포함된 카드 형태의 테이블로 보고 싶다.

#### 인수 조건

1. THE SVG_Renderer SHALL 1200×750 SVG 캔버스 안에 순위 카드 테이블을 렌더링한다
2. THE SVG_Renderer SHALL 첫 번째 열(순위)을 순위 번호로 표시하고, 나머지 열(연령대)을 카드 셀로 표시한다
3. WHEN Ranking_Data의 행 수가 SVG 캔버스에 모두 표시할 수 없을 만큼 많으면, THE SVG_Renderer SHALL 표시 가능한 최대 행 수까지만 렌더링한다
4. THE SVG_Renderer SHALL 각 열 헤더(순위, 10대 이하, 20대 등)를 테이블 상단에 표시한다
5. THE SVG_Renderer SHALL 행 사이에 구분선을 표시하여 가독성을 확보한다

### 요구사항 5: 순위 카드 셀 디자인

**사용자 스토리:** 사용자로서, 각 셀에 앱 아이콘과 앱 이름이 카드처럼 깔끔하게 표시되어, 한눈에 어떤 앱인지 파악하고 싶다.

#### 인수 조건

1. THE SVG_Renderer SHALL 각 Ranking_Card_Cell에 앱 아이콘(둥근 사각형)과 앱 이름을 나란히 표시한다
2. WHEN Icon_Resolver가 해당 앱의 아이콘 URL을 반환하면, THE SVG_Renderer SHALL 해당 아이콘 이미지를 셀에 표시한다
3. WHEN Icon_Resolver가 빈 문자열을 반환하면(아이콘 미등록), THE SVG_Renderer SHALL 앱 이름의 첫 글자를 보라색 배경의 둥근 사각형 안에 표시하는 폴백 아이콘을 생성한다
4. THE SVG_Renderer SHALL 앱 이름이 셀 너비를 초과하면 텍스트를 잘라서 표시한다

### 요구사항 6: 보라색 테마 적용

**사용자 스토리:** 사용자로서, 순위 카드 차트가 앱의 기존 보라색 테마와 일관된 디자인으로 표시되어, 시각적 통일감을 느끼고 싶다.

#### 인수 조건

1. THE SVG_Renderer SHALL 열 헤더 배경에 보라색 계열 색상(T.accent 또는 T.accentLight 기반)을 사용한다
2. THE SVG_Renderer SHALL 순위 번호 셀에 보라색 계열 강조 색상을 적용한다
3. THE SVG_Renderer SHALL 폴백 아이콘의 배경에 T.accentLight 색상을 사용한다
4. THE SVG_Renderer SHALL 데이터 행에 교대 배경색(흰색/연보라)을 적용하여 가독성을 높인다

### 요구사항 7: 텍스트 전용 데이터 호환성

**사용자 스토리:** 사용자로서, 숫자 열이 없는 텍스트 전용 데이터도 오류 없이 시각화되어, 데모그래픽 순위 같은 비수치 데이터를 안정적으로 볼 수 있게 하고 싶다.

#### 인수 조건

1. WHEN Ranking_Data에 숫자 열이 0개이면, THE App_Controller SHALL 'rankingTable' chartKind에 대해 빈 카드 표시 로직을 건너뛴다
2. WHEN 데이터 셀 값이 빈 문자열이면, THE SVG_Renderer SHALL 해당 셀을 빈 상태로 표시하고 오류를 발생시키지 않는다
