# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 데모그래픽 카테고리 userF/userM 필드 피벗 변환 누락
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases - demographic categories (`apps/demographic`, `usage/demographic`, `usage/app/persona`, `usage/app/persona-relative`) with `userF`/`userM` flat fields
  - Install `fast-check` as a dev dependency (`npm install --save-dev fast-check`)
  - Create test file `apiClient.demographic.test.js`
  - Import `apiClient.js` and `parser.js` (required dependency) using appropriate module loading for the project
  - Write a property-based test using `fast-check` that generates random demographic data objects with `appName`, `userF`, `userM`, `userF10`-`userF60`, `userM10`-`userM60` fields
  - For each demographic category, call `ApiClient._objectArrayToTable(category, arr)` and assert:
    - `result.headers[0] === "분류"`
    - `result.headers.slice(1)` matches the `appName` values from input
    - `result.data.length === 8`
    - `result.data` rows are ordered: `["남성", "여성", "10대 이하", "20대", "30대", "40대", "50대", "60대 이상"]`
    - Age group values equal `userFNN + userMNN` sums
  - _Bug_Condition: `isBugCondition(category, arr)` where `category IN ['apps/demographic', 'usage/demographic', 'usage/app/persona', 'usage/app/persona-relative'] AND arr[0] HAS KEYS matching /^user[FM]\d*$/_
  - Run test on UNFIXED code - expect FAILURE (this confirms the bug exists)
  - **EXPECTED OUTCOME**: Test FAILS because `_objectArrayToTable` lacks demographic pivot logic, returning raw field names like `userF`, `userM10` as headers instead of pivoted "분류" rows
  - Document counterexamples found (e.g., `_objectArrayToTable('apps/demographic', [{appName: "Netflix", userF: 52.8, ...}])` returns headers containing `"userF"` instead of `"분류"`)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 비-데모그래픽 카테고리 기존 동작 보존
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Observe: `_objectArrayToTable('apps/usage', [{appName: "Netflix", date: "202501", value: 1000}, {appName: "TVING", date: "202501", value: 800}])` returns date-pivot table with headers `["날짜", "Netflix", "TVING"]`
    - Observe: `_objectArrayToTable('chart/top/usage', [{appName: "Netflix", rank: 1, userCnt: 5000}])` returns basic table with LABEL_MAP applied headers
    - Observe: `_objectArrayToTable('apps/usage', [])` returns empty table structure
  - Write property-based test using `fast-check`:
    - Generate random non-demographic categories from `['apps/usage', 'chart/top/usage', 'usage/trend/traffic', 'apps/ranking', 'apps/biz-rate', 'usage/usage-rank']`
    - For date-pivot cases: generate random multi-app + date data, verify headers start with "날짜" and contain app names, rows correspond to dates
    - For basic table cases: generate random single-app data with standard fields (`rank`, `userCnt`, `appName`), verify SKIP_KEYS are filtered and LABEL_MAP is applied
    - For empty array cases: verify empty table structure is returned
  - Verify tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for demographic category pivot transformation in `_objectArrayToTable`

  - [x] 3.1 Implement the fix in `apiClient.js`
    - Add `DEMO_CATEGORIES` constant array: `['apps/demographic', 'usage/demographic', 'usage/app/persona', 'usage/app/persona-relative']`
    - Add `DEMO_ROWS` mapping array defining label and calc function for each row: 남성(`userM`), 여성(`userF`), 10대 이하(`userF10+userM10`), 20대(`userF20+userM20`), 30대(`userF30+userM30`), 40대(`userF40+userM40`), 50대(`userF50+userM50`), 60대 이상(`userF60+userM60`)
    - Add demographic pivot branch BEFORE the existing date-pivot branch (`if (appNames.length >= 2 && dates.length >= 1)`)
    - The branch checks: `DEMO_CATEGORIES.includes(category) && arr[0] && 'userF' in arr[0]`
    - Extract unique app names from `arr` preserving order
    - Build headers: `["분류", ...appNames]`
    - Build data rows by iterating `DEMO_ROWS`, computing each app's value via the `calc` function, converting to `String`
    - Call `Parser.recommendChart(type, h, d)` and `Parser._cleanNumericCommas(h, d)` on the result
    - Return `{ type, chartKind, meta, headers: h, data: d }`
    - _Bug_Condition: `isBugCondition(category, arr)` where `category IN DEMO_CATEGORIES AND arr[0] HAS 'userF' field_
    - _Expected_Behavior: Returns pivoted table with headers `["분류", ...appNames]` and 8 data rows `["남성", "여성", "10대 이하", "20대", "30대", "40대", "50대", "60대 이상"]` with correct values_
    - _Preservation: Non-demographic categories continue to use existing date-pivot and basic table logic unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 데모그래픽 피벗 변환 정상 동작
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (headers = `["분류", ...appNames]`, 8 demographic rows, correct age sum values)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 비-데모그래픽 카테고리 동작 보존 확인
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite (`npm test`) to ensure all existing tests and new tests pass
  - Ensure all tests pass, ask the user if questions arise.
