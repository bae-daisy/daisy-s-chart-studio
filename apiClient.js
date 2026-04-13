// ── API 클라이언트 (프록시 서버 통신 + 응답 변환) ──
const ApiClient = {
  // API 서버 URL: 같은 서버면 '/api', GitHub Pages면 Render 서버로
  BASE_URL: (function() {
    // localhost에서는 같은 서버 사용
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return '/api';
    // GitHub Pages 등 정적 호스팅에서는 Render API 서버 사용
    // ⚠️ 아래 URL을 실제 Render 서비스 URL로 변경하세요
    return 'https://daisy-s-chart-studio.onrender.com/api';
  })(),

  // 카테고리 → Parser 타입 매핑
  _CATEGORY_TO_TYPE: {
    // chart
    'chart/top/usage': 'ranking_users',
    'chart/top/revenue': 'ranking_users',
    'chart/market/rank': 'ranking_users',
    'chart/market/global-rank': 'ranking_users',
    'chart/market/realtime-rank': 'ranking_users',
    // usage
    'usage/usage-rank': 'ranking_users',
    'usage/demographic': 'demo_compare',
    'usage/trend/traffic': 'traffic_users',
    'usage/trend/user': 'demo_compare',
    'usage/trend/rank': 'ranking_users',
    'usage/trend/top': 'compare_users',
    'usage/trend/os': 'compare_users',
    'usage/rise-rank': 'ranking_users',
    'usage/overlap-rank': 'ranking_users',
    'usage/app/concurrent': 'ranking_users',
    'usage/app/involvement': 'ranking_users',
    'usage/app/break': 'ranking_users',
    'usage/app/interest': 'ranking_users',
    'usage/app/persona': 'demo_compare',
    'usage/app/persona-relative': 'demo_compare',
    'usage/app/region': 'ranking_users',
    'usage/competitor/install-delete': 'compare_users',
    'usage/competitor/loyalty': 'compare_users',
    'usage/retention': 'compare_users',
    // apps
    'apps/summary': 'ranking_users',
    'apps/info': 'ranking_users',
    'apps/ranking-history': 'ranking_users',
    'apps/market-info': 'ranking_users',
    'apps/timeline': 'traffic_users',
    'apps/rate-total': 'ranking_users',
    'apps/rate': 'ranking_users',
    'apps/usage': 'traffic_users',
    'apps/demographic': 'demo_compare',
    'apps/ranking': 'ranking_users',
    'apps/biz-rate': 'ranking_users'
  },

  // 사용 가능한 API 카테고리 목록
  API_CATEGORIES: {
    // MI CHART
    'chart/top/usage': '통합 순위 > 사용자 수 순위',
    'chart/top/revenue': '통합 순위 > 매출 순위',
    'chart/market/rank': '일간 마켓별 순위 (대한민국)',
    'chart/market/global-rank': '일간 마켓별 순위 (글로벌)',
    'chart/market/realtime-rank': '실시간 마켓별 순위',
    // 사용량 인덱스
    'usage/usage-rank': '업종 사용량 순위',
    'usage/demographic': '데모그래픽 사용량 순위',
    'usage/trend/traffic': '업종 트래픽 분석',
    'usage/trend/user': '업종 데모그래픽 분석',
    'usage/trend/rank': '업종 순위 변동 트렌드',
    'usage/trend/top': '업종별 상위 앱 비교',
    'usage/trend/os': '업종별 OS 비교',
    'usage/rise-rank': '급상승 순위',
    'usage/overlap-rank': '동시 사용 앱 분석',
    'usage/app/concurrent': '사용 앱 수별 분포',
    'usage/app/involvement': '관여도별 분포',
    'usage/app/break': '이탈 고객 분석',
    'usage/app/interest': '관심 업종 분석',
    'usage/app/persona': '페르소나 분석 (절대값)',
    'usage/app/persona-relative': '페르소나 분석 (상대값)',
    'usage/app/region': '지역 분석',
    'usage/competitor/install-delete': '신규 설치 건 삭제율',
    'usage/competitor/loyalty': '성별/연령별 충성도 비교',
    'usage/retention': '신규 설치 건 재방문율',
    // 앱 상세
    'apps/summary': '앱 Summary (데이터)',
    'apps/info': '앱 기본 정보',
    'apps/ranking-history': '마켓별 순위 히스토리',
    'apps/market-info': 'Summary (마켓 기본 정보)',
    'apps/timeline': '타임라인 분석',
    'apps/rate-total': '평점 (Total)',
    'apps/rate': '평점',
    'apps/usage': '기본 사용량 분석',
    'apps/demographic': '데모그래픽 분석',
    'apps/ranking': '순위 히스토리',
    'apps/biz-rate': '점유율 히스토리'
  },

  // 중복 요청 취소용 AbortController
  _currentController: null,

  /**
   * 모바일인덱스 데이터 조회 (프록시 서버 경유)
   * @param {string} category - 데이터 카테고리 키 (예: 'chart/top/usage')
   * @param {Object} filters - 필터 조건
   * @returns {Promise<{type: string, chartKind: string, meta: Object, headers: string[], data: string[][]}>}
   */
  async fetchData(category, filters) {
    // 이전 요청이 있으면 취소
    if (this._currentController) {
      this._currentController.abort();
    }
    this._currentController = new AbortController();

    let response;
    try {
      response = await fetch(this.BASE_URL + '/mobile-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, filters }),
        signal: this._currentController.signal
      });
    } catch (err) {
      this._currentController = null;
      if (err.name === 'AbortError') throw err;
      throw new Error('서버에 연결할 수 없습니다');
    }

    this._currentController = null;

    if (response.status === 429) {
      throw new Error('잠시 후 다시 시도해주세요');
    }

    if (response.status === 400) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || '요청이 올바르지 않습니다');
    }

    if (response.status === 502) {
      throw new Error('데이터를 가져올 수 없습니다');
    }

    if (!response.ok) {
      throw new Error('데이터를 가져올 수 없습니다');
    }

    const json = await response.json();
    return this.transformResponse(category, json.data);
  },

  /**
   * API JSON 응답 → Parser 호환 형식 변환
   */
  transformResponse(category, rawJson) {
    let h = [];
    let d = [];

    // API 응답 구조 자동 감지
    if (rawJson && typeof rawJson === 'object') {
      // Case 1: {headers: [], rows: [[]]} 형태
      if (Array.isArray(rawJson.headers) && Array.isArray(rawJson.rows)) {
        h = rawJson.headers.slice();
        d = rawJson.rows.map(r => (Array.isArray(r) ? r.slice() : []));
      }
      // Case 2: {data: [{객체}, ...]} 형태 (모바일인덱스 실제 응답)
      else if (rawJson.data && Array.isArray(rawJson.data) && rawJson.data.length > 0) {
        return this._objectArrayToTable(category, rawJson.data);
      }
      // Case 3: [{객체}, ...] 배열 자체
      else if (Array.isArray(rawJson) && rawJson.length > 0 && typeof rawJson[0] === 'object') {
        return this._objectArrayToTable(category, rawJson);
      }
      // Case 4: 빈 data 배열
      else if (rawJson.data && Array.isArray(rawJson.data) && rawJson.data.length === 0) {
        h = ['항목', '값'];
        d = [['데이터 없음', '조회 조건을 확인해주세요']];
      }
    }

    while (h.length < 2) h.push('');
    for (let i = 0; i < d.length; i++) {
      while (d[i].length < h.length) d[i].push('');
      if (d[i].length > h.length) d[i] = d[i].slice(0, h.length);
    }

    const type = this._CATEGORY_TO_TYPE[category] || 'unknown';
    const chartKind = Parser.recommendChart(type, h, d);
    Parser._cleanNumericCommas(h, d);
    Parser._convertPkgToAppName(h, d);

    return {
      type, chartKind,
      meta: { reportType: '', filterInfo: '', appName: '' },
      headers: h, data: d
    };
  },

  /**
   * 객체 배열 → headers + rows 테이블 변환
   */
  _objectArrayToTable(category, arr) {
    if (!arr || arr.length === 0) {
      return { type: 'unknown', chartKind: 'table', meta: { reportType: '', filterInfo: '', appName: '' }, headers: ['항목', '값'], data: [] };
    }

    // 한글 헤더 매핑
    const LABEL_MAP = {
      pkgName: '패키지명', appName: '앱명', date: '날짜',
      value: '전체', valueAos: 'Android', valueIos: 'iOS', valueAdd: '증감',
      userCnt: '사용자 수', timeCnt: '사용시간', installCnt: '신규설치',
      deviceCnt: '활성기기', avgTime: '1인당 평균 사용시간',
      rank: '순위', prevRank: '이전순위', rankChange: '순위변동',
      bizRate: '점유율', pubName: '퍼블리셔',
      maleCnt: '남성', femaleCnt: '여성',
      age10: '10대', age20: '20대', age30: '30대', age40: '40대', age50: '50대', age60: '60대이상',
      os: 'OS', gender: '성별', age: '연령',
      cateMain: '업종대분류', cateSub: '업종소분류',
      avgDay: '1인당 평균 사용일수', avgDayCnt: '1인당 평균 사용일수',
      totalTime: '총 사용시간', totalTimeCnt: '총 사용시간',
      maleRate: '남성비율', femaleRate: '여성비율'
    };

    // 날짜 포맷 변환
    function fmtDate(v) {
      var s = String(v || '');
      if (/^\d{8}$/.test(s)) return s.slice(0, 4) + '-' + s.slice(4, 6);
      if (/^\d{6}$/.test(s)) return s.slice(0, 4) + '-' + s.slice(4, 6);
      return s;
    }

    // API 응답에서 앱 아이콘 URL을 바로 캐시 (별도 검색 불필요)
    if (typeof SvgCharts !== 'undefined' && SvgCharts._iconCache) {
      var _cached = false;
      arr.forEach(function(obj) {
        var icon = obj.iconUrl || obj.icon_url || '';
        var name = obj.appName || '';
        var pkg = obj.pkgName || obj.pkg_name || '';
        if (icon) {
          if (name) { SvgCharts._iconCache[name] = icon; _cached = true; }
          if (pkg) { SvgCharts._iconCache[pkg] = icon; _cached = true; }
        }
      });
      if (_cached) {
        try { localStorage.setItem('cs-icon-cache', JSON.stringify(SvgCharts._iconCache)); } catch(e) {}
      }
    }

    // 복수 앱 + 날짜 있으면 피벗 (날짜 행, 앱 열)
    var appNames = [];
    var dates = [];
    var hasDate = arr[0] && ('date' in arr[0]);
    var hasApp = arr[0] && ('appName' in arr[0]);
    if (hasDate && hasApp) {
      // 앱 이름 목록 (순서 유지)
      var appSet = new Set();
      arr.forEach(function(r) { if (r.appName) appSet.add(r.appName); });
      appNames = Array.from(appSet);
      // 날짜 목록 (순서 유지)
      var dateSet = new Set();
      arr.forEach(function(r) { if (r.date) dateSet.add(String(r.date)); });
      dates = Array.from(dateSet);
    }

    // ── 데모그래픽 카테고리 피벗 변환 ──
    var DEMO_CATEGORIES = ['apps/demographic', 'usage/demographic', 'usage/app/persona', 'usage/app/persona-relative'];

    var DEMO_ROWS = [
      { label: '남성',     calc: function(o) { return o.userM || 0; } },
      { label: '여성',     calc: function(o) { return o.userF || 0; } },
      { label: '10대 이하', calc: function(o) { return Math.round(((o.userF10 || 0) + (o.userM10 || 0)) * 100) / 100; } },
      { label: '20대',     calc: function(o) { return Math.round(((o.userF20 || 0) + (o.userM20 || 0)) * 100) / 100; } },
      { label: '30대',     calc: function(o) { return Math.round(((o.userF30 || 0) + (o.userM30 || 0)) * 100) / 100; } },
      { label: '40대',     calc: function(o) { return Math.round(((o.userF40 || 0) + (o.userM40 || 0)) * 100) / 100; } },
      { label: '50대',     calc: function(o) { return Math.round(((o.userF50 || 0) + (o.userM50 || 0)) * 100) / 100; } },
      { label: '60대 이상', calc: function(o) { return Math.round(((o.userF60 || 0) + (o.userM60 || 0)) * 100) / 100; } },
    ];

    if (DEMO_CATEGORIES.indexOf(category) !== -1 && arr[0] && ('userF' in arr[0])) {
      // 앱 이름 추출 (순서 유지) — appName 없으면 pkgName fallback
      var demoAppSet = [];
      var demoAppSeen = {};
      var _pkgToName = Parser._PKG_TO_NAME || {};
      arr.forEach(function(r) {
        var name = r.appName || _pkgToName[r.pkgName] || r.pkgName || ('앱' + (demoAppSet.length + 1));
        if (!demoAppSeen[name]) {
          demoAppSeen[name] = true;
          demoAppSet.push(name);
          r._resolvedName = name;
        } else {
          r._resolvedName = name;
        }
      });
      var demoAppNames = demoAppSet;

      // 앱별 데이터 맵: resolvedName → object
      var demoAppMap = {};
      arr.forEach(function(r) {
        if (r._resolvedName) demoAppMap[r._resolvedName] = r;
      });

      var h = ['분류'].concat(demoAppNames);
      var d = DEMO_ROWS.map(function(row) {
        return [row.label].concat(demoAppNames.map(function(app) {
          var obj = demoAppMap[app];
          return obj ? String(row.calc(obj)) : '';
        }));
      });

      var type = this._CATEGORY_TO_TYPE[category] || 'unknown';
      var chartKind = Parser.recommendChart(type, h, d);
      Parser._cleanNumericCommas(h, d);
      return { type: type, chartKind: chartKind, meta: { reportType: '', filterInfo: '', appName: '' }, headers: h, data: d };
    }

    // 앱이 2개 이상이고 날짜가 있으면 피벗
    if (appNames.length >= 2 && dates.length >= 1) {
      // 값 필드 결정 (value가 있으면 value, 없으면 첫 번째 숫자 필드)
      var valueKey = 'value';
      if (!(valueKey in arr[0])) {
        var numKeys = Object.keys(arr[0]).filter(function(k) {
          return typeof arr[0][k] === 'number' && k !== 'date' && k !== 'rank';
        });
        if (numKeys.length > 0) valueKey = numKeys[0];
      }

      // 데이터 맵: date → appName → value
      var dataMap = {};
      arr.forEach(function(r) {
        var d = String(r.date);
        if (!dataMap[d]) dataMap[d] = {};
        dataMap[d][r.appName] = r[valueKey] != null ? String(r[valueKey]) : '';
      });

      var h = ['날짜'].concat(appNames);
      var d = dates.map(function(dt) {
        return [fmtDate(dt)].concat(appNames.map(function(app) {
          return (dataMap[dt] && dataMap[dt][app]) || '';
        }));
      });

      var type = this._CATEGORY_TO_TYPE[category] || 'unknown';
      var chartKind = Parser.recommendChart(type, h, d);
      Parser._cleanNumericCommas(h, d);
      return { type: type, chartKind: chartKind, meta: { reportType: '', filterInfo: '', appName: '' }, headers: h, data: d };
    }

    // 단일 앱 또는 피벗 불가 → 기본 테이블
    // OS 전체 요청 시 Android/iOS 개별 열 제거
    var SKIP_KEYS = ['iconUrl', 'icon_url', 'appIcon', 'igawCateCode', 'pkgName', 'valueAos', 'valueIos', 'valueAdd'];
    var allKeys = [];
    var keySet = new Set();
    arr.forEach(function(obj) { Object.keys(obj).forEach(function(k) { if (!keySet.has(k)) { keySet.add(k); allKeys.push(k); } }); });
    var filteredKeys = allKeys.filter(function(k) { return !SKIP_KEYS.includes(k); });
    var h = filteredKeys.map(function(k) { return LABEL_MAP[k] || k; });

    var d = arr.map(function(obj) {
      return filteredKeys.map(function(k) {
        var v = obj[k];
        if (v == null) return '';
        if (k === 'date' || k === 'startDate' || k === 'endDate') return fmtDate(v);
        return String(v);
      });
    });

    var type = this._CATEGORY_TO_TYPE[category] || 'unknown';
    var chartKind = Parser.recommendChart(type, h, d);
    Parser._cleanNumericCommas(h, d);
    Parser._convertPkgToAppName(h, d);

    return { type: type, chartKind: chartKind, meta: { reportType: '', filterInfo: '', appName: '' }, headers: h, data: d };
  },

  /**
   * 업종 대분류 목록 조회
   * @returns {Promise<Array>}
   */
  async getIndustries() {
    try {
      const response = await fetch(this.BASE_URL + '/industries');
      if (!response.ok) return [];
      const json = await response.json();
      return Array.isArray(json.data) ? json.data : [];
    } catch {
      return [];
    }
  },

  /**
   * 업종 소분류 목록 조회
   * @param {string} mainCateCd - 대분류 코드
   * @returns {Promise<Array>}
   */
  async getSubCategories(mainCateCd) {
    try {
      const response = await fetch(this.BASE_URL + '/cate-sub?main_cate_cd=' + encodeURIComponent(mainCateCd));
      if (!response.ok) return [];
      const json = await response.json();
      return Array.isArray(json.data) ? json.data : [];
    } catch {
      return [];
    }
  },

  /**
   * 앱 검색
   * @param {string} keyword - 검색어
   * @returns {Promise<Array>}
   */
  async searchApps(keyword) {
    try {
      const response = await fetch(this.BASE_URL + '/search?keyword=' + encodeURIComponent(keyword));
      if (!response.ok) return [];
      const json = await response.json();
      return Array.isArray(json.data) ? json.data : [];
    } catch {
      return [];
    }
  }
};
