# Implementation Plan: Secure API Integration (모바일인덱스 API 보안 연동)

## Overview

Express 기반 프록시 서버를 통해 모바일인덱스 API를 안전하게 연동한다. API 키는 서버 측 환경변수에만 보관하고, 프론트엔드는 프록시 서버에만 요청을 보낸다. 응답 데이터는 기존 Parser → SvgCharts 파이프라인을 통해 차트로 자동 생성된다.

## Tasks

- [x] 1. 프록시 서버 프로젝트 설정 및 보안 기반
  - [x] 1.1 서버 의존성 설치 및 .env 설정
    - `express`, `dotenv`, `express-rate-limit`, `cors` 패키지 설치
    - `.env` 파일 생성 (`MOBILE_INDEX_API_KEY` 플레이스홀더)
    - `.env`를 `.gitignore`에 추가
    - `.env.example` 파일 생성 (키 없이 변수명만 포함)
    - _Requirements: 1.1, 1.3_

  - [x] 1.2 Express 프록시 서버 기본 구조 생성 (server.js)
    - dotenv로 환경변수 로드
    - `MOBILE_INDEX_API_KEY` 미설정 시 서버 시작 거부 + 콘솔 에러 메시지 출력
    - CORS 미들웨어 설정 (허용된 origin만)
    - JSON body parser 설정 (10KB 제한)
    - Content-Type `application/json` 응답 헤더 설정
    - 정적 파일 서빙 (프론트엔드 파일)
    - _Requirements: 1.1, 1.2, 2.8, 4.1, 4.2, 4.3_

  - [x] 1.3 Rate Limiter 미들웨어 적용
    - `express-rate-limit`으로 IP당 60초 윈도우, 최대 30회 제한
    - 초과 시 429 응답 + `{ success: false, error: '...', code: 'RATE_LIMIT' }` 반환
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 2. 요청 검증 및 API 중계 구현
  - [x] 2.1 validateRequest() 함수 구현
    - 허용된 카테고리 목록 검증 (ranking_users, ranking_time, ranking_avg_time, ranking_installs, traffic_users, traffic_time, demo_compare, compare_users, compare_time)
    - startDate/endDate YYYY-MM 형식 검증 + endDate >= startDate 검증
    - os ('android', 'ios', 'all'), gender ('all', 'male', 'female'), ageRange ('all', '10', '20', '30', '40', '50') 허용값 검증
    - 비교 카테고리(compare_users, compare_time, demo_compare)에서 appIds 1~5개 필수 검증
    - 검증 실패 시 구체적 에러 메시지 반환
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.9_

  - [ ]* 2.2 validateRequest() 속성 테스트 작성
    - **Property 5: 입력 검증 — 검증 실패 시 API 호출 없음**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.9**

  - [x] 2.3 POST /api/mobile-index 엔드포인트 구현
    - 카테고리 → 모바일인덱스 API 엔드포인트 매핑
    - API 키를 서버 측에서만 쿼리 파라미터로 주입
    - 10초 타임아웃 설정
    - 응답 정제: API 키, 내부 URL 등 민감 정보 제거
    - 성공 시 200 + 정제된 데이터, 실패 시 502 + 일반 에러 메시지
    - 에러 로그에 API 키 마스킹
    - 에러 응답에 code 필드 포함 (RATE_LIMIT, VALIDATION_ERROR, API_ERROR, TIMEOUT)
    - _Requirements: 1.4, 1.5, 7.1, 7.2, 7.3, 8.5, 8.6_

  - [x] 2.4 GET /api/industries 엔드포인트 구현
    - 사용 가능한 업종 카테고리 목록 반환
    - _Requirements: 7.4_

  - [ ]* 2.5 프록시 서버 단위 테스트 작성
    - validateRequest 유효/무효 입력 조합 테스트
    - 응답 정제 함수에서 API 키 미포함 검증
    - 에러 응답 형식 검증
    - _Requirements: 1.4, 1.5, 2.1–2.9, 8.5, 8.6_

- [x] 3. 체크포인트 — 서버 측 구현 검증
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. API 클라이언트 구현 (apiClient.js)
  - [x] 4.1 ApiClient.fetchData() 구현
    - 프록시 서버에 POST 요청 전송
    - AbortController로 중복 요청 취소 지원
    - 응답 상태별 에러 처리 (429 → "잠시 후 다시 시도해주세요", 400 → 검증 에러 메시지, 502 → "데이터를 가져올 수 없습니다")
    - 네트워크 에러 시 연결 에러 메시지 표시
    - API 키, 모바일인덱스 API URL 프론트엔드 코드에 미포함
    - _Requirements: 1.6, 8.1, 8.2, 8.3, 8.4_

  - [x] 4.2 ApiClient.transformResponse() 구현
    - JSON 응답 → {type, chartKind, meta, headers, data} 형식 변환
    - 카테고리별 chartKind 매핑 (T.KINDS 호환)
    - headers 배열 길이 2 이상 보장
    - data 각 행 길이 === headers 길이 보장
    - 숫자 쉼표 제거 (Parser._cleanNumericCommas 재사용)
    - 패키지명 → 앱명 변환 (Parser._convertPkgToAppName 재사용)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 4.3 transformResponse() 속성 테스트 작성
    - **Property 3: 데이터 무결성 — 변환 결과의 행 길이 일관성**
    - **Validates: Requirements 6.2, 6.3**

  - [x] 4.4 ApiClient.getIndustries() 구현
    - GET /api/industries 호출하여 업종 목록 반환
    - _Requirements: 7.4_

  - [ ]* 4.5 ApiClient 단위 테스트 작성
    - mock fetch를 이용한 fetchData 성공/실패 시나리오 테스트
    - transformResponse 카테고리별 변환 정확성 테스트
    - _Requirements: 6.1–6.6, 8.1–8.4_

- [x] 5. 체크포인트 — 클라이언트 측 구현 검증
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. API 데이터 선택 UI 구현
  - [x] 6.1 index.html에 API 데이터 조회 탭 추가
    - 온보딩 화면에 "파일 업로드" / "API 데이터 조회" 탭 UI 추가
    - 기존 파일 업로드 UI와 공존, 상호 간섭 없음
    - _Requirements: 5.1, 9.4_

  - [x] 6.2 API 필터 폼 UI 구현
    - 데이터 카테고리 드롭다운 (API_CATEGORIES 목록)
    - 기간 선택 (startDate, endDate — YYYY-MM)
    - OS, 성별, 연령대 선택 컨트롤
    - 비교 카테고리 선택 시 appIds 입력 필드 표시 (최대 5개)
    - 업종 드롭다운 (getIndustries() 연동)
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 6.3 폼 제출 및 상태 관리 구현
    - 제출 시 ApiClient.fetchData() 호출
    - 로딩 인디케이터 표시/숨김
    - 에러 발생 시 사용자 친화적 에러 메시지 표시
    - _Requirements: 5.5, 5.6, 5.7_

  - [x] 6.4 style.css에 API 선택 UI 스타일 추가
    - 탭 전환 스타일, 폼 레이아웃, 로딩/에러 상태 스타일
    - 기존 디자인 시스템과 일관성 유지
    - _Requirements: 5.1_

- [x] 7. 기존 파이프라인 통합
  - [x] 7.1 API 데이터 → addSlide 연결
    - transformResponse 결과를 기존 addSlide() 함수에 전달
    - 차트 종류 변경, 데이터 편집, 다운로드 등 기존 기능 호환
    - _Requirements: 6.7, 9.1, 9.2, 9.3_

  - [x] 7.2 CSP 헤더 업데이트
    - index.html의 Content-Security-Policy `connect-src`에 프록시 서버 origin 추가
    - 외부 API 도메인 직접 접근 차단 유지
    - _Requirements: 1.6, 4.1_

  - [ ]* 7.3 API 키 비노출 속성 테스트 작성
    - **Property 1: API 키 비노출 — 프론트엔드 수신 데이터에 API 키 미포함**
    - **Validates: Requirements 1.4, 1.6**

- [x] 8. 최종 체크포인트 — 전체 통합 검증
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 보안 최우선: API 키가 프론트엔드에 절대 노출되지 않도록 모든 단계에서 검증
- 기존 parser.js, svgCharts.js, app.js의 함수를 최대한 재사용
- 프론트엔드는 순수 JS 유지 (프레임워크 미사용)
- Property tests use fast-check library
