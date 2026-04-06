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

  extractMeta(rows) {
    let reportType='', filterInfo='', appName='';
    const r1 = (rows[1]&&rows[1][0])||'', r2 = (rows[2]&&rows[2][0])||'';
    if (r1.startsWith('내 앱:')) { appName=r1; reportType=r2; filterInfo=(rows[3]&&rows[3][0])||''; }
    else { reportType=r1; filterInfo=r2; }
    return { reportType, filterInfo, appName };
  },

  parseFile(text, forceHeaderIdx) {
    const rows = this.parseCSV(text);
    if (rows.length < 2) return null;

    // 사용자가 헤더 행을 직접 지정한 경우
    if (forceHeaderIdx != null && forceHeaderIdx >= 0 && forceHeaderIdx < rows.length) {
      return this._buildResult(rows, forceHeaderIdx);
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
          return this._buildResult(rows, i);
        }
      }
      // 텍스트 헤더를 못 찾으면 첫 번째 다중열 행을 헤더로
      for (let i = 0; i < rows.length - 1; i++) {
        if (rows[i] && rows[i].length >= 2) return this._buildResult(rows, i);
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
      for (let i = 0; i < Math.min(rows.length, 3); i++) {
        const row = rows[i];
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

    // 패키지명 → 앱명 자동 변환
    this._convertPkgToAppName(headers, data);

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
  _buildResult(rows, headerIdx) {
    const headers = rows[headerIdx];
    if (!headers || headers.length < 2) return null;
    const data = rows.slice(headerIdx + 1).filter(r => r.length >= headers.length - 1 && r.some(c => c !== ''));
    if (data.length === 0) return null;
    const type = 'unknown';
    const chartKind = this.recommendChart(type, headers, data);
    this._convertPkgToAppName(headers, data);
    const meta = { reportType: '', filterInfo: '', appName: '' };
    return { type, chartKind, meta, headers, data };
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
    const numCols = headers.filter((_,i) => i>0 && data.some(r => !isNaN(Number(r[i])))).length;
    const hasDate = data.some(r => /\d+\/\d+|\d{4}-\d{2}/.test(r[0]));
    const rowCount = data.length;
    if (hasDate && rowCount >= 5) return 'line';
    if (numCols >= 2 && rowCount >= 3) return 'verticalBar';
    if (numCols === 1 && rowCount <= 6) {
      // 합이 100% 근처면 도넛, 아니면 수평 바
      const vals = data.map(r => Number(r[1]) || 0);
      const sum = vals.reduce((a,b) => a+b, 0);
      if (sum > 85 && sum < 115) return 'donut';
      return 'horizontalBar';
    }
    if (rowCount <= 15) return 'horizontalBar';
    return 'table';
  }
};
