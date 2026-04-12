# Requirements Document

## Introduction

Chart Studio 앱에 모바일인덱스(Mobile Index) API를 안전하게 연동하는 기능의 요구사항이다. 현재 CSV/XLSX 파일 업로드만 지원하는 앱에 API 기반 데이터 조회 경로를 추가하되, API 키가 프론트엔드에 절대 노출되지 않도록 프록시 서버를 통해 보안을 확보한다. 사용자가 데이터 종류와 필터 조건을 선택하면 프록시 서버가 모바일인덱스 API를 호출하고, 응답 데이터가 기존 Parser → SvgCharts 파이프라인을 통해 차트로 자동 생성된다.

## Glossary

- **Proxy_Server**: 프론트엔드와 모바일인덱스 API 사이에 위치한 Express 기반 Node.js 서버. API 키를 서버 측 환경변수에 보관하고 요청을 중계한다.
- **ApiClient**: 프론트엔드에서 Proxy_Server와 통신하고 응답을 Parser 호환 형식으로 변환하는 JavaScript 모듈 (apiClient.js).
- **Parser**: CSV 텍스트를 파싱하여 headers와 data 2D 배열로 변환하는 기존 모듈 (parser.js).
- **SvgCharts**: Parser 출력을 받아 SVG 차트를 렌더링하는 기존 모듈 (svgCharts.js).
- **API_Selection_UI**: 사용자가 데이터 카테고리와 필터 조건을 선택하는 프론트엔드 UI 컴포넌트.
- **Mobile_Index_API**: 모바일인덱스에서 제공하는 외부 데이터 API.
- **API_Key**: Mobile_Index_API 인증에 사용되는 비밀 키 문자열.
- **Rate_Limiter**: Proxy_Server에서 IP당 요청 빈도를 제한하는 미들웨어.
- **Request_Validator**: Proxy_Server에서 요청 본문의 유효성을 검증하는 모듈.
- **ApiFilters**: 기간(startDate, endDate), OS, 성별, 연령대, 업종, 앱 목록 등 조회 필터 조건 객체.
- **ApiRequest**: 프론트엔드에서 Proxy_Server로 전송하는 요청 객체 (category + ApiFilters).
- **ApiResponse**: Proxy_Server가 프론트엔드에 반환하는 정제된 응답 객체 (success, data, error).

## Requirements

### Requirement 1: API 키 보안 (서버 측 보관)

**User Story:** 개발자로서, API 키가 서버 측 환경변수에만 보관되기를 원한다. 그래야 프론트엔드 코드나 네트워크 트래픽을 통해 키가 유출되는 것을 방지할 수 있다.

#### Acceptance Criteria

1.1. THE Proxy_Server SHALL load API_Key exclusively from the `MOBILE_INDEX_API_KEY` environment variable stored in a `.env` file

1.2. WHEN Proxy_Server starts without `MOBILE_INDEX_API_KEY` environment variable set, THEN THE Proxy_Server SHALL refuse to start and output a configuration error message to the console

1.3. THE Proxy_Server SHALL add the `.env` file to `.gitignore` to prevent API_Key from being committed to version control

1.4. WHEN Proxy_Server sends a response to ApiClient, THE Proxy_Server SHALL exclude API_Key from the response body, response headers, and all serialized data

1.5. WHEN Proxy_Server logs an error, THE Proxy_Server SHALL mask API_Key in all log output

1.6. THE ApiClient SHALL send requests only to Proxy_Server and SHALL contain no reference to Mobile_Index_API URL or API_Key in frontend source code

### Requirement 2: 프록시 서버 요청 검증

**User Story:** 시스템 운영자로서, Proxy_Server가 모든 수신 요청을 검증하기를 원한다. 그래야 잘못된 입력이나 악의적 요청이 Mobile_Index_API에 전달되는 것을 차단할 수 있다.

#### Acceptance Criteria

2.1. WHEN Request_Validator receives a request with a category not in the allowed category list, THEN THE Request_Validator SHALL reject the request with HTTP 400 and a specific error message

2.2. WHEN Request_Validator receives a request with startDate or endDate not matching YYYY-MM format, THEN THE Request_Validator SHALL reject the request with HTTP 400 and a specific error message

2.3. WHEN Request_Validator receives a request where endDate is earlier than startDate, THEN THE Request_Validator SHALL reject the request with HTTP 400 and a specific error message

2.4. WHEN Request_Validator receives a request with os value not in ('android', 'ios', 'all'), THEN THE Request_Validator SHALL reject the request with HTTP 400 and a specific error message

2.5. WHEN Request_Validator receives a request with gender value not in ('all', 'male', 'female'), THEN THE Request_Validator SHALL reject the request with HTTP 400 and a specific error message

2.6. WHEN Request_Validator receives a request with ageRange value not in ('all', '10', '20', '30', '40', '50'), THEN THE Request_Validator SHALL reject the request with HTTP 400 and a specific error message

2.7. WHEN Request_Validator receives a comparison category request with appIds exceeding 5 items or empty, THEN THE Request_Validator SHALL reject the request with HTTP 400 and a specific error message

2.8. WHEN Request_Validator receives a request with JSON body exceeding 10KB, THEN THE Request_Validator SHALL reject the request with HTTP 413

2.9. WHEN Request_Validator determines a request is valid, THE Proxy_Server SHALL forward the request to Mobile_Index_API; WHEN Request_Validator determines a request is invalid, THE Proxy_Server SHALL not call Mobile_Index_API

### Requirement 3: Rate Limiting

**User Story:** 시스템 운영자로서, IP당 요청 빈도를 제한하기를 원한다. 그래야 API 남용을 방지하고 Mobile_Index_API 할당량을 보호할 수 있다.

#### Acceptance Criteria

3.1. THE Rate_Limiter SHALL allow a maximum of 30 requests per IP address within a 60-second sliding window

3.2. WHEN a request exceeds the rate limit, THEN THE Proxy_Server SHALL respond with HTTP 429 and a message indicating the client should retry later

3.3. WHEN a request is within the rate limit, THE Rate_Limiter SHALL allow the request to proceed to Request_Validator

### Requirement 4: CORS 및 전송 보안

**User Story:** 보안 담당자로서, Proxy_Server가 허용된 출처에서만 요청을 수락하기를 원한다. 그래야 무단 도메인에서의 API 접근을 차단할 수 있다.

#### Acceptance Criteria

4.1. THE Proxy_Server SHALL configure CORS to accept requests only from origins in the allowed origins list

4.2. WHEN a request arrives from an origin not in the allowed origins list, THEN THE Proxy_Server SHALL reject the request

4.3. THE Proxy_Server SHALL set Content-Type response header to `application/json` for all API responses

### Requirement 5: API 데이터 선택 UI

**User Story:** 사용자로서, 데이터 종류와 필터 조건을 선택하는 UI를 사용하기를 원한다. 그래야 원하는 모바일인덱스 데이터를 쉽게 조회할 수 있다.

#### Acceptance Criteria

5.1. THE API_Selection_UI SHALL display a tab alongside the existing file upload area labeled "API 데이터 조회"

5.2. THE API_Selection_UI SHALL render a dropdown for selecting a data category from the defined API_CATEGORIES list (ranking_users, ranking_time, ranking_avg_time, ranking_installs, traffic_users, traffic_time, demo_compare, compare_users, compare_time)

5.3. THE API_Selection_UI SHALL render filter controls for startDate (YYYY-MM), endDate (YYYY-MM), OS selection, gender selection, and ageRange selection

5.4. WHEN a user selects a comparison category (compare_users, compare_time, demo_compare), THE API_Selection_UI SHALL display an appIds input field allowing up to 5 app package names

5.5. WHEN a user completes filter selection and submits, THE API_Selection_UI SHALL invoke ApiClient.fetchData with the selected category and filters

5.6. WHILE ApiClient is fetching data, THE API_Selection_UI SHALL display a loading indicator

5.7. WHEN ApiClient returns an error, THE API_Selection_UI SHALL display a user-friendly error message corresponding to the error code

### Requirement 6: API 응답 변환 (JSON → Parser 호환 형식)

**User Story:** 개발자로서, Mobile_Index_API의 JSON 응답이 기존 Parser 호환 형식으로 변환되기를 원한다. 그래야 기존 차트 렌더링 파이프라인을 변경 없이 재사용할 수 있다.

#### Acceptance Criteria

6.1. WHEN ApiClient receives a successful response from Proxy_Server, THE ApiClient SHALL transform the JSON data into an object containing type, chartKind, meta, headers, and data fields

6.2. THE ApiClient SHALL produce a headers array with a minimum length of 2

6.3. THE ApiClient SHALL produce a data array where every row has the same length as the headers array

6.4. THE ApiClient SHALL map each category to a valid chartKind value defined in the existing chart type system (T.KINDS)

6.5. WHEN the response data contains numeric values with comma separators, THE ApiClient SHALL remove commas before passing data to the chart pipeline

6.6. WHEN the response data contains package names, THE ApiClient SHALL convert package names to human-readable app names using the existing mapping

6.7. WHEN the transformed data is ready, THE ApiClient SHALL pass the result to the existing addSlide function to render the chart

### Requirement 7: 프록시 서버 API 중계

**User Story:** 개발자로서, Proxy_Server가 프론트엔드 요청을 Mobile_Index_API로 안전하게 중계하기를 원한다. 그래야 API 키를 서버 측에서만 주입하면서 데이터를 가져올 수 있다.

#### Acceptance Criteria

7.1. WHEN Proxy_Server receives a valid POST request to `/api/mobile-index`, THE Proxy_Server SHALL map the category to the corresponding Mobile_Index_API endpoint and inject API_Key as a query parameter

7.2. WHEN Mobile_Index_API returns a successful response, THE Proxy_Server SHALL sanitize the response by removing fields that could contain API_Key or internal URLs, then return the sanitized data with HTTP 200

7.3. WHEN Mobile_Index_API returns an error or times out (10-second timeout), THEN THE Proxy_Server SHALL respond with HTTP 502 and a generic error message without exposing internal error details

7.4. WHEN Proxy_Server receives a GET request to `/api/industries`, THE Proxy_Server SHALL return the list of available industry categories

### Requirement 8: 에러 처리 및 사용자 피드백

**User Story:** 사용자로서, 오류 발생 시 명확한 안내를 받기를 원한다. 그래야 문제를 이해하고 적절한 조치를 취할 수 있다.

#### Acceptance Criteria

8.1. WHEN Proxy_Server responds with HTTP 429, THE ApiClient SHALL display "잠시 후 다시 시도해주세요" message to the user

8.2. WHEN Proxy_Server responds with HTTP 400, THE ApiClient SHALL display the specific validation error message returned by Request_Validator

8.3. WHEN Proxy_Server responds with HTTP 502, THE ApiClient SHALL display "데이터를 가져올 수 없습니다" message and suggest file upload as an alternative

8.4. IF a network error occurs during ApiClient communication with Proxy_Server, THEN THE ApiClient SHALL display a connection error message

8.5. THE Proxy_Server SHALL include an error code field (RATE_LIMIT, VALIDATION_ERROR, API_ERROR, TIMEOUT) in all error responses for programmatic handling

8.6. WHEN Proxy_Server returns an error response, THE Proxy_Server SHALL exclude stack traces, internal URLs, and API_Key from the response body

### Requirement 9: 기존 파이프라인 통합

**User Story:** 사용자로서, API로 가져온 데이터가 기존 파일 업로드와 동일한 차트 렌더링 경험을 제공하기를 원한다. 그래야 데이터 소스에 관계없이 일관된 차트를 볼 수 있다.

#### Acceptance Criteria

9.1. WHEN ApiClient produces a transformed result, THE result SHALL be compatible with the existing addSlide function in app.js

9.2. WHEN a chart is generated from API data, THE SvgCharts module SHALL render the chart using the same rendering logic as file-uploaded data

9.3. WHEN a chart is generated from API data, THE user SHALL be able to change chart type, edit data, and download the chart using existing controls

9.4. THE API_Selection_UI and the existing file upload UI SHALL coexist without interfering with each other's functionality
