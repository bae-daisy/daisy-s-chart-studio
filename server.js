// 환경변수 로드 — 반드시 최상단에서 실행
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

// ── Bearer 토큰 존재 확인 (미설정 시 서버 시작 거부) ──
if (!process.env.MOBILE_INDEX_TOKEN) {
  console.error(
    '\n[ERROR] MOBILE_INDEX_TOKEN 환경변수가 설정되지 않았습니다.\n' +
    '.env 파일에 MOBILE_INDEX_TOKEN=your_bearer_token 형식으로 추가해주세요.\n'
  );
  process.exit(1);
}

const app = express();
const PORT = 3000;

// ── CORS 설정 (허용된 origin만) ──
app.use(cors({
  origin: ['http://localhost:3000', 'https://bae-daisy.github.io'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// ── JSON body parser (10KB 제한) ──
app.use(express.json({ limit: '10kb' }));

// ── Rate Limiter (/api 경로 전용) ──
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,   // 60초 윈도우
  max: 30,               // IP당 최대 30회
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: '잠시 후 다시 시도해주세요',
      code: 'RATE_LIMIT'
    });
  }
});
app.use('/api', apiLimiter);

// ── API 응답 Content-Type 설정 ──
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// ── 요청 검증 ──

const ALLOWED_CATEGORIES = [
  // chart (MI CHART)
  'chart/top/usage', 'chart/top/revenue',
  'chart/market/rank', 'chart/market/global-rank', 'chart/market/realtime-rank',
  // usage (사용량 인덱스)
  'usage/usage-rank', 'usage/demographic',
  'usage/trend/traffic', 'usage/trend/user', 'usage/trend/rank', 'usage/trend/top', 'usage/trend/os',
  'usage/rise-rank',
  'usage/overlap-rank',
  'usage/app/concurrent', 'usage/app/involvement', 'usage/app/break',
  'usage/app/interest', 'usage/app/persona', 'usage/app/persona-relative', 'usage/app/region',
  'usage/competitor/install-delete', 'usage/competitor/loyalty',
  'usage/retention',
  // apps (앱 상세)
  'apps/summary', 'apps/info', 'apps/ranking-history', 'apps/market-info',
  'apps/timeline', 'apps/rate-total', 'apps/rate',
  'apps/usage', 'apps/demographic', 'apps/ranking', 'apps/biz-rate',
  // common (공통)
  'common/search', 'common/cate-main', 'common/cate-sub'
];

// 앱 패키지명이 필요한 카테고리 (단일 앱)
const APP_REQUIRED_CATEGORIES = [
  'usage/overlap-rank',
  'usage/app/concurrent', 'usage/app/involvement', 'usage/app/break',
  'usage/app/interest', 'usage/app/persona', 'usage/app/persona-relative', 'usage/app/region',
  'apps/summary', 'apps/info', 'apps/ranking-history', 'apps/market-info',
  'apps/timeline', 'apps/rate-total', 'apps/rate'
];

// 복수 앱 비교 카테고리
const MULTI_APP_CATEGORIES = [
  'usage/competitor/install-delete', 'usage/competitor/loyalty',
  'usage/retention',
  'apps/usage', 'apps/demographic', 'apps/ranking', 'apps/biz-rate'
];

const ALLOWED_OS = ['android', 'ios', 'all'];
const ALLOWED_GENDER = ['all', 'male', 'female'];
const ALLOWED_AGE_RANGE = ['all', '10', '20', '30', '40', '50'];
const ALLOWED_MARKET = ['all', 'google', 'apple', 'one'];

const DATE_FORMAT = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_FORMAT_DAILY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const APP_ID_FORMAT = /^[a-zA-Z0-9._-]{1,150}$/;

/**
 * 요청 본문의 category, filters 유효성 검증 (순수 함수)
 * @param {Object} body - 파싱된 JSON 요청 본문
 * @returns {{ valid: boolean, error?: string }}
 */
function validateRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: '요청 본문이 비어있거나 올바르지 않습니다' };
  }

  const { category, filters } = body;

  // 카테고리 검증
  if (!category || !ALLOWED_CATEGORIES.includes(category)) {
    return { valid: false, error: `허용되지 않은 카테고리입니다: ${category}` };
  }

  if (!filters || typeof filters !== 'object') {
    return { valid: false, error: '필터 조건이 누락되었습니다' };
  }

  const { startDate, endDate, os, gender, ageRange, market, pkg_name, appIds } = filters;

  // 날짜 형식 검증 (YYYY-MM 또는 YYYY-MM-DD)
  if (startDate) {
    if (!DATE_FORMAT.test(startDate) && !DATE_FORMAT_DAILY.test(startDate)) {
      return { valid: false, error: 'startDate는 YYYY-MM 또는 YYYY-MM-DD 형식이어야 합니다' };
    }
  }
  if (endDate) {
    if (!DATE_FORMAT.test(endDate) && !DATE_FORMAT_DAILY.test(endDate)) {
      return { valid: false, error: 'endDate는 YYYY-MM 또는 YYYY-MM-DD 형식이어야 합니다' };
    }
  }

  // endDate >= startDate 검증
  if (startDate && endDate && endDate < startDate) {
    return { valid: false, error: 'endDate는 startDate 이후여야 합니다' };
  }

  // OS 검증 (선택적)
  if (os && !ALLOWED_OS.includes(os)) {
    return { valid: false, error: `허용되지 않은 OS 값입니다: ${os}` };
  }

  // 성별 검증 (선택적)
  if (gender && !ALLOWED_GENDER.includes(gender)) {
    return { valid: false, error: `허용되지 않은 성별 값입니다: ${gender}` };
  }

  // 연령대 검증 (선택적)
  if (ageRange && !ALLOWED_AGE_RANGE.includes(ageRange)) {
    return { valid: false, error: `허용되지 않은 연령대 값입니다: ${ageRange}` };
  }

  // 마켓 검증 (선택적)
  if (market && !ALLOWED_MARKET.includes(market)) {
    return { valid: false, error: `허용되지 않은 마켓 값입니다: ${market}` };
  }

  // 앱 패키지명 검증 (단일 앱)
  if (pkg_name) {
    if (typeof pkg_name !== 'string' || !APP_ID_FORMAT.test(pkg_name)) {
      return { valid: false, error: `잘못된 앱 패키지명입니다: ${String(pkg_name).slice(0, 50)}` };
    }
  }

  // 앱 패키지명 필수 카테고리 검증
  if (APP_REQUIRED_CATEGORIES.includes(category) && !pkg_name) {
    return { valid: false, error: '이 카테고리에서는 앱 패키지명(pkg_name)이 필요합니다' };
  }

  // 복수 앱 비교 카테고리에서 appIds 검증
  if (MULTI_APP_CATEGORIES.includes(category)) {
    if (!Array.isArray(appIds) || appIds.length === 0 || appIds.length > 10) {
      return { valid: false, error: '비교 분석 카테고리에서는 appIds가 1~10개 필요합니다' };
    }
    for (const id of appIds) {
      if (typeof id !== 'string' || !APP_ID_FORMAT.test(id)) {
        return { valid: false, error: `잘못된 앱 패키지명입니다: ${String(id).slice(0, 50)}` };
      }
    }
  }

  return { valid: true };
}

// ── 모바일인덱스 Insight API 설정 ──

const MOBILE_INDEX_BASE_URL = 'https://data.mobileindex.com/v1/insight';

/**
 * Bearer 토큰을 마스킹하여 로그에 안전하게 출력
 * @param {string} message - 원본 메시지
 * @returns {string} 토큰이 마스킹된 메시지
 */
function maskApiKey(message) {
  const token = process.env.MOBILE_INDEX_TOKEN;
  if (!token || !message) return message || '';
  const str = String(message);
  return str.split(token).join('***MASKED***');
}

/**
 * 필터 조건을 쿼리 파라미터 문자열로 변환
 * @param {Object} filters - 필터 조건 객체
 * @returns {string} URL 쿼리 파라미터 문자열
 */
function buildQueryParams(category, filters) {
  const params = new URLSearchParams();

  // ── 엔드포인트별 날짜 파라미터 분기 ──
  // date 파라미터를 쓰는 엔드포인트 (startDate/endDate 대신 단일 date)
  const SINGLE_DATE_ENDPOINTS = [
    'chart/top/usage', 'chart/top/revenue',
    'chart/market/rank', 'chart/market/global-rank',
    'usage/usage-rank', 'usage/demographic',
    'usage/trend/top', 'usage/trend/os',
    'usage/rise-rank', 'usage/overlap-rank'
  ];
  // dateMonth (yyyymm) 파라미터를 쓰는 엔드포인트
  const DATE_MONTH_ENDPOINTS = [
    'usage/app/concurrent', 'usage/app/involvement', 'usage/app/break',
    'usage/app/interest', 'usage/app/persona', 'usage/app/persona-relative',
    'usage/app/region', 'usage/competitor/loyalty'
  ];

  if (SINGLE_DATE_ENDPOINTS.includes(category)) {
    // 단일 date: endDate를 date로 사용 (yyyymmdd)
    if (filters.endDate) {
      const d = filters.endDate.replace('-', '') + '01';
      params.set('date', d);
    }
  } else if (DATE_MONTH_ENDPOINTS.includes(category)) {
    // dateMonth: yyyymm
    if (filters.endDate) {
      params.set('date', filters.endDate.replace('-', ''));
    }
  } else {
    // startDate + endDate (yyyymmdd)
    if (filters.startDate) {
      params.set('startDate', filters.startDate.replace('-', '') + '01');
    }
    if (filters.endDate) {
      const [y, m] = filters.endDate.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      params.set('endDate', String(y) + String(m).padStart(2, '0') + String(lastDay));
    }
  }

  // dateType (d/w/m) — 필요한 엔드포인트만
  const NEEDS_DATE_TYPE = [
    'chart/top/usage', 'chart/top/revenue',
    'usage/usage-rank', 'usage/demographic',
    'usage/trend/traffic', 'usage/trend/user', 'usage/trend/top', 'usage/trend/os',
    'usage/rise-rank', 'usage/overlap-rank',
    'apps/usage', 'apps/demographic', 'apps/ranking', 'apps/biz-rate', 'apps/rate'
  ];
  if (NEEDS_DATE_TYPE.includes(category)) {
    const dateTypeMap = { daily: 'd', weekly: 'w', monthly: 'm' };
    params.set('dateType', dateTypeMap[filters.periodType] || 'm');
  }

  // uType — 엔드포인트별 분기
  const NEEDS_UTYPE = [
    'usage/usage-rank', 'usage/rise-rank',
    'apps/usage', 'apps/demographic'
  ];
  if (NEEDS_UTYPE.includes(category)) {
    params.set('uType', filters.uType || 'user');
  }

  // os: total/android/ios
  if (filters.os) {
    params.set('os', filters.os === 'all' ? 'total' : filters.os);
  }

  // gender: total/m/f
  if (filters.gender) {
    const genderMap = { all: 'total', male: 'm', female: 'f' };
    params.set('gender', genderMap[filters.gender] || 'total');
  }

  // age: total/10/20/30/40/50/60
  if (filters.ageRange) {
    params.set('age', filters.ageRange === 'all' ? 'total' : filters.ageRange);
  }

  // market
  if (filters.market && filters.market !== 'all') {
    params.set('market', filters.market);
  }

  // 업종: appCateMain / appCateSub
  if (filters.cate_cd) params.set('appCateMain', filters.cate_cd);
  if (filters.sub_cate_cd) params.set('appCateSub', filters.sub_cate_cd);

  // 단일 앱: pkgName
  if (filters.pkg_name) params.set('pkgName', filters.pkg_name);

  // 복수 앱: 쉼표 구분으로 pkgName 전달
  if (Array.isArray(filters.appIds) && filters.appIds.length > 0) {
    params.set('pkgName', filters.appIds.join(','));
  }

  if (filters.keyword) params.set('keyword', filters.keyword);
  return params.toString();
}

/**
 * API 응답에서 민감 정보(토큰, 내부 URL 등)를 제거
 * @param {Object} data - 원본 API 응답 데이터
 * @returns {Object} 정제된 데이터
 */
function sanitizeResponse(data) {
  if (!data || typeof data !== 'object') return data;

  const token = process.env.MOBILE_INDEX_TOKEN;
  const sensitiveKeys = ['apikey', 'apiKey', 'api_key', 'key', 'token', 'secret', 'authorization', 'bearer', 'access_token'];
  const internalUrlPattern = /https?:\/\/(?:api\.|internal\.|admin\.)/i;

  function sanitize(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => sanitize(item));
    }
    if (obj !== null && typeof obj === 'object') {
      const cleaned = {};
      for (const [k, v] of Object.entries(obj)) {
        // 민감 키 제거
        if (sensitiveKeys.includes(k.toLowerCase())) continue;
        cleaned[k] = sanitize(v);
      }
      return cleaned;
    }
    // 문자열 값에서 토큰 제거
    if (typeof obj === 'string') {
      if (token && obj.includes(token)) {
        return obj.split(token).join('***');
      }
      // 내부 URL 제거
      if (internalUrlPattern.test(obj)) {
        return '***';
      }
    }
    return obj;
  }

  const sanitized = sanitize(data);

  // 최종 검증: JSON 직렬화 후 토큰 포함 여부 확인
  if (token) {
    const serialized = JSON.stringify(sanitized);
    if (serialized.includes(token)) {
      return JSON.parse(serialized.split(token).join('***'));
    }
  }

  return sanitized;
}

// ── POST /api/mobile-index 엔드포인트 ──
// 프론트엔드에서 POST로 받아 실제 API에는 GET으로 요청

app.post('/api/mobile-index', async (req, res) => {
  // Step 1: 입력 검증
  const validation = validateRequest(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.error,
      code: 'VALIDATION_ERROR'
    });
  }

  const { category, filters } = req.body;
  const token = process.env.MOBILE_INDEX_TOKEN;
  const fetchHeaders = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };

  // 복수 앱: 각각 별도 API 호출 후 합치기
  if (Array.isArray(filters.appIds) && filters.appIds.length > 0) {
    try {
      const allResults = [];
      for (const pkgId of filters.appIds) {
        const singleFilters = { ...filters, pkg_name: pkgId, appIds: [] };
        const qp = buildQueryParams(category, singleFilters);
        const url = `${MOBILE_INDEX_BASE_URL}/${category}${qp ? '?' + qp : ''}`;
        console.log('[API REQ multi]', maskApiKey(url));

        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 10000);
        const resp = await fetch(url, { method: 'GET', headers: fetchHeaders, signal: ctrl.signal });
        clearTimeout(tid);

        if (resp.ok) {
          const json = await resp.json();
          const items = json.data || json.result || (Array.isArray(json) ? json : []);
          if (Array.isArray(items)) {
            // 각 항목에 appName/pkgName 주입 (응답에 없을 수 있음)
            const nameMap = filters.appNameMap || {};
            items.forEach(item => {
              if (!item.pkgName) item.pkgName = pkgId;
              if (!item.appName) item.appName = nameMap[pkgId] || item.pkgName;
            });
            console.log('[API DEBUG multi] pkg=' + pkgId, 'keys:', items[0] ? Object.keys(items[0]).join(',') : 'empty');
            allResults.push(...items);
          }
        } else {
          console.error('[API Error multi] status=' + resp.status, 'pkg=' + pkgId);
        }
      }
      const sanitized = sanitizeResponse(allResults);
      console.log('[API OK multi] 총', allResults.length, '건');
      return res.json({ success: true, data: sanitized });
    } catch (error) {
      if (error.name === 'AbortError') {
        return res.status(502).json({ success: false, error: '외부 API 응답 시간 초과', code: 'TIMEOUT' });
      }
      console.error('[API Error multi]', maskApiKey(error.message));
      return res.status(502).json({ success: false, error: '외부 API 연결 실패', code: 'API_ERROR' });
    }
  }

  // 단일 앱 또는 앱 불필요 카테고리
  const queryParams = buildQueryParams(category, filters);
  const apiUrl = `${MOBILE_INDEX_BASE_URL}/${category}${queryParams ? '?' + queryParams : ''}`;
  console.log('[API REQ]', maskApiKey(apiUrl));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const apiResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: fetchHeaders,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!apiResponse.ok) {
      const errBody = await apiResponse.text().catch(() => '');
      console.error('[API Error] 외부 API 응답 오류:', maskApiKey(`status=${apiResponse.status}`));
      console.error('[API Error] 응답 본문:', maskApiKey(errBody.slice(0, 500)));
      console.error('[API Error] 요청 URL:', maskApiKey(apiUrl));
      return res.status(502).json({
        success: false,
        error: '외부 API 연결 실패',
        code: 'API_ERROR'
      });
    }

    const rawData = await apiResponse.json();

    // Step 4: 응답 정제 (민감 정보 제거)
    const sanitized = sanitizeResponse(rawData);

    // 디버그: 응답 구조 확인 (첫 항목만)
    const dataPreview = Array.isArray(sanitized) ? sanitized.slice(0, 1) : sanitized;
    console.log('[API OK] 응답 구조:', JSON.stringify(dataPreview).slice(0, 500));

    return res.json({ success: true, data: sanitized });

  } catch (error) {
    // 타임아웃 처리
    if (error.name === 'AbortError') {
      console.error('[API Timeout] 외부 API 응답 시간 초과');
      return res.status(502).json({
        success: false,
        error: '외부 API 응답 시간 초과',
        code: 'TIMEOUT'
      });
    }

    // 기타 에러 (내부 상세 미노출)
    console.error('[API Error]', maskApiKey(error.message));
    return res.status(502).json({
      success: false,
      error: '외부 API 연결 실패',
      code: 'API_ERROR'
    });
  }
});

// ── GET /api/industries 엔드포인트 (업종 대분류) ──

app.get('/api/industries', async (_req, res) => {
  const token = process.env.MOBILE_INDEX_TOKEN;
  const apiUrl = `${MOBILE_INDEX_BASE_URL}/common/cate-main`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const apiResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!apiResponse.ok) {
      console.error('[API Error] 업종 대분류 조회 실패:', apiResponse.status);
      return res.json({ success: true, data: [] });
    }

    const rawData = await apiResponse.json();
    const sanitized = sanitizeResponse(rawData);

    // API 응답 구조에 맞게 data 추출
    const list = sanitized.data || sanitized.result || sanitized;
    return res.json({ success: true, data: Array.isArray(list) ? list : [] });

  } catch (error) {
    console.error('[API Error] 업종 대분류:', maskApiKey(error.message));
    return res.json({ success: true, data: [] });
  }
});

// ── GET /api/cate-sub 엔드포인트 (업종 소분류) ──

app.get('/api/cate-sub', async (req, res) => {
  const mainCateCd = req.query.main_cate_cd;
  if (!mainCateCd || typeof mainCateCd !== 'string' || mainCateCd.length > 50) {
    return res.status(400).json({ success: false, error: 'main_cate_cd 파라미터가 필요합니다' });
  }

  const token = process.env.MOBILE_INDEX_TOKEN;
  const apiUrl = `${MOBILE_INDEX_BASE_URL}/common/cate-sub?main_cate_cd=${encodeURIComponent(mainCateCd)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const apiResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!apiResponse.ok) {
      console.error('[API Error] 업종 소분류 조회 실패:', apiResponse.status);
      return res.json({ success: true, data: [] });
    }

    const rawData = await apiResponse.json();
    const sanitized = sanitizeResponse(rawData);

    const list = sanitized.data || sanitized.result || sanitized;
    return res.json({ success: true, data: Array.isArray(list) ? list : [] });

  } catch (error) {
    console.error('[API Error] 업종 소분류:', maskApiKey(error.message));
    return res.json({ success: true, data: [] });
  }
});

// ── GET /api/icon 엔드포인트 (아이콘 이미지 프록시) ──

app.get('/api/icon', async (req, res) => {
  const url = req.query.url;
  if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
    return res.status(400).end();
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const imgResp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!imgResp.ok) return res.status(502).end();

    const contentType = imgResp.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const buffer = await imgResp.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(502).end();
  }
});

// ── POST /api/search-batch 엔드포인트 (앱 아이콘 배치 검색) ──

app.post('/api/search-batch', async (req, res) => {
  const { keywords } = req.body || {};
  if (!Array.isArray(keywords) || keywords.length === 0 || keywords.length > 30) {
    return res.status(400).json({ success: false, error: 'keywords 배열이 필요합니다 (최대 30개)' });
  }

  const token = process.env.MOBILE_INDEX_TOKEN;
  const fetchHeaders = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };
  const results = {};

  await Promise.all(keywords.map(async (kw) => {
    if (!kw || typeof kw !== 'string' || kw.length > 100) return;
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 5000);
      const resp = await fetch(
        `${MOBILE_INDEX_BASE_URL}/common/search?keyword=${encodeURIComponent(kw)}`,
        { method: 'GET', headers: fetchHeaders, signal: ctrl.signal }
      );
      clearTimeout(tid);
      if (resp.ok) {
        const json = await resp.json();
        const list = json.data || json.result || (Array.isArray(json) ? json : []);
        if (Array.isArray(list) && list.length > 0) {
          results[kw] = sanitizeResponse(list.slice(0, 3));
        }
      }
    } catch(e) { /* 개별 실패 무시 */ }
  }));

  return res.json({ success: true, data: results });
});

// ── GET /api/search 엔드포인트 (앱 검색) ──

app.get('/api/search', async (req, res) => {
  const keyword = req.query.keyword;
  if (!keyword || typeof keyword !== 'string' || keyword.length > 100) {
    return res.status(400).json({ success: false, error: 'keyword 파라미터가 필요합니다' });
  }

  const token = process.env.MOBILE_INDEX_TOKEN;
  const apiUrl = `${MOBILE_INDEX_BASE_URL}/common/search?keyword=${encodeURIComponent(keyword)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const apiResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!apiResponse.ok) {
      return res.json({ success: true, data: [] });
    }

    const rawData = await apiResponse.json();
    const sanitized = sanitizeResponse(rawData);

    const list = sanitized.data || sanitized.result || sanitized;
    return res.json({ success: true, data: Array.isArray(list) ? list : [] });

  } catch (error) {
    console.error('[API Error] 앱 검색:', maskApiKey(error.message));
    return res.json({ success: true, data: [] });
  }
});

// ── 정적 파일 서빙: localhost에서만 허용, 배포 환경에서는 API 전용 ──
if (!process.env.RENDER) {
  app.use(express.static(path.join(__dirname), {
    index: 'index.html',
    extensions: ['html'],
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  }));
} else {
  // Render 배포 환경: API 전용, 루트 접속 시 안내 메시지
  app.get('/', (_req, res) => {
    res.json({ status: 'ok', message: 'Chart Studio API Server' });
  });
}

// ── 서버 시작 ──
app.listen(PORT, () => {
  console.log(`[Chart Studio] 서버가 http://localhost:${PORT} 에서 실행 중입니다`);
});

module.exports = app;
module.exports.validateRequest = validateRequest;
module.exports.sanitizeResponse = sanitizeResponse;
module.exports.maskApiKey = maskApiKey;
module.exports.buildQueryParams = buildQueryParams;
module.exports.ALLOWED_CATEGORIES = ALLOWED_CATEGORIES;
module.exports.APP_REQUIRED_CATEGORIES = APP_REQUIRED_CATEGORIES;
module.exports.MULTI_APP_CATEGORIES = MULTI_APP_CATEGORIES;
