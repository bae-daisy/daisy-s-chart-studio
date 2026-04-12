# Implementation Plan: App Icon Customization (앱 아이콘 커스터마이징)

## Overview

기존 `icon-toggle-btn`을 드롭다운 메뉴로 확장하여 아이콘 모양(circle/square)과 크기(small/medium/large) 선택 UI를 구현하고, `svgCharts.js`에 공통 아이콘 렌더링 유틸리티(`_iconMetrics`, `_renderIcon`, `_chartBottomWithIcons`)를 추가한 뒤, 각 차트 타입별 레이아웃 조정과 설정 저장/복원을 구현한다.

## Tasks

- [x] 1. 아이콘 크기/모양 상수 및 유틸리티 함수 구현 (svgCharts.js)
  - [x] 1.1 `ICON_SIZE_MAP` 상수와 `_iconMetrics(sizeKey)` 함수 구현
    - `ICON_SIZE_MAP` 객체 정의: small={radius:8, padding:4, imgOffset:1}, medium={radius:12, padding:6, imgOffset:1}, large={radius:16, padding:8, imgOffset:2}
    - 유효하지 않은 sizeKey는 medium으로 폴백
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 6.2_

  - [x] 1.2 `_renderIcon(url, cx, cy, metrics, shape, uniqueId)` 함수 구현
    - shape='circle' → clipPath 내 `<circle>` 사용
    - shape='square' → clipPath 내 `<rect rx="cornerR">` 사용
    - 유효하지 않은 shape는 'circle'로 폴백
    - 빈 url이면 `_iconSpinner()` 반환
    - 고유 clipPath ID 생성으로 충돌 방지
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1_

  - [x] 1.3 `_chartBottomWithIcons(hasIcons, sizeKey)` 함수 구현
    - hasIcons=false → T.chartBottom() 원래 값 반환
    - hasIcons=true → T.chartBottom() - (radius*2 + padding) 반환
    - _Requirements: 4.1, 4.2_

  - [ ]* 1.4 Property test: 잘못된 iconSize 폴백 (Property 2)
    - **Property 2: 잘못된 iconSize 폴백**
    - fast-check로 임의의 문자열/null/undefined에 대해 `_iconMetrics()`가 medium 값을 반환하는지 검증
    - **Validates: Requirements 2.4, 6.2**

  - [ ]* 1.5 Property test: 모양-SVG 요소 일관성 (Property 1)
    - **Property 1: 모양-SVG 요소 일관성**
    - 유효한 shape('circle'/'square')와 임의 좌표에 대해 `_renderIcon()` 출력의 clipPath 내부 요소가 shape에 맞는지 검증
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 1.6 Property test: 잘못된 iconShape 폴백 (Property 3)
    - **Property 3: 잘못된 iconShape 폴백**
    - 'circle'/'square'가 아닌 임의 문자열에 대해 `_renderIcon()`이 circle로 폴백하는지 검증
    - **Validates: Requirements 3.3, 6.1**

  - [ ]* 1.7 Property test: OFF 시 차트 여백 복원 (Property 4)
    - **Property 4: OFF 시 차트 여백 복원**
    - 임의의 iconSize에 대해 `_chartBottomWithIcons(false, sizeKey)`가 `T.chartBottom()`과 동일한지 검증
    - **Validates: Requirements 1.3, 4.2**

  - [ ]* 1.8 Property test: 차트 하단 여백 계산 정확성 (Property 8)
    - **Property 8: 차트 하단 여백 계산 정확성**
    - 유효한 sizeKey에 대해 `_chartBottomWithIcons(true, sizeKey)` === `T.chartBottom() - (metrics.radius*2 + metrics.padding)` 검증
    - **Validates: Requirements 4.1, 4.4**

- [ ] 2. Checkpoint - 유틸리티 함수 검증
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. 아이콘 설정 드롭다운 UI 구현 (app.js + style.css)
  - [x] 3.1 드롭다운 HTML 생성 및 토글 로직 구현 (app.js)
    - 기존 `icon-toggle-btn` 클릭 시 모양(동그라미/네모)·크기(소/중/대) 옵션이 포함된 드롭다운 표시
    - 아이콘 OFF 상태에서는 드롭다운 비활성화
    - 드롭다운 외부 클릭 시 닫기 (document click 리스너)
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 3.2 모양/크기 선택 시 slide 객체 업데이트 및 rerenderChart 호출 (app.js)
    - 옵션 선택 → `slide.iconShape`, `slide.iconSize` 업데이트
    - `rerenderChart(slide, wrapper)` 호출로 즉시 반영
    - `saveProject()` 호출로 localStorage 저장
    - _Requirements: 1.2, 5.1_

  - [x] 3.3 드롭다운 CSS 스타일 구현 (style.css)
    - 드롭다운 메뉴 위치, 배경, 그림자, 옵션 hover/active 스타일
    - 현재 선택된 옵션 하이라이트
    - _Requirements: 1.1_

- [ ] 4. 차트별 레이아웃 조정 (svgCharts.js)
  - [x] 4.1 verticalBar 차트 아이콘 영역 및 여백 조정
    - `_iconMetrics()`로 아이콘 크기 가져와 X축 하단 여백 계산
    - 아이콘 중심 Y좌표 = cBot + 라벨 높이 + padding + radius
    - 기존 하드코딩된 아이콘 크기를 `_renderIcon()` 호출로 교체
    - _Requirements: 4.1, 4.3, 4.4_

  - [ ] 4.2 horizontalBar 차트 아이콘 크기 조정
    - 라벨 영역 아이콘 크기를 iconSize 메트릭스에 맞게 조정
    - 기존 하드코딩된 반지름을 `_iconMetrics()` 값으로 교체
    - _Requirements: 4.5_

  - [x] 4.3 flowCard 차트 아이콘 크기 조정
    - 랭킹 리스트 아이콘 크기를 iconSize 메트릭스에 맞게 조정
    - _Requirements: 4.7_

  - [ ] 4.4 line/combo 차트 범례 아이콘 크기 조정
    - 범례 영역 아이콘 크기를 iconSize 메트릭스에 맞게 조정
    - _Requirements: 4.6_

  - [ ]* 4.5 Property test: 레이아웃 높이 불변식 (Property 5)
    - **Property 5: 레이아웃 높이 불변식**
    - 유효한 iconSize에 대해 차트 데이터 영역 + 아이콘 영역 = 전체 가용 높이 검증
    - **Validates: Requirement 4.3**

- [ ] 5. Checkpoint - 차트 레이아웃 조정 검증
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. 설정 저장/복원 및 slide 객체 통합 (app.js)
  - [x] 6.1 slide 객체에 iconShape/iconSize 기본값 설정 및 저장/로드 로직
    - 새 slide 생성 시 iconShape='circle', iconSize='medium' 기본값 설정
    - `saveProject()` 시 iconShape/iconSize 포함하여 localStorage 저장
    - `loadProject()` 시 저장된 값 복원, 유효하지 않은 값은 기본값으로 폴백
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2_

  - [x] 6.2 rerenderChart에서 slide 아이콘 설정을 SvgCharts에 전달
    - `SvgCharts._iconShape = slide.iconShape || 'circle'`
    - `SvgCharts._iconSize = slide.iconSize || 'medium'`
    - _Requirements: 1.2, 5.2_

  - [ ]* 6.3 Property test: 설정 저장/복원 round-trip (Property 6)
    - **Property 6: 설정 저장/복원 round-trip**
    - 임의의 유효한 iconShape/iconSize 조합을 slide에 저장 후 로드하여 동일 값 복원 검증
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 6.4 Property test: 장표 독립성 (Property 7)
    - **Property 7: 장표 독립성**
    - N개 장표 중 하나의 아이콘 설정 변경 시 다른 장표 설정이 변경되지 않는지 검증
    - **Validates: Requirement 5.3**

- [ ] 7. Final checkpoint - 전체 통합 검증
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- `*` 표시된 태스크는 선택사항이며 빠른 MVP를 위해 건너뛸 수 있음
- 각 태스크는 특정 요구사항을 참조하여 추적 가능
- Property test는 fast-check 라이브러리 사용
- 기존 `_appIcon()`, `_iconSpinner()` 캐시 로직은 그대로 유지
