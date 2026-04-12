# Demographic API Pivot Fix - Bugfix Design

## Overview

`apiClient.js`의 `_objectArrayToTable` 함수가 데모그래픽 카테고리(`apps/demographic`, `usage/demographic`, `usage/app/persona`, `usage/app/persona-relative`) 응답에 포함된 `userF`/`userM` 계열 flat 필드를 인식하지 못하고, raw 필드명을 그대로 테이블 헤더로 출력하는 버그를 수정한다. 수정 후에는 CSV 참조 형식과 동일하게 "분류" 열 + 앱 이름 열 구조로 피벗 변환하여 "남성", "여성", "10대 이하", "20대", "30대", "40대", "50대", "60대 이상" 행을 생성한다.

## Glossary

- **Bug_Condition (C)**: API 응답 객체 배열에 `userF`/`userM` 계열 필드가 존재하고, 카테고리가 데모그래픽 관련(`apps/demographic`, `usage/demographic`, `usage/app/persona`, `usage/app/persona-relative`)인 조건
- **Property (P)**: 데모그래픽 flat 필드가 "분류" 행(남성/여성/10대 이하~60대 이상) × 앱 이름 열 형태의 피벗 테이블로 올바르게 변환되는 것
- **Preservation**: 데모그래픽이 아닌 카테고리의 기존 테이블 변환 로직(날짜 피벗, 기본 테이블)이 변경 없이 동작하는 것
- **`_objectArrayToTable`**: `apiClient.js`의 함수로, API JSON 응답의 객체 배열을 `{ headers, data }` 테이블 형식으로 변환
- **`_CATEGORY_TO_TYPE`**: 카테고리 문자열을 Parser 타입(`demo_compare`, `ranking_users` 등)으로 매핑하는 객체
- **데모그래픽 카테고리**: `_CATEGORY_TO_TYPE`에서 `demo_compare` 타입으로 매핑되는 카테고리 중 `userF`/`userM` 필드를 반환하는 엔드포인트

## Bug Details

### Bug Condition

`_objectArrayToTable` 함수가 데모그래픽 카테고리 응답을 받을 때, `userF`/`userM` 계열 flat 필드에 대한 피벗 변환 분기가 없어서 기존 날짜 피벗 또는 기본 테이블 변환 로직으로 처리된다. 데모그래픽 응답에는 `date` 필드가 없으므로 날짜 피벗 조건을 충족하지 못하고, 기본 테이블 변환으로 빠져 raw 필드명(`userF`, `userF10`, `userM20` 등)이 그대로 헤더에 노출된다.

**Formal Specification:**
```
FUNCTION isBugCondition(category, arr)
  INPUT: category of type string, arr of type Array<Object>
  OUTPUT: boolean

  LET DEMO_CATEGORIES = ['apps/demographic', 'usage/demographic',
                          'usage/app/persona', 'usage/app/persona-relative']
  LET hasDemoFields = arr[0] HAS KEYS matching /^user[FM]\d*$/

  RETURN category IN DEMO_CATEGORIES
         AND hasDemoFields
         AND arr.length > 0
END FUNCTION
```

### Examples

- `apps/demographic` + `[{appName: "Netflix", userF: 52.8, userF10: 3.14, ..., userM: 47.2, userM10: 4.44, ...}]`
  → 현재: 헤더 `["앱명", "userF", "userF10", ..., "userM", "userM10", ...]` (raw 필드명 노출)
  → 기대: 헤더 `["분류", "Netflix"]`, 데이터 `[["남성", "47.2"], ["여성", "52.8"], ["10대 이하", "7.58"], ...]`

- `usage/demographic` + 복수 앱 `[{appName: "Netflix", userF: 52.8, ...}, {appName: "TVING", userF: 56.26, ...}]`
  → 현재: 각 필드가 개별 열로 나열됨
  → 기대: 헤더 `["분류", "Netflix", "TVING"]`, 데이터 8행(남성/여성/10대 이하~60대 이상)

- `usage/app/persona` + 단일 앱 `[{appName: "Netflix", userF: 52.8, userF10: 3.14, ...}]`
  → 현재: raw 필드명 헤더
  → 기대: 피벗 변환된 분류 행 × 앱 열 테이블

- `apps/usage` + `[{appName: "Netflix", date: "202501", value: 1000}, ...]` (비-데모그래픽)
  → 현재/기대 동일: 기존 날짜 피벗 또는 기본 테이블 변환 유지

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 비-데모그래픽 카테고리(`apps/usage`, `chart/top/usage`, `usage/trend/traffic` 등)의 `_objectArrayToTable` 동작은 기존과 동일
- 복수 앱 + 날짜 기반 피벗 조건(appName과 date 필드 모두 존재, 앱 2개 이상, 날짜 1개 이상)이 충족되는 비-데모그래픽 카테고리는 기존 날짜 행 × 앱 열 피벗 유지
- 단일 앱 또는 피벗 불가 조건의 비-데모그래픽 카테고리는 기존 기본 테이블 변환(SKIP_KEYS 필터링, LABEL_MAP 적용) 유지
- 빈 배열 또는 데이터 없음 응답 시 기존 동작 유지

**Scope:**
데모그래픽 카테고리가 아닌 모든 요청은 이 수정에 의해 영향받지 않아야 한다. 구체적으로:
- `apps/usage`, `apps/ranking`, `apps/biz-rate` 등 날짜 기반 비교 카테고리
- `chart/top/usage`, `usage/usage-rank` 등 순위 카테고리
- `usage/trend/traffic`, `usage/trend/user` 등 트렌드 카테고리

## Hypothesized Root Cause

`_objectArrayToTable` 함수의 분기 로직에 데모그래픽 카테고리에 대한 처리가 누락되어 있다:

1. **피벗 분기 누락**: 현재 함수는 `hasDate && hasApp` 조건으로 날짜 기반 피벗만 수행한다. 데모그래픽 응답에는 `date` 필드가 없으므로 이 분기를 타지 않고, 바로 기본 테이블 변환으로 빠진다.

2. **데모그래픽 필드 인식 부재**: `userF`, `userF10`, `userM20` 등의 필드를 "남성"/"여성"/"10대 이하" 등으로 매핑하는 로직 자체가 존재하지 않는다. `LABEL_MAP`에도 이 필드들에 대한 매핑이 없다.

3. **연령대 합산 로직 부재**: "10대 이하" = `userF10 + userM10`처럼 남녀 연령대 값을 합산하는 계산 로직이 없다.

4. **카테고리 기반 분기 부재**: `category` 파라미터를 활용하여 데모그래픽 카테고리를 식별하고 별도 처리하는 분기가 없다.

## Correctness Properties

Property 1: Bug Condition - 데모그래픽 피벗 변환

_For any_ 데모그래픽 카테고리(`apps/demographic`, `usage/demographic`, `usage/app/persona`, `usage/app/persona-relative`) 요청에서 API 응답 객체 배열에 `userF`/`userM` 계열 필드가 존재할 때, 수정된 `_objectArrayToTable` 함수는 SHALL 데이터를 피벗하여 첫 번째 열 헤더를 "분류"로, 나머지 열 헤더를 각 앱의 `appName`으로 설정하고, 행은 ["남성", "여성", "10대 이하", "20대", "30대", "40대", "50대", "60대 이상"] 순서로 구성하며, 남성=`userM`, 여성=`userF`, 각 연령대=`userFNN + userMNN` 합산값으로 채운 테이블을 반환한다.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - 비-데모그래픽 카테고리 동작 보존

_For any_ 데모그래픽 카테고리가 아닌 요청(`apps/usage`, `chart/top/usage`, `usage/trend/traffic` 등)에서, 수정된 `_objectArrayToTable` 함수는 SHALL 수정 전과 동일한 결과를 반환하여, 기존 날짜 피벗 변환 및 기본 테이블 변환 동작을 보존한다.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apiClient.js`

**Function**: `_objectArrayToTable(category, arr)`

**Specific Changes**:

1. **데모그래픽 카테고리 목록 정의**: 함수 상단에 데모그래픽 카테고리 배열 상수를 정의한다.
   ```javascript
   const DEMO_CATEGORIES = [
     'apps/demographic', 'usage/demographic',
     'usage/app/persona', 'usage/app/persona-relative'
   ];
   ```

2. **데모그래픽 필드 감지 및 분기 추가**: 기존 날짜 피벗 분기 앞에, `category`가 데모그래픽 카테고리이고 `arr[0]`에 `userF` 필드가 존재하는지 확인하는 분기를 추가한다.

3. **피벗 매핑 정의**: `userM` → "남성", `userF` → "여성", 연령대 합산 매핑을 정의한다.
   ```javascript
   const DEMO_ROWS = [
     { label: '남성',     calc: (o) => o.userM },
     { label: '여성',     calc: (o) => o.userF },
     { label: '10대 이하', calc: (o) => (o.userF10 || 0) + (o.userM10 || 0) },
     { label: '20대',     calc: (o) => (o.userF20 || 0) + (o.userM20 || 0) },
     { label: '30대',     calc: (o) => (o.userF30 || 0) + (o.userM30 || 0) },
     { label: '40대',     calc: (o) => (o.userF40 || 0) + (o.userM40 || 0) },
     { label: '50대',     calc: (o) => (o.userF50 || 0) + (o.userM50 || 0) },
     { label: '60대 이상', calc: (o) => (o.userF60 || 0) + (o.userM60 || 0) },
   ];
   ```

4. **앱 이름 추출 및 피벗 테이블 생성**: `arr`에서 `appName`을 추출하여 열 헤더로, `DEMO_ROWS`를 순회하여 각 행의 값을 계산한다.

5. **반환 형식 통일**: 기존 반환 형식(`{ type, chartKind, meta, headers, data }`)과 동일한 구조로 반환하며, `Parser.recommendChart`와 `Parser._cleanNumericCommas`를 호출한다.

## Testing Strategy

### Validation Approach

테스트 전략은 두 단계로 진행한다: 먼저 수정 전 코드에서 버그를 재현하는 반례를 확인하고, 수정 후 피벗 변환이 올바르게 동작하며 기존 동작이 보존되는지 검증한다.

### Exploratory Bug Condition Checking

**Goal**: 수정 전 코드에서 데모그래픽 응답이 피벗 변환되지 않음을 확인하여 근본 원인 분석을 검증한다.

**Test Plan**: 데모그래픽 카테고리별로 `userF`/`userM` 필드를 포함한 mock 객체 배열을 `_objectArrayToTable`에 전달하고, 반환된 헤더에 raw 필드명이 포함되는지 확인한다.

**Test Cases**:
1. **apps/demographic 단일 앱**: `[{appName: "Netflix", userF: 52.8, userF10: 3.14, ..., userM: 47.2, userM10: 4.44, ...}]` 전달 시 헤더에 `userF`가 포함됨 (수정 전 코드에서 실패)
2. **usage/demographic 복수 앱**: 2개 앱 데이터 전달 시 피벗 변환 없이 raw 필드명 노출 (수정 전 코드에서 실패)
3. **usage/app/persona 단일 앱**: 단일 앱 데이터 전달 시 raw 필드명 노출 (수정 전 코드에서 실패)
4. **연령대 합산 검증**: `userF10 + userM10`이 "10대 이하" 행 값으로 합산되지 않음 (수정 전 코드에서 실패)

**Expected Counterexamples**:
- 반환된 `headers`에 `"userF"`, `"userM10"` 등 raw 필드명이 포함됨
- 원인: `_objectArrayToTable`에 데모그래픽 피벗 분기가 없음

### Fix Checking

**Goal**: 수정 후 모든 데모그래픽 카테고리 입력에 대해 올바른 피벗 테이블이 생성되는지 검증한다.

**Pseudocode:**
```
FOR ALL (category, arr) WHERE isBugCondition(category, arr) DO
  result := _objectArrayToTable_fixed(category, arr)
  ASSERT result.headers[0] === "분류"
  ASSERT result.headers[1..N] === arr.map(o => o.appName)
  ASSERT result.data.length === 8
  ASSERT result.data[0][0] === "남성"
  ASSERT result.data[1][0] === "여성"
  FOR EACH row IN result.data DO
    FOR EACH appIdx DO
      ASSERT row[appIdx+1] === expectedPivotValue(row[0], arr[appIdx])
    END FOR
  END FOR
END FOR
```

### Preservation Checking

**Goal**: 수정 후 비-데모그래픽 카테고리 입력에 대해 수정 전과 동일한 결과가 반환되는지 검증한다.

**Pseudocode:**
```
FOR ALL (category, arr) WHERE NOT isBugCondition(category, arr) DO
  ASSERT _objectArrayToTable_original(category, arr) = _objectArrayToTable_fixed(category, arr)
END FOR
```

**Testing Approach**: Property-based testing을 통해 다양한 비-데모그래픽 카테고리와 데이터 조합에 대해 기존 동작이 보존되는지 자동 검증한다.

**Test Plan**: 수정 전 코드에서 비-데모그래픽 카테고리의 동작을 관찰한 후, 수정 후에도 동일한 결과가 나오는지 property-based test로 검증한다.

**Test Cases**:
1. **날짜 피벗 보존**: `apps/usage` + 복수 앱 + 날짜 데이터 → 기존 날짜 행 × 앱 열 피벗 결과 동일
2. **기본 테이블 보존**: `chart/top/usage` + 순위 데이터 → 기존 SKIP_KEYS 필터링 + LABEL_MAP 적용 결과 동일
3. **빈 배열 보존**: 모든 카테고리 + 빈 배열 → 기존 빈 테이블 반환 동일
4. **단일 앱 비-데모그래픽 보존**: `apps/ranking` + 단일 앱 데이터 → 기존 기본 테이블 결과 동일

### Unit Tests

- 각 데모그래픽 카테고리별 피벗 변환 정확성 테스트
- 연령대 합산 계산 정확성 테스트 (`userF10 + userM10` = "10대 이하" 값)
- 헤더 구조 테스트 (첫 열 "분류", 나머지 앱 이름)
- 행 순서 테스트 (남성, 여성, 10대 이하, 20대, 30대, 40대, 50대, 60대 이상)
- 누락 필드 처리 테스트 (일부 `userFNN`/`userMNN` 필드가 없는 경우 0으로 처리)

### Property-Based Tests

- 랜덤 앱 개수(1~10)와 랜덤 `userF`/`userM` 값으로 데모그래픽 피벗 결과 검증
- 랜덤 비-데모그래픽 카테고리와 데이터로 기존 동작 보존 검증
- 랜덤 데모그래픽 데이터에서 연령대 합산값이 항상 `userFNN + userMNN`과 일치하는지 검증

### Integration Tests

- 전체 `fetchData` → `transformResponse` → `_objectArrayToTable` 흐름에서 데모그래픽 카테고리 피벗 결과 검증
- 피벗 결과가 `Parser.recommendChart`에 의해 올바른 차트 타입(`splitBar`)으로 추천되는지 검증
- 비-데모그래픽 카테고리의 전체 흐름이 수정 전과 동일한지 검증
