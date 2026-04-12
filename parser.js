// ── CSV 파싱 + 데이터 타입 감지 + 자동 차트 추천 ──
const Parser = {
  parseCSV(text) {
    return text.split('\n').map(l => l.trim()).filter(l => l).map(line => {
      const result = []; let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (inQ && line[i+1]==='"') { cur+='"'; i++; } else inQ=!inQ; }
        else if (ch === ',' && !inQ) { result.push(cur.trim()); cur=''; }
        else cur += ch;
      }
      result.push(cur.trim());
      return result;
    });
  },

  // ── 섹션 마커/제목 행 감지 (예: [MAU], MAU, "시트제목" 등) ──
  _isSectionOrTitleRow(row) {
    if (!row) return false;
    const nonEmpty = row.filter(c => c !== '');
    // 비어있는 행
    if (nonEmpty.length === 0) return true;
    // 셀 1개만 있고 대괄호 마커이거나 짧은 제목 (MI-INSIGHT 메타 행은 제외)
    if (nonEmpty.length === 1) {
      const v = nonEmpty[0].trim();
      if (/^\[.+\]$/.test(v)) return true; // [MAU] 같은 섹션 마커
      // MI-INSIGHT 메타 행은 건너뛰지 않음
      if (/^(MI-INSIGHT|내 앱:|OS:|기간:)/i.test(v)) return false;
      if (v.includes('>')) return false; // "사용량 순위>사용자 수 순위" 같은 경로
      if (v.length <= 20 && !/\d{4}[.\-\/]/.test(v)) return true; // 짧은 제목 (날짜 아닌)
    }
    return false;
  },

  // ── 선행 빈 열 제거 (엑셀 들여쓰기 대응) ──
  _trimLeadingEmptyCols(rows) {
    if (rows.length === 0) return rows;
    // 모든 행에서 첫 N열이 비어있으면 제거
    let emptyPrefix = Infinity;
    for (const row of rows) {
      let cnt = 0;
      while (cnt < row.length && row[cnt] === '') cnt++;
      if (cnt < row.length) emptyPrefix = Math.min(emptyPrefix, cnt);
    }
    if (emptyPrefix > 0 && emptyPrefix < Infinity) {
      return rows.map(r => r.slice(emptyPrefix));
    }
    return rows;
  },

  extractMeta(rows) {
    let reportType='', filterInfo='', appName='';
    const r1 = (rows[1]&&rows[1][0])||'', r2 = (rows[2]&&rows[2][0])||'';
    if (r1.startsWith('내 앱:')) { appName=r1; reportType=r2; filterInfo=(rows[3]&&rows[3][0])||''; }
    else { reportType=r1; filterInfo=r2; }
    return { reportType, filterInfo, appName };
  },

  parseFile(text, forceHeaderIdx) {
    let rows = this.parseCSV(text);
    if (rows.length < 2) return null;

    // 선행 빈 열 제거 (엑셀 들여쓰기 대응)
    rows = this._trimLeadingEmptyCols(rows);

    // 사용자가 헤더 행을 직접 지정한 경우
    if (forceHeaderIdx != null && forceHeaderIdx >= 0 && forceHeaderIdx < rows.length) {
      return this._buildResult(rows, forceHeaderIdx, sectionTitle);
    }

    // 섹션 마커/제목 행 건너뛰기: 앞쪽의 [MAU], 빈 행, 짧은 제목 등 제거
    let skipCount = 0;
    let sectionTitle = ''; // 섹션 제목 보존
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      if (this._isSectionOrTitleRow(rows[i])) {
        // 비어있지 않은 섹션 제목 저장
        const nonEmpty = rows[i].filter(c => c !== '');
        if (nonEmpty.length === 1) {
          const v = nonEmpty[0].trim().replace(/^\[|\]$/g, '');
          if (v) sectionTitle = v;
        }
        skipCount = i + 1;
      }
      else break;
    }
    if (skipCount > 0) {
      rows = rows.slice(skipCount);
      if (rows.length < 2) return null;
      // 섹션 마커 제거 후 다시 빈 열 정리
      rows = this._trimLeadingEmptyCols(rows);
    }

    // 행이 7개 미만이면 짧은 데이터 → 헤더를 스마트하게 찾기
    if (rows.length < 7) {
      const _isNum = (c) => { if (c === '') return true; return !isNaN(Number(c.replace(/,/g, '').replace(/%$/, ''))); };
      for (let i = 0; i < rows.length - 1; i++) {
        const row = rows[i];
        if (!row || row.length < 2) continue;
        const nonEmpty = row.filter(c => c !== '');
        const textCells = nonEmpty.filter(c => !_isNum(c)).length;
        if (textCells >= Math.max(2, Math.ceil(nonEmpty.length * 0.5))) {
          return this._buildResult(rows, i, sectionTitle);
        }
      }
      // 텍스트 헤더를 못 찾으면 첫 번째 다중열 행을 헤더로
      for (let i = 0; i < rows.length - 1; i++) {
        if (rows[i] && rows[i].length >= 2) return this._buildResult(rows, i, sectionTitle);
      }
      return null;
    }

    const meta = this.extractMeta(rows);
    const rt = meta.reportType;

    // 빈 행 건너뛰고 헤더 찾기 (MI형식: 보통 4~8행, 외부 데이터: 0~3행)
    let headerIdx = -1;
    // 헤더 후보 판별: 숫자/퍼센트가 아닌 텍스트 셀이 과반수인 행
    const _isNumLike = (c) => {
      if (c === '') return true;
      const v = c.replace(/,/g, '').replace(/%$/, '');
      return !isNaN(Number(v));
    };
    const _isHeaderLike = (row) => {
      if (!row || row.length <= 1) return false;
      if (row.every(c => c === '')) return false;
      const nonEmpty = row.filter(c => c !== '');
      const textCells = nonEmpty.filter(c => !_isNumLike(c)).length;
      return textCells >= Math.max(2, Math.ceil(nonEmpty.length * 0.5));
    };
    // 1차: MI형식 (3행 이후)
    for (let i = 3; i < Math.min(rows.length, 12); i++) {
      const row = rows[i];
      if (!_isHeaderLike(row)) continue;
      const next = rows[i+1];
      if (next && next.length > 1 && next.some(c => c !== '')) { headerIdx = i; break; }
    }
    // 2차: 0~2행에서 헤더 탐색 (외부 데이터)
    if (headerIdx === -1) {
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        const row = rows[i];
        if (this._isSectionOrTitleRow(row)) continue; // 섹션 마커 건너뛰기
        if (!_isHeaderLike(row)) continue;
        const next = rows[i+1];
        if (next && next.length > 1 && next.some(c => c !== '')) { headerIdx = i; break; }
      }
    }
    if (headerIdx === -1) {
      // 헤더를 자동으로 찾지 못함
      // 열이 2개 이상인 행이 있어야 의미 있는 데이터
      const hasMultiCol = rows.some(r => r.length >= 2 && r.filter(c => c !== '').length >= 2);
      if (!hasMultiCol) return null;
      return { needsHeaderSelect: true, rawRows: rows, rawText: text };
    }

    const headers = rows[headerIdx];
    const data = rows.slice(headerIdx+1).filter(r => r.length >= headers.length-1 && r[0] !== '');

    // 타입 감지
    let type = 'unknown';
    if (rt.includes('사용량 순위>사용자 수 순위')) type = 'ranking_users';
    else if (rt.includes('사용량 순위>총 사용시간 순위')) type = 'ranking_time';
    else if (rt.includes('사용량 순위>1인당 평균 사용시간 순위')) type = 'ranking_avg_time';
    else if (rt.includes('사용량 순위>활성 기기 순위')) type = 'ranking_devices';
    else if (rt.includes('사용량 순위>신규 설치 건 순위')) type = 'ranking_installs';
    else if (rt.includes('데모그래픽 사용량 순위')) type = 'demographic_ranking';
    else if (rt.includes('업종 트래픽 분석>업종 사용자 수')) type = 'traffic_users';
    else if (rt.includes('업종 트래픽 분석>업종 사용시간')) type = 'traffic_time';
    else if (rt.includes('업종 트래픽 분석>업종 신규 설치 건')) type = 'traffic_installs';
    else if (rt.includes('업종 데모그래픽 분석>업종 사용자 구성')) type = 'industry_demo_users';
    else if (rt.includes('업종 데모그래픽 분석>업종 연령별 사용시간')) type = 'industry_demo_time';
    else if (rt.includes('충성 고객 분석>사용 앱 수별 분포')) type = 'loyalty_distribution';
    else if (rt.includes('이탈 고객 분석')) type = 'churn_analysis';
    else if (rt.includes('기본 사용량 비교 분석>사용자 수')) type = 'compare_users';
    else if (rt.includes('기본 사용량 비교 분석>총 사용 시간')) type = 'compare_time';
    else if (rt.includes('기본 사용량 비교 분석>1인당 평균 사용 시간')) type = 'compare_avg_time';
    else if (rt.includes('기본 사용량 비교 분석>1인당 평균 사용일 수')) type = 'compare_avg_days';
    else if (rt.includes('기본 사용량 비교 분석>활성 기기 수')) type = 'compare_devices';
    else if (rt.includes('기본 사용량 비교 분석>신규 설치 건 수')) type = 'compare_installs';
    else if (rt.includes('데모그래픽 비교 분석>사용자 구성 비교')) type = 'demo_compare';
    else if (rt.includes('데모그래픽 비교 분석>연령별 사용시간 구성')) type = 'demo_time_compare';
    else if (rt.includes('리텐션 비교 분석>신규 설치건 재 방문율')) type = 'retention_revisit';
    else if (rt.includes('리텐션 비교 분석>신규 설치 건 삭제율')) type = 'retention_delete';
    else if (rt.includes('충성도 비교 분석>충성도 비교')) type = 'loyalty_compare';
    else if (rt.includes('경쟁앱에서 유입') || rt.includes('유입, 유지, 이탈자 비교 분석>경쟁앱에서 유입')) type = 'flow_in';
    else if (rt.includes('경쟁앱으로 이탈') || rt.includes('유입, 유지, 이탈자 비교 분석>경쟁앱으로 이탈')) type = 'flow_out';
    else if (rt.includes('경쟁앱으로 이탈')) type = 'flow_churn';
    else if (rt.includes('유입, 유지율 비교') || rt.includes('유입, 유지, 이탈자 비교 분석>유입')) type = 'flow_retention';
    else if (rt.includes('경쟁앱 교차 사용 분석')) type = 'cross_usage';
    else if (rt.includes('경쟁앱 교차 사용자 분석')) type = 'cross_users';

    // 자동 차트 추천
    const chartKind = this.recommendChart(type, headers, data);

    // 숫자 열의 쉼표 제거
    this._cleanNumericCommas(headers, data);

    // 패키지명 → 앱명 자동 변환
    this._convertPkgToAppName(headers, data);

    // 섹션 제목이 있고 reportType이 비어있거나 날짜 같은 값이면 보정
    if (sectionTitle && (!meta.reportType || /^\d{4}[.\-\/]/.test(meta.reportType))) {
      meta.reportType = sectionTitle;
    }

    return { type, chartKind, meta, headers, data };
  },

  // 패키지명 → 앱명 변환 맵
  _PKG_TO_NAME: {
    'com.netflix.mediaclient': 'Netflix(넷플릭스)',
    'net.cj.cjhv.gs.tving': 'TVING',
    'kr.co.captv.pooqV2': 'Wavve (웨이브)',
    'com.coupang.mobile.play': '쿠팡플레이',
    'com.disney.disneyplus': 'Disney+',
    'com.frograms.wplay': '왓챠',
    'com.coupang.mobile': '쿠팡',
    'com.coupang.mobile.eats': '쿠팡이츠',
    'com.kakao.talk': '카카오톡',
    'com.nhn.android.search': '네이버',
    'com.sampleapp': '배달의민족',
  },

  // 데이터에서 패키지명 열을 찾아 앱명으로 변환
  _convertPkgToAppName(headers, data) {
    // "패키지명" 열 찾기
    const pkgIdx = headers.findIndex(h => /패키지|package|pkg/i.test(h));
    if (pkgIdx < 0) return;

    // 앱명 열이 이미 있는지 확인
    const nameIdx = headers.findIndex(h => /앱명|앱 이름|이름/i.test(h));

    // 앱명 열이 있으면: 패키지명 열만 숨기기 (데이터에서 제거)
    // 앱명 열이 없으면: 패키지명 열을 앱명으로 변환
    if (nameIdx >= 0 && nameIdx !== pkgIdx) {
      // 앱명 열이 따로 있으니 패키지명 열 제거
      headers.splice(pkgIdx, 1);
      data.forEach(r => r.splice(pkgIdx, 1));
    } else {
      // 패키지명 → 앱명으로 변환
      headers[pkgIdx] = '앱 이름';
      const map = this._PKG_TO_NAME;
      data.forEach(r => {
        const pkg = (r[pkgIdx] || '').trim();
        if (map[pkg]) {
          r[pkgIdx] = map[pkg];
        } else if (pkg.includes('.')) {
          // 알 수 없는 패키지명: 마지막 세그먼트를 이름으로
          const parts = pkg.split('.');
          r[pkgIdx] = parts[parts.length - 1];
        }
      });
    }
  },

  // ── 사용자 지정 헤더로 결과 빌드 ──
  _buildResult(rows, headerIdx, sectionTitle) {
    const headers = rows[headerIdx];
    if (!headers || headers.length < 2) return null;
    const data = rows.slice(headerIdx + 1).filter(r => r.length >= headers.length - 1 && r.some(c => c !== ''));
    if (data.length === 0) return null;

    // 숫자 열의 쉼표 제거 (예: "824,403" → "824403")
    this._cleanNumericCommas(headers, data);

    const type = 'unknown';
    const chartKind = this.recommendChart(type, headers, data);
    this._convertPkgToAppName(headers, data);
    // 헤더 위쪽에서 섹션 제목/시트명 추출 (reportType으로 활용)
    let reportType = sectionTitle || '';
    if (!reportType) {
      for (let i = headerIdx - 1; i >= 0; i--) {
        const row = rows[i];
        if (!row) continue;
        const nonEmpty = row.filter(c => c !== '');
        if (nonEmpty.length === 1) {
          const v = nonEmpty[0].trim().replace(/^\[|\]$/g, ''); // [MAU] → MAU
          if (v) { reportType = v; break; }
        }
      }
    }
    const meta = { reportType, filterInfo: '', appName: '' };
    return { type, chartKind, meta, headers, data };
  },

  // ── 숫자 열의 쉼표 제거 ──
  _cleanNumericCommas(headers, data) {
    for (let ci = 1; ci < headers.length; ci++) {
      // 해당 열의 비어있지 않은 값 중 쉼표 포함 숫자가 과반수면 정리
      const nonEmpty = data.map(r => r[ci]).filter(c => c != null && c !== '');
      const commaNumCount = nonEmpty.filter(c => /^-?[\d,]+\.?\d*%?$/.test(String(c).trim())).length;
      if (commaNumCount >= nonEmpty.length * 0.5) {
        data.forEach(r => {
          if (r[ci] != null) r[ci] = String(r[ci]).replace(/,/g, '');
        });
      }
    }
  },

  // ── 데이터 타입 → 최적 차트 자동 추천 ──
  recommendChart(type, headers, data) {
    // 랭킹 → 수평 바
    if (type.startsWith('ranking_')) return 'horizontalBar';
    // 트래픽/비교 분석 (시계열) → 라인
    if (type.startsWith('traffic_') || type.startsWith('compare_')) return 'line';
    // 충성 고객 분포 → 도넛
    if (type === 'loyalty_distribution') return 'donut';
    // 리텐션 → 히트맵
    if (type.startsWith('retention_')) return 'heatmap';
    // 데모그래픽 → 수평 바
    if (type.startsWith('demo_') || type.startsWith('industry_demo_')) return 'splitBar';
    // 교차 사용 → 히트맵
    if (type === 'cross_usage') return 'heatmap';
    // 유입 분석 → 플로우 카드
    if (type === 'flow_in' || type === 'flow_out') return 'flowCard';
    // 유입/유지율 → 누적 막대
    if (type === 'flow_retention') return 'stackedBar';
    // 충성도 비교 → 스캐터 (X: 사용시간, Y: 사용일수)
    if (type === 'loyalty_compare') return 'scatter';
    // 교차 사용자 분석 → 벤 다이어그램
    if (type === 'cross_users') return 'venn';
    // 나머지 → 테이블
    if (['churn_analysis','flow_churn','flow_retention','loyalty_compare','demographic_ranking'].includes(type)) return 'table';

    // unknown → 데이터 프로파일링
    return this._profileRecommend(headers, data);
  },

  // ── 데이터 프로파일링 기반 추천 목록 (unknown 타입용) ──
  _profileData(headers, data) {
    const _parseNum = (v) => { const s = String(v||'').replace(/,/g,'').replace(/%$/,''); return Number(s); };
    const numCols = headers.filter((_,i) => i>0 && data.some(r => !isNaN(_parseNum(r[i])))).length;
    const hasDate = data.some(r => /\d+\/\d+|\d{4}[-\.]\d{2}|^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\/]\d{2,4}$/i.test(String(r[0]).trim()));
    const rowCount = data.length;
    const hasPct = data.some(r => r.some(c => /%$/.test(String(c||'').trim())));
    const vals = numCols >= 1 ? data.map(r => _parseNum(r[1]) || 0) : [];
    const sum = vals.reduce((a,b) => a+b, 0);
    const isPctLike = sum > 85 && sum < 115;
    return { numCols, hasDate, rowCount, hasPct, isPctLike };
  },

  _profileRecommend(headers, data) {
    const p = this._profileData(headers, data);
    if (p.hasDate && p.rowCount >= 5) return 'line';
    if (p.numCols >= 2) return 'verticalBar';
    if (p.numCols === 1 && p.rowCount <= 6) {
      if (p.isPctLike) return 'donut';
    }
    if (p.numCols === 1 && p.rowCount > 6) return 'horizontalBar';
    if (p.rowCount <= 15) return 'verticalBar';
    return 'table';
  },

  // ── 데이터 프로파일링 기반 추천 차트 목록 반환 ──
  getRecommendedKinds(type, headers, data) {
    // 알려진 타입이면 RECOMMENDED 매핑 사용
    if (type && type !== 'unknown' && T.RECOMMENDED[type]) {
      return T.RECOMMENDED[type];
    }
    // unknown → 데이터 프로파일링으로 추천 목록 생성
    const p = this._profileData(headers, data);
    const rec = [];

    if (p.hasDate && p.rowCount >= 3) {
      rec.push('line', 'combo');
      if (p.numCols >= 2) rec.push('verticalBar');
    } else if (p.numCols >= 2 && p.rowCount >= 3) {
      rec.push('verticalBar', 'horizontalBar');
      if (p.rowCount >= 5) rec.push('line', 'combo');
      if (p.numCols >= 3) rec.push('stackedBar');
    } else if (p.numCols === 1) {
      if (p.isPctLike) {
        rec.push('donut', 'horizontalBar');
      } else if (p.rowCount <= 8) {
        rec.push('horizontalBar', 'verticalBar');
        if (p.rowCount <= 5) rec.push('donut');
      } else {
        rec.push('horizontalBar');
      }
    }

    if (p.rowCount > 15) rec.push('table');
    if (p.hasPct && !rec.includes('donut')) rec.push('donut');

    return rec.length > 0 ? rec : ['table'];
  }
};
