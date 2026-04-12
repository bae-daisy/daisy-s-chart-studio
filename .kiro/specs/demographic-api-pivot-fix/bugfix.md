# Bugfix Requirements Document

## Introduction

데모그래픽 비교 분석 API(`apps/demographic`, `usage/demographic`, `usage/app/persona`, `usage/app/persona-relative`) 호출 시, API 응답의 flat 필드(userF, userF10, userF20, ..., userM, userM10, userM20, ...)가 CSV 참조 형식처럼 "남성"/"여성"/"10대 이하"/"20대"/... 행으로 피벗 변환되지 않고, raw 필드명이 그대로 테이블 헤더에 노출되는 버그. 이로 인해 데이터 시각화 및 차트 생성 시 사용자가 의미를 파악할 수 없는 테이블이 출력됨.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `apps/demographic` 카테고리로 복수 앱 비교 요청 시 API가 각 앱별로 `{ appName, userF, userF10, userF20, userF30, userF40, userF50, userF60, userM, userM10, userM20, userM30, userM40, userM50, userM60 }` 형태의 flat 객체 배열을 반환하면 THEN `_objectArrayToTable` 함수가 raw 필드명(userF, userF10, userM 등)을 그대로 테이블 헤더로 사용하여 의미 없는 열 이름이 표시됨

1.2 WHEN `usage/demographic` 카테고리로 요청 시 API가 동일한 flat 데모그래픽 필드를 포함한 객체 배열을 반환하면 THEN `_objectArrayToTable` 함수가 피벗 변환 없이 각 필드를 개별 열로 나열하여 CSV 참조 형식(분류 행: 남성/여성/10대 이하/20대/30대/40대/50대/60대 이상, 앱 이름 열)과 다른 구조의 테이블이 생성됨

1.3 WHEN `usage/app/persona` 또는 `usage/app/persona-relative` 카테고리로 요청 시 API가 동일한 userF/userM 계열 flat 필드를 포함한 객체를 반환하면 THEN `_objectArrayToTable` 함수가 피벗 변환 없이 raw 필드명을 헤더로 사용하여 데모그래픽 데이터가 올바르게 표현되지 않음

### Expected Behavior (Correct)

2.1 WHEN `apps/demographic` 카테고리로 복수 앱 비교 요청 시 API가 userF/userM 계열 flat 필드를 포함한 객체 배열을 반환하면 THEN `_objectArrayToTable` 함수는 데이터를 피벗하여 행은 데모그래픽 분류("남성", "여성", "10대 이하", "20대", "30대", "40대", "50대", "60대 이상")로, 열은 앱 이름으로 구성된 테이블을 생성하여야 함 (SHALL)

2.2 WHEN `usage/demographic` 카테고리로 요청 시 API가 동일한 flat 데모그래픽 필드를 포함한 객체 배열을 반환하면 THEN `_objectArrayToTable` 함수는 동일한 피벗 변환을 적용하여 분류 행 × 앱 열 형태의 테이블을 생성하여야 함 (SHALL)

2.3 WHEN `usage/app/persona` 또는 `usage/app/persona-relative` 카테고리로 요청 시 API가 userF/userM 계열 flat 필드를 포함한 객체를 반환하면 THEN `_objectArrayToTable` 함수는 동일한 피벗 변환을 적용하여 데모그래픽 분류 행 × 앱 열 형태의 테이블을 생성하여야 함 (SHALL)

2.4 WHEN 피벗 변환 시 userF/userM 필드를 매핑할 때 THEN 다음 매핑 규칙을 적용하여야 함 (SHALL): userM → "남성", userF → "여성", userF10/userM10 → "10대 이하" (합산), userF20/userM20 → "20대" (합산), userF30/userM30 → "30대" (합산), userF40/userM40 → "40대" (합산), userF50/userM50 → "50대" (합산), userF60/userM60 → "60대 이상" (합산)

2.5 WHEN 피벗 변환된 테이블의 첫 번째 열 헤더는 THEN "분류"로 설정되어야 하며, 나머지 열 헤더는 각 앱의 appName 값이어야 함 (SHALL)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 데모그래픽이 아닌 카테고리(예: `apps/usage`, `chart/top/usage`, `usage/trend/traffic` 등)로 요청 시 THEN `_objectArrayToTable` 함수는 기존과 동일하게 동작하여야 함 (SHALL CONTINUE TO)

3.2 WHEN 복수 앱 + 날짜 기반 피벗 조건(appName과 date 필드가 모두 존재하고 앱이 2개 이상, 날짜가 1개 이상)이 충족되는 비-데모그래픽 카테고리 요청 시 THEN 기존 날짜 행 × 앱 열 피벗 변환이 그대로 적용되어야 함 (SHALL CONTINUE TO)

3.3 WHEN 단일 앱 또는 피벗 불가 조건의 비-데모그래픽 카테고리 요청 시 THEN 기존 기본 테이블 변환(SKIP_KEYS 필터링, LABEL_MAP 적용)이 그대로 적용되어야 함 (SHALL CONTINUE TO)

3.4 WHEN API 응답이 빈 배열이거나 데이터가 없는 경우 THEN 기존과 동일하게 빈 테이블 또는 "데이터 없음" 메시지를 반환하여야 함 (SHALL CONTINUE TO)
