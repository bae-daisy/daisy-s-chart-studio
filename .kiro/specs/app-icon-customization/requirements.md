# Requirements Document

## Introduction

차트에서 앱 아이콘의 모양(동그라미/네모)과 크기(소/중/대)를 사용자가 선택할 수 있도록 하고, 선택에 따라 차트 레이아웃이 자동으로 조정되는 기능에 대한 요구사항 문서이다. 기존 아이콘 ON/OFF 토글 버튼을 드롭다운 메뉴로 확장하여 모양·크기 옵션을 제공하며, 설정은 장표(slide) 단위로 저장된다.

## Glossary

- **Icon_Settings_Dropdown**: 아이콘 모양과 크기를 선택할 수 있는 드롭다운 UI 컴포넌트
- **Icon_Renderer**: SVG clipPath와 이미지를 조합하여 아이콘을 렌더링하는 모듈 (`_renderIcon`)
- **Icon_Metrics_Calculator**: 크기 키(small/medium/large)를 픽셀 값(radius, padding, imgOffset)으로 변환하는 함수 (`_iconMetrics`)
- **Chart_Layout_Adjuster**: 아이콘 크기에 따라 차트별 여백과 패딩을 자동 조정하는 로직
- **Slide**: 하나의 장표 단위 데이터 객체로, 차트 종류·데이터·아이콘 설정 등을 포함
- **iconShape**: 아이콘 모양 설정값 ('circle' 또는 'square')
- **iconSize**: 아이콘 크기 설정값 ('small', 'medium', 'large')
- **clipPath**: SVG에서 이미지를 특정 모양으로 잘라내는 마스킹 요소

## Requirements

### Requirement 1: 아이콘 설정 드롭다운 UI

**User Story:** As a 사용자, I want 아이콘 ON 상태에서 모양과 크기를 선택할 수 있는 드롭다운 메뉴를 사용하고 싶다, so that 차트 아이콘의 외형을 원하는 대로 커스터마이징할 수 있다.

#### Acceptance Criteria

1. WHEN 사용자가 아이콘 ON 상태에서 icon-toggle-btn을 클릭하면, THE Icon_Settings_Dropdown SHALL 모양(동그라미/네모)과 크기(소/중/대) 옵션이 포함된 드롭다운 메뉴를 표시한다
2. WHEN 사용자가 드롭다운에서 모양 또는 크기 옵션을 선택하면, THE Icon_Settings_Dropdown SHALL 해당 Slide 객체의 iconShape 및 iconSize 속성을 업데이트하고 차트를 재렌더링한다
3. WHEN 사용자가 아이콘을 OFF로 전환하면, THE Icon_Settings_Dropdown SHALL 드롭다운을 닫고 아이콘 영역을 제거하며 차트 여백을 원래 상태로 복원한다
4. WHEN 사용자가 드롭다운 외부 영역을 클릭하면, THE Icon_Settings_Dropdown SHALL 드롭다운을 닫고 현재 설정을 유지한다

### Requirement 2: 아이콘 크기 메트릭스 계산

**User Story:** As a 개발자, I want 크기 키에 따라 정확한 픽셀 메트릭스를 얻고 싶다, so that 아이콘 렌더링과 레이아웃 계산에 일관된 값을 사용할 수 있다.

#### Acceptance Criteria

1. WHEN iconSize가 'small'이면, THE Icon_Metrics_Calculator SHALL radius=8, padding=4, imgOffset=1을 반환한다
2. WHEN iconSize가 'medium'이면, THE Icon_Metrics_Calculator SHALL radius=12, padding=6, imgOffset=1을 반환한다
3. WHEN iconSize가 'large'이면, THE Icon_Metrics_Calculator SHALL radius=16, padding=8, imgOffset=2를 반환한다
4. IF iconSize가 'small', 'medium', 'large' 중 하나가 아니면, THEN THE Icon_Metrics_Calculator SHALL 'medium' 크기의 메트릭스를 반환한다

### Requirement 3: 아이콘 모양별 SVG 렌더링

**User Story:** As a 사용자, I want 선택한 모양(동그라미/네모)에 따라 아이콘이 정확하게 렌더링되길 원한다, so that 차트에서 원하는 시각적 스타일을 적용할 수 있다.

#### Acceptance Criteria

1. WHEN iconShape가 'circle'이면, THE Icon_Renderer SHALL clipPath 내부에 `<circle>` 요소를 사용하여 원형 아이콘을 렌더링한다
2. WHEN iconShape가 'square'이면, THE Icon_Renderer SHALL clipPath 내부에 둥근 모서리(rx)를 가진 `<rect>` 요소를 사용하여 사각형 아이콘을 렌더링한다
3. IF iconShape가 'circle' 또는 'square'가 아니면, THEN THE Icon_Renderer SHALL 'circle' 모양으로 폴백하여 렌더링한다
4. WHEN 아이콘 URL이 빈 문자열이면, THE Icon_Renderer SHALL 로딩 스피너 SVG를 반환한다
5. THE Icon_Renderer SHALL 각 아이콘에 고유한 clipPath ID를 생성하여 ID 충돌을 방지한다

### Requirement 4: 차트 레이아웃 자동 조정

**User Story:** As a 사용자, I want 아이콘 크기 변경 시 차트 레이아웃이 자동으로 조정되길 원한다, so that 아이콘과 차트 영역이 겹치거나 잘리지 않고 깔끔하게 표시된다.

#### Acceptance Criteria

1. WHEN showAppIcons가 true이고 iconSize가 변경되면, THE Chart_Layout_Adjuster SHALL 아이콘 직경(radius × 2)과 패딩을 합산하여 차트 하단 여백을 자동 조정한다
2. WHILE showAppIcons가 false인 동안, THE Chart_Layout_Adjuster SHALL 아이콘 영역 높이를 0으로 설정하고 차트 하단 여백을 T.chartBottom() 원래 값으로 유지한다
3. WHEN 아이콘 크기가 변경되면, THE Chart_Layout_Adjuster SHALL 차트 데이터 영역(cH)과 아이콘 영역의 합이 전체 가용 높이와 동일하도록 유지한다
4. WHEN verticalBar 차트에서 아이콘이 활성화되면, THE Chart_Layout_Adjuster SHALL X축 하단에 아이콘 직경 + 패딩만큼의 여백을 확보한다
5. WHEN horizontalBar 차트에서 아이콘이 활성화되면, THE Chart_Layout_Adjuster SHALL 라벨 영역의 아이콘 크기를 iconSize에 맞게 조정한다
6. WHEN line 또는 combo 차트에서 아이콘이 활성화되면, THE Chart_Layout_Adjuster SHALL 범례 영역의 아이콘 크기를 iconSize에 맞게 조정한다
7. WHEN flowCard 차트에서 아이콘이 활성화되면, THE Chart_Layout_Adjuster SHALL 랭킹 리스트의 아이콘 크기를 iconSize에 맞게 조정한다

### Requirement 5: 설정 저장 및 복원

**User Story:** As a 사용자, I want 아이콘 설정이 장표별로 저장되고 프로젝트를 다시 열었을 때 복원되길 원한다, so that 매번 설정을 다시 하지 않아도 된다.

#### Acceptance Criteria

1. WHEN 아이콘 설정이 변경되면, THE Slide SHALL iconShape와 iconSize 값을 Slide 객체에 저장하고 saveProject()를 통해 localStorage에 즉시 반영한다
2. WHEN 프로젝트를 로드할 때, THE Slide SHALL 저장된 iconShape와 iconSize 값을 복원하여 차트를 렌더링한다
3. THE Slide SHALL 각 장표의 아이콘 설정을 독립적으로 관리하여, 한 장표의 설정 변경이 다른 장표에 영향을 주지 않도록 한다
4. IF 저장된 iconShape 또는 iconSize 값이 유효하지 않으면, THEN THE Slide SHALL iconShape는 'circle', iconSize는 'medium'으로 기본값을 적용한다

### Requirement 6: 입력값 검증 및 폴백

**User Story:** As a 개발자, I want 잘못된 설정값이 입력되어도 시스템이 안전하게 동작하길 원한다, so that 예기치 않은 오류 없이 항상 유효한 아이콘이 렌더링된다.

#### Acceptance Criteria

1. IF iconShape 값이 'circle' 또는 'square'가 아니면, THEN THE Icon_Renderer SHALL 'circle'로 폴백하여 렌더링한다
2. IF iconSize 값이 'small', 'medium', 'large' 중 하나가 아니면, THEN THE Icon_Metrics_Calculator SHALL 'medium' 메트릭스를 반환한다
3. IF 아이콘 URL 로드에 실패하면, THEN THE Icon_Renderer SHALL 스피너 폴백을 표시하고 preloadAppIcons() 완료 후 차트를 재렌더링한다
