// ── 메인 앱 로직 ──
(function() {
  // ── Render 서버 미리 깨우기 (슬립 해제) ──
  if (typeof ApiClient !== 'undefined' && ApiClient.BASE_URL) {
    fetch(ApiClient.BASE_URL + '/industries', { method: 'GET' }).catch(function(){});
  }

  // ── 보안 헬퍼 ──
  // HTML 이스케이프 (XSS 방지)
  function _h(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  // URL 검증 (아이콘 URL 등)
  function _safeUrl(url) {
    if (!url) return '';
    const s = String(url).trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (/^data:image\//i.test(s)) return s;
    if (/^icons\/[\w.-]+$/i.test(s)) return s;
    return '';
  }

  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');
  const addFileInput = document.getElementById('addFileInput');
  const onboarding = document.getElementById('onboarding');
  const results = document.getElementById('results');
  const container = document.getElementById('chartsContainer');
  const homeBtn = document.getElementById('homeBtn');

  // 슬라이드 데이터 저장
  const slides = [];
  let projectName = '새 프로젝트';

  // 카테고리별 차트 유형 — 장표 상단 드롭다운용
  function buildKindDropdownHTML(activeKind, recommended) {
    const cats = T.KIND_CATEGORIES;
    const current = T.KINDS[activeKind] || { icon: '📊', label: '차트' };
    let popupHtml = '';
    Object.entries(cats).forEach(([catKey, cat]) => {
      const kinds = Object.entries(T.KINDS).filter(([k, v]) => v.category === catKey);
      if (kinds.length === 0) return;
      popupHtml += `<div class="kd-cat"><div class="kd-cat-label">${cat.icon} ${cat.label}</div><div class="kd-cat-items">`;
      kinds.forEach(([k, v]) => {
        const isActive = activeKind === k ? ' active' : '';
        const isRec = recommended.includes(k);
        popupHtml += `<button class="kd-item${isActive}" data-kind="${k}">${v.icon} ${v.label}${isRec ? '<span class="kd-rec">추천</span>' : ''}</button>`;
      });
      popupHtml += `</div></div>`;
    });
    return { currentIcon: current.icon, currentLabel: current.label, popupHtml };
  }

  // 카테고리별 차트 유형 HTML 생성 (설정 패널용 — 기존)
  function buildKindOptionsHTML(activeKind, recommended) {
    const cats = T.KIND_CATEGORIES;
    let html = '';
    Object.entries(cats).forEach(([catKey, cat]) => {
      const kinds = Object.entries(T.KINDS).filter(([k, v]) => v.category === catKey);
      if (kinds.length === 0) return;
      html += `<div class="kind-category">`;
      html += `<div class="kind-category-label">${cat.icon} ${cat.label}<span class="kind-tip-trigger" data-tip="${cat.tip.replace(/"/g,'&quot;')}">?</span></div>`;
      html += `<div class="kind-category-items">`;
      kinds.forEach(([k, v]) => {
        const isActive = activeKind === k ? ' active' : '';
        const isRec = recommended.includes(k);
        html += `<button class="kind-btn${isActive}" data-kind="${k}">${v.icon} ${v.label}${isRec ? '<span class="rec-badge">추천</span>' : ''}</button>`;
      });
      html += `</div></div>`;
    });
    return html;
  }

  // 툴팁 표시 (body에 fixed로 띄움)
  let kindTipEl = null;
  document.addEventListener('mouseenter', function(e) {
    if (!e.target || !e.target.classList || !e.target.classList.contains('kind-tip-trigger')) return;
    if (!kindTipEl) {
      kindTipEl = document.createElement('div');
      kindTipEl.className = 'kind-tip-bubble';
      document.body.appendChild(kindTipEl);
    }
    kindTipEl.textContent = e.target.dataset.tip;
    kindTipEl.style.display = 'block';
    const rect = e.target.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - 115;
    let top = rect.bottom + 8;
    // 화면 밖으로 나가지 않도록
    if (left < 8) left = 8;
    if (left + 230 > window.innerWidth - 8) left = window.innerWidth - 238;
    if (top + 100 > window.innerHeight) top = rect.top - 8 - kindTipEl.offsetHeight;
    kindTipEl.style.left = left + 'px';
    kindTipEl.style.top = top + 'px';
  }, true);
  document.addEventListener('mouseleave', function(e) {
    if (!e.target || !e.target.classList || !e.target.classList.contains('kind-tip-trigger')) return;
    if (kindTipEl) kindTipEl.style.display = 'none';
  }, true);

  // ── SVG 이미지 base64 인라인화 (다운로드용) ──
  function inlineSvgImages(svgEl) {
    const images = svgEl.querySelectorAll('image');
    if (images.length === 0) return Promise.resolve();
    return Promise.all(Array.from(images).map(img => {
      const href = img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
      if (!href || href.startsWith('data:')) return Promise.resolve();
      if (!/^https?:\/\//i.test(href)) return Promise.resolve();
      return new Promise(resolve => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const imgEl = new Image();
        imgEl.crossOrigin = 'anonymous';
        imgEl.onload = () => {
          canvas.width = imgEl.naturalWidth;
          canvas.height = imgEl.naturalHeight;
          ctx.drawImage(imgEl, 0, 0);
          try {
            const dataUrl = canvas.toDataURL('image/png');
            img.setAttribute('href', dataUrl);
            img.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
          } catch(e) { /* CORS 실패 시 무시 */ }
          resolve();
        };
        imgEl.onerror = () => resolve();
        imgEl.src = href;
      });
    }));
  }

  // ── 텍스트 수정 모드 ──
  function toggleTextEditMode(chartEl, chartArea, btn) {
    const svgEl = chartEl.querySelector('svg');
    if (!svgEl) return;

    const isActive = chartArea.classList.contains('text-edit-mode');
    if (isActive) {
      exitTextEditMode(chartArea, svgEl, btn);
      return;
    }

    chartArea.classList.add('text-edit-mode');
    btn.classList.add('active');
    svgEl.style.pointerEvents = 'auto';
    svgEl.style.userSelect = 'none';
    svgEl.style.webkitUserSelect = 'none';

    // 안내 배너
    const banner = document.createElement('div');
    banner.className = 'text-edit-banner';
    banner.innerHTML = '✍️ 텍스트를 클릭하면 수정할 수 있어요 <button class="text-edit-done">완료</button>';
    document.body.appendChild(banner);
    banner.querySelector('.text-edit-done').addEventListener('click', () => {
      exitTextEditMode(chartArea, svgEl, btn);
    });

    // SVG 텍스트에 호버/클릭 이벤트
    const texts = svgEl.querySelectorAll('text');
    const preventDrag = (e) => { e.preventDefault(); };
    svgEl.addEventListener('mousedown', preventDrag);
    svgEl._preventDrag = preventDrag;
    texts.forEach(t => {
      t.style.cursor = 'pointer';
      t.style.userSelect = 'none';
      t.style.webkitUserSelect = 'none';
      t._origFill = t.getAttribute('fill');
      t.addEventListener('mouseenter', textHoverIn);
      t.addEventListener('mouseleave', textHoverOut);
      t.addEventListener('click', textClick);
    });
  }

  function exitTextEditMode(chartArea, svgEl, btn) {
    chartArea.classList.remove('text-edit-mode');
    btn.classList.remove('active');
    svgEl.style.pointerEvents = '';
    svgEl.style.userSelect = '';
    svgEl.style.webkitUserSelect = '';
    if (svgEl._preventDrag) {
      svgEl.removeEventListener('mousedown', svgEl._preventDrag);
      svgEl._preventDrag = null;
    }
    const banner = document.body.querySelector('.text-edit-banner');
    if (banner) banner.remove();
    const overlay = chartArea.querySelector('.text-edit-overlay');
    if (overlay) overlay.remove();

    svgEl.querySelectorAll('text').forEach(t => {
      t.style.cursor = '';
      t.style.userSelect = '';
      t.style.webkitUserSelect = '';
      t.removeAttribute('stroke');
      t.removeAttribute('stroke-width');
      t.removeAttribute('paint-order');
      if (t._origFill) t.setAttribute('fill', t._origFill);
      t.removeEventListener('mouseenter', textHoverIn);
      t.removeEventListener('mouseleave', textHoverOut);
      t.removeEventListener('click', textClick);
    });
  }

  function textHoverIn(e) {
    const t = e.target.closest('text');
    if (!t) return;
    t.setAttribute('stroke', '#6C5CE7');
    t.setAttribute('stroke-width', '0.5');
    t.setAttribute('paint-order', 'stroke');
  }
  function textHoverOut(e) {
    const t = e.target.closest('text');
    if (!t) return;
    t.removeAttribute('stroke');
    t.removeAttribute('stroke-width');
    t.removeAttribute('paint-order');
  }
  function textClick(e) {
    e.stopPropagation();
    const t = e.target.closest('text');
    if (!t) return;
    const chartArea = t.closest('.slide-chart-area');
    if (!chartArea) return;

    // 기존 오버레이 제거
    const old = chartArea.querySelector('.text-edit-overlay');
    if (old) old.remove();

    // SVG 좌표 → 화면 좌표 변환
    const svgEl = t.closest('svg');
    const svgRect = svgEl.getBoundingClientRect();
    const tRect = t.getBoundingClientRect();

    const overlay = document.createElement('div');
    overlay.className = 'text-edit-overlay';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'text-edit-input';
    input.value = t.textContent;

    // 위치/크기 맞추기
    const relTop = tRect.top - svgRect.top;
    const relLeft = tRect.left - svgRect.left;
    overlay.style.top = relTop + 'px';
    overlay.style.left = relLeft + 'px';
    overlay.style.width = Math.max(tRect.width + 24, 60) + 'px';
    overlay.style.height = Math.max(tRect.height + 8, 28) + 'px';

    // 폰트 크기 비율 계산
    const svgFontSize = parseFloat(t.getAttribute('font-size') || 14);
    const scaleRatio = svgRect.width / (parseFloat(svgEl.getAttribute('width')) || 1200);
    input.style.fontSize = (svgFontSize * scaleRatio) + 'px';
    input.style.fontWeight = t.getAttribute('font-weight') || '400';
    input.style.textAlign = t.getAttribute('text-anchor') === 'end' ? 'right' : t.getAttribute('text-anchor') === 'middle' ? 'center' : 'left';

    overlay.appendChild(input);
    chartArea.querySelector('.chart-slide').appendChild(overlay);

    input.focus();
    input.select();

    const _origTextBeforeEdit = t.textContent;
    const apply = () => {
      if (!overlay.parentNode) return;
      t.textContent = input.value;
      overlay.remove();

      // slide 데이터와 설정 패널 동기화
      const wrapper = chartArea.closest('.slide-wrapper');
      if (!wrapper) return;
      const slideId = wrapper.dataset.slideId;
      const slide = slides.find(s => s.id === slideId);
      if (!slide) return;

      // SVG 내 위치로 타이틀/부제목/출처 판별
      const ty = parseFloat(t.getAttribute('y')) || 0;
      if (ty <= T.TITLE_Y + 40) {
        slide.title = input.value;
        const inp = wrapper.querySelector('.ie-input[data-key="title"]');
        if (inp) inp.value = input.value;
      } else if (ty <= T.SUBTITLE_Y + 20) {
        slide.subtitle = input.value;
        const inp = wrapper.querySelector('.ie-input[data-key="subtitle"]');
        if (inp) inp.value = input.value;
      } else if (ty >= T.SOURCE_Y - 10) {
        // 출처: "[출처: xxx]" 형태에서 추출
        const m = input.value.match(/\[출처:\s*(.+)\]/);
        slide.source = m ? m[1] : input.value;
        const inp = wrapper.querySelector('.ie-input[data-key="source"]');
        if (inp) inp.value = slide.source;
      } else {
        // 범례 또는 기타 텍스트 수정 → legendNames에 저장 후 리렌더
        const origText = _origTextBeforeEdit;
        // 원본 시리즈 이름 찾기: legendNames의 값이거나 헤더에 있는 이름
        if (!slide.legendNames) slide.legendNames = {};
        const parsed = slide.parsed || {};
        const headers = parsed.headers || [];
        // 수정 전 텍스트가 legendNames의 값인지 확인
        let origSeriesName = null;
        for (const [k, v] of Object.entries(slide.legendNames)) {
          if (v === origText || v === input.value) { origSeriesName = k; break; }
        }
        // legendNames에 없으면 헤더에서 찾기
        if (!origSeriesName) {
          origSeriesName = headers.find(h => h === origText) || origText;
        }
        if (origSeriesName && input.value !== origSeriesName) {
          slide.legendNames[origSeriesName] = input.value;
        }
        // 칩 크기 재계산을 위해 리렌더
        rerenderChart(slide, wrapper);
      }
      saveProject();
    };
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); apply(); }
      if (ev.key === 'Escape') overlay.remove();
    });
    input.addEventListener('blur', apply);
  }

  // 프로젝트 자동 저장 (멀티 프로젝트)
  function saveProject() {
    try {
      const projects = JSON.parse(localStorage.getItem('cs-projects') || '{}');
      const id = currentProjectId || (currentProjectId = Date.now().toString(36));
      projects[id] = {
        name: projectName,
        slideCount: slides.length,
        updatedAt: new Date().toISOString(),
        slides: slides
      };
      localStorage.setItem('cs-projects', JSON.stringify(projects));
      localStorage.setItem('cs-last-project', id);
    } catch(e) { /* 용량 초과 등 무시 */ }
  }

  let currentProjectId = null;

  // 프로젝트 불러오기
  function loadProject(id) {
    try {
      const projects = JSON.parse(localStorage.getItem('cs-projects') || '{}');
      const data = projects[id];
      if (!data || !data.slides || data.slides.length === 0) return false;
      currentProjectId = id;
      projectName = data.name || '새 프로젝트';
      slides.length = 0;
      container.innerHTML = '';
      data.slides.forEach(s => { slides.push(s); renderSlide(s); });
      onboarding.style.display = 'none';
      results.style.display = '';
      updateProjectHeader();
      return true;
    } catch(e) { console.error('loadProject error:', e); return false; }
  }

  // 저장된 프로젝트 목록 표시
  function showSavedProjects() {
    const el = document.getElementById('savedProjects');
    if (!el) return;
    try {
      const projects = JSON.parse(localStorage.getItem('cs-projects') || '{}');
      const entries = Object.entries(projects).sort((a,b) => (b[1].updatedAt||'').localeCompare(a[1].updatedAt||''));
      if (entries.length === 0) { el.innerHTML = ''; return; }
      el.innerHTML = `<div class="saved-projects-title">📁 저장된 프로젝트</div>` +
        entries.map(([id, p]) => {
          const date = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('ko') : '';
          return `<div class="saved-project-item" data-id="${_h(id)}">
            <span class="sp-icon">📊</span>
            <div class="sp-info">
              <div class="sp-name">${_h(p.name || '이름 없음')}</div>
              <div class="sp-meta">${_h(p.slideCount || 0)}개 장표 · ${_h(date)}</div>
            </div>
            <button class="sp-delete" data-id="${_h(id)}" title="삭제">✕</button>
          </div>`;
        }).join('');
      el.querySelectorAll('.saved-project-item').forEach(item => {
        item.addEventListener('click', e => {
          if (e.target.closest('.sp-delete')) return;
          loadProject(item.dataset.id);
        });
      });
      el.querySelectorAll('.sp-delete').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          if (!confirm('이 프로젝트를 삭제하시겠어요?')) return;
          const projects = JSON.parse(localStorage.getItem('cs-projects') || '{}');
          delete projects[btn.dataset.id];
          localStorage.setItem('cs-projects', JSON.stringify(projects));
          showSavedProjects();
        });
      });
    } catch(e) { el.innerHTML = ''; }
  }

  function updateProjectHeader() {
    const nameEl = document.getElementById('projectName');
    if (nameEl) nameEl.textContent = projectName;
    const countEl = document.getElementById('slideCount');
    if (countEl) countEl.textContent = slides.length + '개 장표';
    // 네비게이션 도트 업데이트
    const nav = document.getElementById('slideNav');
    if (nav) {
      nav.innerHTML = slides.map((s, i) => `<button class="slide-nav-dot" data-idx="${i}" title="장표 ${i+1}"></button>`).join('');
      nav.querySelectorAll('.slide-nav-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          const idx = Number(dot.dataset.idx);
          const wrappers = container.querySelectorAll('.slide-wrapper');
          if (wrappers[idx]) wrappers[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
      // 스크롤 위치에 따라 active 도트 업데이트
      updateActiveDot();
    }
  }

  function updateActiveDot() {
    const wrappers = container.querySelectorAll('.slide-wrapper');
    const dots = document.querySelectorAll('.slide-nav-dot');
    if (!wrappers.length || !dots.length) return;

    let closestIdx = 0, closestDist = Infinity;
    const viewCenter = window.innerHeight / 2;
    wrappers.forEach((w, i) => {
      const rect = w.getBoundingClientRect();
      const dist = Math.abs(rect.top + rect.height/2 - viewCenter);
      if (dist < closestDist) { closestDist = dist; closestIdx = i; }
    });
    dots.forEach((d, i) => d.classList.toggle('active', i === closestIdx));
  }

  // 스크롤 시 active 도트 업데이트
  window.addEventListener('scroll', () => requestAnimationFrame(updateActiveDot));

  // ── 파일 업로드 ──
  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
  fileInput.addEventListener('change', e => { handleFiles(e.target.files); fileInput.value=''; });
  addFileInput.addEventListener('change', e => { handleFiles(e.target.files); addFileInput.value=''; });
  document.getElementById('addFileBottom').addEventListener('change', e => { handleFiles(e.target.files); e.target.value=''; });
  homeBtn.addEventListener('click', () => {
    if (!confirm('새 프로젝트를 시작하시겠어요? 현재 장표가 모두 사라져요.')) return;
    slides.length = 0;
    projectName = '새 프로젝트';
    currentProjectId = null;
    localStorage.removeItem('cs-last-project');
    container.innerHTML = '';
    results.style.display = 'none';
    onboarding.style.display = '';
    showSavedProjects();
  });

  // ── 토스트 알림 ──
  function showToast(msg, isError) {
    const toast = document.createElement('div');
    toast.className = 'save-toast' + (isError ? ' error-toast' : '');
    toast.innerHTML = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 4000);
  }
  window.showToast = showToast;

  function handleFiles(files) {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    Array.from(files).forEach(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(ext)) { showToast('⚠️ 지원하지 않는 파일 형식이에요: <b>' + _h(file.name) + '</b><br><span style="font-size:12px;opacity:0.85">CSV, XLSX, XLS 파일만 올릴 수 있어요.</span>', true); return; }
      if (file.size > MAX_FILE_SIZE) { showToast('⚠️ 파일이 너무 커요: <b>' + _h(file.name) + '</b><br><span style="font-size:12px;opacity:0.85">최대 10MB까지 올릴 수 있어요.</span>', true); return; }

      if (ext === 'csv') {
        const reader = new FileReader();
        reader.onload = e => {
          const text = e.target.result;
          const rows = Parser.parseCSV(text);
          if (!rows || rows.length < 2) { showToast('⚠️ 파일을 읽을 수 없어요: <b>' + _h(file.name) + '</b>', true); return; }
          openSpreadsheetViewer({ _fakeSheets: [{ name: file.name.replace(/\.csv$/i, ''), data: rows }] }, file.name);
        };
        reader.readAsText(file, 'UTF-8');
      } else {
        // xlsx/xls → 스프레드시트 뷰어로 열기
        const reader = new FileReader();
        reader.onload = e => {
          try {
            const wb = XLSX.read(e.target.result, { type: 'array' });
            openSpreadsheetViewer(wb, file.name);
          } catch(err) { console.warn('엑셀 파싱 실패:', file.name, err); showToast('⚠️ 엑셀 파일을 읽을 수 없어요: <b>' + _h(file.name) + '</b><br><span style="font-size:12px;opacity:0.85">파일이 손상되었거나 지원하지 않는 형식이에요.</span>', true); }
        };
        reader.readAsArrayBuffer(file);
      }
    });
  }

  // ── 슬라이드 추가 (데이터 많으면 범위 선택) ──
  const MAX_ROWS = 15; // 1200×750에 깔끔하게 들어가는 최대 행 수

  // ── 스프레드시트 뷰어 (엑셀 드래그 선택) ──
  function openSpreadsheetViewer(wb, fileName, existingSlide) {
    const old = document.getElementById('spreadsheetModal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'spreadsheetModal';
    modal.className = 'ss-modal';

    // 시트 데이터 준비
    const sheets = wb._fakeSheets || wb.SheetNames.map(name => {
      const sheet = wb.Sheets[name];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      return { name, data: json };
    });

    let activeSheet = 0;
    let sel = null; // { r1, c1, r2, c2 } 사각형 선택
    let selectedCols = new Set(); // 열 헤더 클릭으로 개별 열 선택
    let excludedRows = new Set(); // 행 헤더 클릭으로 개별 행 제외
    let excludedCols = new Set(); // 열 헤더 클릭으로 개별 열 제외
    let selMode = 'drag'; // 'drag' = 사각형, 'cols' = 열 개별
    let dragging = false;
    let dragStart = null;

    function colLabel(c) {
      let s = '';
      while (c >= 0) { s = String.fromCharCode(65 + (c % 26)) + s; c = Math.floor(c / 26) - 1; }
      return s;
    }

    function renderSheet() {
      const sd = sheets[activeSheet];
      const rows = sd.data;
      if (!rows || rows.length === 0) return '<div class="ss-empty">빈 시트예요</div>';
      const maxCols = Math.max(...rows.map(r => r.length), 0);
      const maxR = Math.min(rows.length, 200);
      const maxC = Math.min(maxCols, 50);

      let html = '<table class="ss-table"><thead><tr><th class="ss-corner"></th>';
      for (let c = 0; c < maxC; c++) html += `<th class="ss-col-hdr" data-c="${c}">${colLabel(c)}</th>`;
      html += '</tr></thead><tbody>';
      for (let r = 0; r < maxR; r++) {
        html += `<tr><td class="ss-row-hdr" data-r="${r}">${r + 1}</td>`;
        for (let c = 0; c < maxC; c++) {
          const v = rows[r] && rows[r][c] != null ? rows[r][c] : '';
          const display = String(v);
          const truncated = display.length > 20 ? display.slice(0, 20) + '…' : display;
          html += `<td class="ss-cell" data-r="${r}" data-c="${c}" title="${_h(display)}">${_h(truncated)}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
      if (rows.length > maxR) html += `<div class="ss-truncated">… 외 ${rows.length - maxR}행 (최대 200행까지 표시)</div>`;
      return html;
    }

    function renderTabs() {
      return sheets.map((s, i) =>
        `<button class="ss-tab${i === activeSheet ? ' active' : ''}" data-idx="${i}">${_h(s.name)}</button>`
      ).join('');
    }

    function getSelectionInfo() {
      if (selMode === 'cols' && selectedCols.size > 0) {
        const sd = sheets[activeSheet];
        const maxR = Math.min(sd.data.length, 200);
        const cols = [...selectedCols].sort((a,b) => a-b);
        return `${cols.map(c => colLabel(c)).join(', ')} 열 선택 (${maxR}행 × ${cols.length}열)`;
      }
      if (!sel) return '';
      const r1 = Math.min(sel.r1, sel.r2), r2 = Math.max(sel.r1, sel.r2);
      const c1 = Math.min(sel.c1, sel.c2), c2 = Math.max(sel.c1, sel.c2);
      const rows = r2 - r1 + 1, cols = c2 - c1 + 1;
      return `${colLabel(c1)}${r1+1}:${colLabel(c2)}${r2+1} (${rows}행 × ${cols}열)`;
    }

    function updateSelection() {
      const cells = modal.querySelectorAll('.ss-cell');
      const colHdrs = modal.querySelectorAll('.ss-col-hdr');
      const rowHdrs = modal.querySelectorAll('.ss-row-hdr');
      cells.forEach(td => td.classList.remove('ss-selected', 'ss-sel-top', 'ss-sel-bottom', 'ss-sel-left', 'ss-sel-right', 'ss-excluded'));
      colHdrs.forEach(th => th.classList.remove('ss-col-active', 'ss-col-excluded'));
      rowHdrs.forEach(th => th.classList.remove('ss-row-excluded'));

      // 제외된 행 표시
      excludedRows.forEach(r => {
        cells.forEach(td => { if (Number(td.dataset.r) === r) td.classList.add('ss-excluded'); });
        rowHdrs.forEach(th => { if (Number(th.dataset.r) === r) th.classList.add('ss-row-excluded'); });
      });

      // 제외된 열 표시
      excludedCols.forEach(c => {
        cells.forEach(td => { if (Number(td.dataset.c) === c) td.classList.add('ss-excluded'); });
        colHdrs.forEach(th => { if (Number(th.dataset.c) === c) th.classList.add('ss-col-excluded'); });
      });

      if (selMode === 'cols' && selectedCols.size > 0) {
        cells.forEach(td => {
          const c = Number(td.dataset.c);
          if (selectedCols.has(c) && !excludedRows.has(Number(td.dataset.r))) td.classList.add('ss-selected');
        });
        colHdrs.forEach(th => {
          const c = Number(th.dataset.c);
          if (selectedCols.has(c)) th.classList.add('ss-col-active');
        });
      } else if (sel) {
        const r1 = Math.min(sel.r1, sel.r2), r2 = Math.max(sel.r1, sel.r2);
        const c1 = Math.min(sel.c1, sel.c2), c2 = Math.max(sel.c1, sel.c2);
        cells.forEach(td => {
          const r = Number(td.dataset.r), c = Number(td.dataset.c);
          if (r >= r1 && r <= r2 && c >= c1 && c <= c2 && !excludedRows.has(r)) {
            td.classList.add('ss-selected');
            if (r === r1) td.classList.add('ss-sel-top');
            if (r === r2) td.classList.add('ss-sel-bottom');
            if (c === c1) td.classList.add('ss-sel-left');
            if (c === c2) td.classList.add('ss-sel-right');
          }
        });
      }
      updateSelInfo();
    }

    function hasSelection() {
      return (selMode === 'cols' && selectedCols.size > 0) || sel != null;
    }

    function updateSelInfo() {
      const info = modal.querySelector('.ss-sel-info');
      const btn = modal.querySelector('.ss-create-btn');
      if (hasSelection()) {
        if (info) info.textContent = '✅ ' + getSelectionInfo() + ' — 차트 만들기를 눌러주세요';
        if (btn) btn.disabled = false;
      } else {
        if (info) info.textContent = '차트에 넣을 영역을 선택하세요';
        if (btn) btn.disabled = true;
      }
    }

    function buildFromSelection() {
      const sd = sheets[activeSheet];
      let selCols, r1, r2;

      if (selMode === 'cols' && selectedCols.size > 0) {
        // 열 개별 선택 모드: 전체 행, 선택된 열만
        selCols = [...selectedCols].sort((a,b) => a-b);
        r1 = 0;
        r2 = Math.min(sd.data.length, 200) - 1;
      } else if (sel) {
        // 사각형 드래그 모드
        r1 = Math.min(sel.r1, sel.r2);
        r2 = Math.max(sel.r1, sel.r2);
        const c1 = Math.min(sel.c1, sel.c2), c2 = Math.max(sel.c1, sel.c2);
        selCols = [];
        for (let c = c1; c <= c2; c++) selCols.push(c);
      } else {
        return;
      }

      if (r2 - r1 < 1 || selCols.length < 1) { showToast('⚠️ 최소 2행, 1열 이상 선택해주세요', true); return; }

      // 제외된 열 필터링
      selCols = selCols.filter(c => !excludedCols.has(c));
      if (selCols.length < 1) { showToast('⚠️ 최소 1열 이상 포함해주세요', true); return; }

      const headers = selCols.map(c => String(sd.data[r1] && sd.data[r1][c] != null ? sd.data[r1][c] : colLabel(c)));
      const data = [];
      for (let r = r1 + 1; r <= r2; r++) {
        if (excludedRows.has(r)) continue; // 제외된 행 건너뛰기
        const row = selCols.map(c => {
          let v = sd.data[r] && sd.data[r][c] != null ? sd.data[r][c] : '';
          if (typeof v === 'string') v = v.replace(/,/g, '');
          return String(v);
        });
        if (row.some(v => v !== '')) data.push(row);
      }
      if (data.length === 0) { showToast('⚠️ 선택 영역에 데이터가 없어요', true); return; }

      // 엑셀 시리얼 넘버 → 날짜 변환
      Parser._convertExcelDates(headers, data);

      const chartKind = Parser.recommendChart('unknown', headers, data);
      const sheetName = sd.name && sd.name !== 'Sheet1' && sd.name !== 'Sheet 1' ? sd.name : '';

      // 원본 시트 데이터에서 MI-INSIGHT 메타 정보 추출 (내 앱, 리포트 타입, 필터)
      let metaAppName = '', metaReportType = sheetName, metaFilterInfo = '';
      if (sd.data && sd.data.length >= 3) {
        for (let mi = 0; mi < Math.min(sd.data.length, 6); mi++) {
          const cell = String(sd.data[mi] && sd.data[mi][0] || '').trim();
          if (cell.startsWith('내 앱:')) {
            metaAppName = cell;
          } else if (cell.includes('>') && !metaReportType) {
            metaReportType = cell;
          } else if (cell.startsWith('(OS:') || cell.startsWith('(기간:')) {
            metaFilterInfo = cell;
          }
        }
        // reportType이 sheetName이고 메타에서 더 나은 값을 찾았으면 교체
        if (metaReportType === sheetName) {
          for (let mi = 0; mi < Math.min(sd.data.length, 6); mi++) {
            const cell = String(sd.data[mi] && sd.data[mi][0] || '').trim();
            if (cell.includes('>')) { metaReportType = cell; break; }
          }
        }
      }

      // reportType으로 데이터 타입 감지 (Parser.parseFile과 동일한 로직)
      let detectedType = 'unknown';
      const rt = metaReportType;
      if (rt.includes('경쟁앱에서 유입') || rt.includes('유입, 유지, 이탈자 비교 분석>경쟁앱에서 유입')) detectedType = 'flow_in';
      else if (rt.includes('경쟁앱으로 이탈') || rt.includes('유입, 유지, 이탈자 비교 분석>경쟁앱으로 이탈')) detectedType = 'flow_out';
      else if (rt.includes('유입, 유지율 비교') || rt.includes('유입, 유지, 이탈자 비교 분석>유입')) detectedType = 'flow_retention';
      else if (rt.includes('데모그래픽 비교 분석>사용자 구성 비교')) detectedType = 'demo_compare';
      else if (rt.includes('데모그래픽 비교 분석>연령별 사용시간 구성')) detectedType = 'demo_time_compare';
      else if (rt.includes('기본 사용량 비교 분석>사용자 수')) detectedType = 'compare_users';
      else if (rt.includes('충성도 비교 분석>충성도 비교')) detectedType = 'loyalty_compare';
      else if (rt.includes('경쟁앱 교차 사용자 분석')) detectedType = 'cross_users';
      else if (rt.includes('경쟁앱 교차 사용 분석')) detectedType = 'cross_usage';

      const detectedChartKind = detectedType !== 'unknown' ? Parser.recommendChart(detectedType, headers, data) : chartKind;

      const parsed = {
        type: detectedType,
        chartKind: detectedChartKind,
        meta: { reportType: metaReportType, filterInfo: metaFilterInfo, appName: metaAppName },
        headers,
        data
      };
      modal.remove();

      if (existingSlide) {
        // 기존 슬라이드 데이터 업데이트
        existingSlide.parsed = parsed;
        existingSlide.fullParsed = parsed;
        // 차트 유형은 기존 설정 유지 (사용자가 바꾼 걸 존중)
        existingSlide.colRoles = null;
        existingSlide.rowRoles = null;
        existingSlide.rangeStart = 0;
        existingSlide.rangeEnd = parsed.data.length - 1;
        existingSlide._wb = wb;
        existingSlide._wbName = fileName;
        existingSlide._lastSel = { selMode, sel, selectedCols: [...selectedCols], excludedRows: [...excludedRows], excludedCols: [...excludedCols], activeSheet };
        const wrapper = container.querySelector(`[data-slide-id="${existingSlide.id}"]`);
        if (wrapper) {
          rerenderChart(existingSlide, wrapper);
          // 에디터가 열려있으면 재렌더링
          const editor = wrapper.querySelector('.inline-editor');
          if (editor) { editor.remove(); wrapper.classList.remove('editing'); requestAnimationFrame(() => toggleInlineEditor(existingSlide, wrapper)); }
        }
        saveProject();
      } else {
        parsed._wb = wb;
        parsed._wbName = fileName;
        parsed._lastSel = { selMode, sel, selectedCols: [...selectedCols], excludedRows: [...excludedRows], excludedCols: [...excludedCols], activeSheet };
        addSlide(parsed);
      }
    }

    // 모달 HTML
    modal.innerHTML = `
      <div class="ss-backdrop"></div>
      <div class="ss-panel">
        <div class="ss-header">
          <div class="ss-header-left">
            <span class="ss-title">📊 ${_h(fileName)}</span>
            <span class="ss-sel-info">차트에 넣을 영역을 선택하세요</span>
          </div>
          <div class="ss-header-right">
            <button class="ss-transpose-btn" title="행과 열을 바꿉니다">🔄 행/열 바꾸기</button>
            <button class="ss-create-btn" disabled>차트 만들기 →</button>
            <button class="ss-close">✕</button>
          </div>
        </div>
        <div class="ss-tabs">${renderTabs()}</div>
        <div class="ss-body">${renderSheet()}</div>
        <div class="ss-footer">
          <div class="ss-hint">
            💡 <b>셀 드래그</b>: 연속 영역 선택 &nbsp;·&nbsp; <b>열 헤더 클릭</b>: 열 제외 &nbsp;·&nbsp; <b>행 번호 클릭</b>: 행 제외 &nbsp;·&nbsp; <b>Shift+클릭</b>: 범위 제외
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('open'));

    // 이전 선택 복원
    if (existingSlide && existingSlide._lastSel) {
      const ls = existingSlide._lastSel;
      if (ls.activeSheet != null && ls.activeSheet < sheets.length) {
        activeSheet = ls.activeSheet;
        modal.querySelector('.ss-tabs').innerHTML = renderTabs();
        modal.querySelector('.ss-body').innerHTML = renderSheet();
      }
      selMode = ls.selMode || 'drag';
      sel = ls.sel || null;
      if (ls.selectedCols) ls.selectedCols.forEach(c => selectedCols.add(c));
      if (ls.excludedRows) ls.excludedRows.forEach(r => excludedRows.add(r));
      if (ls.excludedCols) ls.excludedCols.forEach(c => excludedCols.add(c));
      updateSelection();
    }

    // 이벤트: 시트 탭 + 셀 드래그 (이벤트 위임)
    function switchSheet(idx) {
      activeSheet = idx;
      sel = null;
      selectedCols.clear();
      excludedRows.clear();
      excludedCols.clear();
      selMode = 'drag';
      modal.querySelector('.ss-tabs').innerHTML = renderTabs();
      modal.querySelector('.ss-body').innerHTML = renderSheet();
      updateSelection();
    }

    modal.querySelector('.ss-tabs').addEventListener('click', e => {
      const tab = e.target.closest('.ss-tab');
      if (tab) switchSheet(Number(tab.dataset.idx));
    });

    // 이벤트: 열 헤더 클릭 (개별/Shift 범위 선택) + 행 헤더 클릭 (제외/Shift 범위 제외)
    let lastClickedCol = null;
    let lastClickedRow = null;
    const ssBody = modal.querySelector('.ss-body');
    ssBody.addEventListener('click', e => {
      const colHdr = e.target.closest('.ss-col-hdr');
      if (colHdr) {
        const c = Number(colHdr.dataset.c);
        // 열 제외/복원 토글 (행 제외와 동일한 패턴)
        if (e.shiftKey && lastClickedCol != null) {
          const from = Math.min(lastClickedCol, c), to = Math.max(lastClickedCol, c);
          const shouldExclude = !excludedCols.has(c);
          for (let i = from; i <= to; i++) {
            if (shouldExclude) excludedCols.add(i);
            else excludedCols.delete(i);
          }
        } else {
          if (excludedCols.has(c)) excludedCols.delete(c);
          else excludedCols.add(c);
        }
        lastClickedCol = c;
        updateSelection();
        return;
      }
      const rowHdr = e.target.closest('.ss-row-hdr');
      if (rowHdr) {
        const r = Number(rowHdr.dataset.r);
        if (e.shiftKey && lastClickedRow != null) {
          // Shift+클릭: 범위 제외/복원
          const from = Math.min(lastClickedRow, r), to = Math.max(lastClickedRow, r);
          const shouldExclude = !excludedRows.has(r);
          for (let i = from; i <= to; i++) {
            if (shouldExclude) excludedRows.add(i);
            else excludedRows.delete(i);
          }
        } else {
          if (excludedRows.has(r)) excludedRows.delete(r);
          else excludedRows.add(r);
        }
        lastClickedRow = r;
        updateSelection();
        return;
      }
    });

    // 이벤트: 셀 드래그 선택 (사각형)
    ssBody.addEventListener('mousedown', e => {
      const td = e.target.closest('.ss-cell');
      if (!td) return;
      e.preventDefault();
      dragging = true;
      selMode = 'drag';
      selectedCols.clear();
      const r = Number(td.dataset.r), c = Number(td.dataset.c);
      dragStart = { r, c };
      sel = { r1: r, c1: c, r2: r, c2: c };
      updateSelection();
    });
    ssBody.addEventListener('mousemove', e => {
      if (!dragging || !dragStart) return;
      const td = e.target.closest('.ss-cell');
      if (!td) return;
      const r = Number(td.dataset.r), c = Number(td.dataset.c);
      sel = { r1: dragStart.r, c1: dragStart.c, r2: r, c2: c };
      updateSelection();
    });
    document.addEventListener('mouseup', () => { dragging = false; });

    // 이벤트: 차트 만들기
    modal.querySelector('.ss-create-btn').addEventListener('click', buildFromSelection);

    // 이벤트: 행/열 바꾸기
    modal.querySelector('.ss-transpose-btn').addEventListener('click', () => {
      const sd = sheets[activeSheet];
      const rows = sd.data;
      if (!rows || rows.length === 0) return;
      const maxR = rows.length, maxC = Math.max(...rows.map(r => r.length), 0);
      const transposed = [];
      for (let c = 0; c < maxC; c++) {
        const newRow = [];
        for (let r = 0; r < maxR; r++) {
          newRow.push(rows[r] && rows[r][c] != null ? rows[r][c] : '');
        }
        transposed.push(newRow);
      }
      sd.data = transposed;
      sel = null;
      selectedCols.clear();
      excludedRows.clear();
      modal.querySelector('.ss-body').innerHTML = renderSheet();
      updateSelection();
    });

    // 이벤트: 닫기
    const closeModal = () => {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    };
    modal.querySelector('.ss-close').addEventListener('click', closeModal);
    modal.querySelector('.ss-backdrop').addEventListener('click', closeModal);
  }

  function addSlide(parsed) {
    onboarding.style.display = 'none';
    results.style.display = '';

    const needsRange = (parsed.chartKind === 'heatmap' || parsed.chartKind === 'table') && parsed.data.length > MAX_ROWS;

    if (needsRange) {
      openRangeModal(parsed);
    } else {
      createAndRender(parsed, 0, parsed.data.length - 1);
    }
  }
  window.addSlide = addSlide;
  window.openSpreadsheetViewer = openSpreadsheetViewer;

  function createAndRender(parsed, startIdx, endIdx) {
    const slicedData = parsed.data.slice(startIdx, endIdx + 1);
    const slicedParsed = { ...parsed, data: slicedData };

    const slide = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      parsed: slicedParsed,
      fullParsed: parsed,
      chartKind: parsed.chartKind,
      title: parsed.meta.reportType.split('>').pop().trim() || '차트',
      subtitle: '',
      filterInfo: parsed.meta.filterInfo || '',
      source: '',
      colors: [...T.SERIES],
      iconUrls: {},
      visibleCols: null,
      bubbleGroups: null,
      transposed: false,
      rangeStart: startIdx,
      rangeEnd: endIdx,
      showValueLabels: null,
      iconShape: 'circle',
      iconSize: 'medium',
      lineIconMode: 'legend',
      _wb: parsed._wb || null,
      _wbName: parsed._wbName || '',
      _lastSel: parsed._lastSel || null,
    };
    slides.push(slide);
    renderSlide(slide);
    updateProjectHeader();
    saveProject();
  }

  // ── 범위 선택 모달 ──
  // ── 헤더 행 선택 모달 ──
  function openHeaderSelectModal(rawRows, rawText) {
    const old = document.getElementById('headerSelectModal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'headerSelectModal';
    modal.className = 'range-modal';

    // 미리보기: 최대 15행, 5열까지 표시
    const previewRows = rawRows.slice(0, Math.min(rawRows.length, 15));
    const maxCols = Math.min(Math.max(...rawRows.map(r => r.length)), 6);

    let tableHTML = '<table class="header-select-table"><tbody>';
    previewRows.forEach((row, i) => {
      const isAllEmpty = row.every(c => c === '');
      tableHTML += `<tr class="header-select-row${isAllEmpty ? ' empty-row' : ''}" data-idx="${i}">`;
      tableHTML += `<td class="header-select-idx">${i + 1}</td>`;
      for (let c = 0; c < maxCols; c++) {
        const val = row[c] || '';
        const display = val.length > 20 ? val.slice(0, 20) + '…' : val;
        tableHTML += `<td class="header-select-cell" title="${_h(val)}">${_h(display)}</td>`;
      }
      if (rawRows[0] && rawRows[0].length > maxCols) {
        if (i === 0) tableHTML += `<td class="header-select-cell" style="color:var(--text-muted)">…외 ${rawRows[0].length - maxCols}열</td>`;
        else tableHTML += `<td class="header-select-cell"></td>`;
      }
      tableHTML += '</tr>';
    });
    if (rawRows.length > 15) {
      tableHTML += `<tr><td colspan="${maxCols + 2}" style="text-align:center;color:var(--text-muted);padding:8px">…외 ${rawRows.length - 15}행</td></tr>`;
    }
    tableHTML += '</tbody></table>';

    modal.innerHTML = `
      <div class="range-panel" style="max-width:700px">
        <h3>📋 헤더 행 선택</h3>
        <p>데이터에서 열 이름(헤더)이 있는 행을 클릭해주세요.<br>
        <span style="color:var(--accent);font-weight:600">앱 이름, 날짜 등 컬럼명이 있는 행을 선택하세요.</span></p>
        <div class="header-select-preview">${tableHTML}</div>
        <div class="range-actions">
          <button class="range-btn-secondary" id="headerSelectCancel">취소</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 행 클릭 이벤트
    modal.querySelectorAll('.header-select-row').forEach(tr => {
      tr.addEventListener('click', () => {
        const idx = Number(tr.dataset.idx);
        const parsed = Parser.parseFile(rawText, idx);
        if (!parsed || parsed.needsHeaderSelect) {
          showToast('⚠️ 선택한 행으로 데이터를 읽을 수 없어요.<br><span style="font-size:12px;opacity:0.85">다른 행을 선택해주세요.</span>', true);
          return;
        }
        modal.remove();
        addSlide(parsed);
      });

      // 호버 효과
      tr.addEventListener('mouseenter', () => {
        modal.querySelectorAll('.header-select-row').forEach(r => r.classList.remove('selected'));
        tr.classList.add('selected');
      });
    });

    document.getElementById('headerSelectCancel').addEventListener('click', () => {
      modal.remove();
    });
  }

  function openRangeModal(parsed) {
    const old = document.getElementById('rangeModal');
    if (old) old.remove();

    const data = parsed.data;
    const total = data.length;
    const recEnd = Math.min(MAX_ROWS - 1, total - 1);

    const options = data.map((r, i) =>
      `<option value="${i}">${_h(r[0] || '행 ' + (i+1))}</option>`
    ).join('');

    const modal = document.createElement('div');
    modal.id = 'rangeModal';
    modal.className = 'range-modal';

    // 항목 유형 자동 파악
    const firstH = parsed.headers[0] || '';
    const sampleV = data.slice(0, 3).map(r => r[0] || '');
    let rangeItemType = '항목';
    if (sampleV.some(v => /\d{4}[-\/\.]/.test(v))) rangeItemType = '기간';
    else if (firstH.includes('앱') || firstH.includes('이름')) rangeItemType = '앱';
    else if (firstH.includes('순위')) rangeItemType = '순위';
    else if (firstH.includes('분류')) rangeItemType = '분류';
    else rangeItemType = firstH || '항목';

    modal.innerHTML = `
      <div class="range-panel">
        <h3>📋 표시할 ${_h(rangeItemType)} 선택</h3>
        <p>${_h(rangeItemType)}이 ${total}개예요. 1200×750 장표에 맞게 범위를 선택해주세요.<br>
        <span style="color:var(--accent);font-weight:600">추천: ${MAX_ROWS}개 이하</span></p>
        <div class="range-row">
          <label>시작</label>
          <select id="rangeStart">${options}</select>
        </div>
        <div class="range-row">
          <label>끝</label>
          <select id="rangeEnd">${options}</select>
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px" id="rangeCount">선택: ${recEnd + 1}행</div>
        <div class="range-actions">
          <button class="range-btn-secondary" id="rangeAll">전체 (${total}개)</button>
          <button class="range-btn-primary" id="rangeApply">적용</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const startSel = document.getElementById('rangeStart');
    const endSel = document.getElementById('rangeEnd');
    const countEl = document.getElementById('rangeCount');
    endSel.value = recEnd;

    const updateCount = () => {
      const s = Number(startSel.value), e = Number(endSel.value);
      const cnt = Math.abs(e - s) + 1;
      const warn = cnt > MAX_ROWS ? ' ⚠️ 폰트가 작아질 수 있어요' : ' ✅';
      countEl.innerHTML = `${cnt}개 선택${warn}`;
    };
    startSel.addEventListener('change', updateCount);
    endSel.addEventListener('change', updateCount);

    document.getElementById('rangeApply').addEventListener('click', () => {
      const s = Number(startSel.value), e = Number(endSel.value);
      modal.remove();
      createAndRender(parsed, Math.min(s,e), Math.max(s,e));
    });

    document.getElementById('rangeAll').addEventListener('click', () => {
      modal.remove();
      createAndRender(parsed, 0, total - 1);
    });
  }

  // ── 슬라이드 렌더 ──
  function renderSlide(slide) {
    // 래퍼: 차트 + 에디터 패널을 감싸는 flex 컨테이너
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-wrapper';
    wrapper.dataset.slideId = slide.id;
    wrapper.style.opacity = '0'; wrapper.style.transform = 'translateY(20px)';

    const chartArea = document.createElement('div');
    chartArea.className = 'slide-chart-area';

    // ── 장표 상단 툴바 ──
    const dataType = slide.parsed?.type || slide.fullParsed?.type || '';
    const recommended = Parser.getRecommendedKinds(dataType, slide.parsed?.headers || [], slide.parsed?.data || []);
    const toolbar = document.createElement('div');
    toolbar.className = 'slide-toolbar';

    function renderToolbarContent() {
      const dd = buildKindDropdownHTML(slide.chartKind, recommended);
      toolbar.innerHTML = `
        <span class="st-slide-num">장표 ${slides.indexOf(slide) + 1}</span>
        <div class="kd-wrap">
          <button class="kd-trigger">${dd.currentIcon} ${dd.currentLabel} <span class="kd-change">변경하기</span><span class="kd-arrow">▾</span></button>
          <div class="kd-popup">${dd.popupHtml}</div>
        </div>
        <div class="st-actions">
          <button class="st-btn reselect-btn" title="데이터 영역 다시 선택">📊 데이터 다시 선택</button>
          <button class="st-btn transpose-btn" title="행과 열 바꾸기">🔄 행/열 바꾸기</button>
          <button class="st-btn icon-toggle-btn${slide.showAppIcons === false ? '' : ' active'}" title="앱 아이콘 표시/숨기기">${slide.showAppIcons === false ? '🖼️ 아이콘 OFF' : '🖼️ 아이콘 ON'}</button>
          <div class="icon-dropdown-wrap" style="position:relative;display:inline-block">
            <button class="st-btn icon-dropdown-trigger${slide.showAppIcons === false ? ' disabled' : ''}" title="아이콘 모양/크기 설정">▾</button>
            <div class="icon-dropdown-menu">
              <div class="icon-dd-section">
                <div class="icon-dd-label">모양</div>
                <div class="icon-dd-options">
                  <button class="icon-dd-opt${(slide.iconShape || 'circle') === 'circle' ? ' active' : ''}" data-prop="iconShape" data-val="circle">⭕ 동그라미</button>
                  <button class="icon-dd-opt${(slide.iconShape || 'circle') === 'square' ? ' active' : ''}" data-prop="iconShape" data-val="square">⬜ 네모</button>
                </div>
              </div>
              <div class="icon-dd-section">
                <div class="icon-dd-label">크기</div>
                <div class="icon-dd-options">
                  <button class="icon-dd-opt${(slide.iconSize || 'medium') === 'small' ? ' active' : ''}" data-prop="iconSize" data-val="small">소(S)</button>
                  <button class="icon-dd-opt${(slide.iconSize || 'medium') === 'medium' ? ' active' : ''}" data-prop="iconSize" data-val="medium">중(M)</button>
                  <button class="icon-dd-opt${(slide.iconSize || 'medium') === 'large' ? ' active' : ''}" data-prop="iconSize" data-val="large">대(L)</button>
                </div>
              </div>
              ${(slide.chartKind === 'line' || slide.chartKind === 'combo') ? `<div class="icon-dd-section">
                <div class="icon-dd-label">라인 차트 아이콘 위치</div>
                <div class="icon-dd-options">
                  <button class="icon-dd-opt${(slide.lineIconMode || 'legend') === 'legend' ? ' active' : ''}" data-prop="lineIconMode" data-val="legend">📋 범례</button>
                  <button class="icon-dd-opt${(slide.lineIconMode || 'legend') === 'endpoint' ? ' active' : ''}" data-prop="lineIconMode" data-val="endpoint">📍 라인 끝</button>
                </div>
              </div>` : ''}
            </div>
          </div>
          <div class="palette-dropdown-wrap" style="position:relative;display:inline-block">
            <button class="st-btn palette-btn" title="색상 팔레트 변경">🎨 팔레트</button>
            <div class="icon-dropdown-menu palette-dropdown-menu">
              ${Object.entries(T.PALETTES).map(([k, p]) => {
                const isActive = (slide.palette || 'purple') === k;
                const previewColors = p.colors ? p.colors.slice(0, 6) : T._generatePalette(p.base).slice(0, 6);
                const dots = previewColors.map(c => '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + c + ';margin-right:2px"></span>').join('');
                return '<button class="icon-dd-opt palette-opt' + (isActive ? ' active' : '') + '" data-palette="' + k + '">' + dots + ' ' + p.label + '</button>';
              }).join('')}
            </div>
          </div>
          <button class="st-btn edit-btn" title="장표 설정">⚙️ 설정</button>
          <button class="st-btn dl-png-btn" title="PNG 다운로드">📥 PNG</button>
          <button class="st-btn dl-svg-btn" title="SVG 다운로드">📥 SVG</button>
          <button class="st-btn figma-btn" title="SVG를 클립보드에 복사 → 피그마에서 붙여넣기">🎨 피그마</button>
          <button class="st-btn del-btn" title="삭제">🗑️</button>
        </div>
      `;
    }
    renderToolbarContent();
    chartArea.appendChild(toolbar);

    // 드롭다운 토글
    toolbar.addEventListener('click', e => {
      const trigger = e.target.closest('.kd-trigger');
      if (trigger) {
        e.stopPropagation();
        const popup = toolbar.querySelector('.kd-popup');
        popup.classList.toggle('open');
        // 외부 클릭으로 닫기
        const closePopup = (ev) => { if (!popup.contains(ev.target) && ev.target !== trigger) { popup.classList.remove('open'); document.removeEventListener('click', closePopup); } };
        if (popup.classList.contains('open')) setTimeout(() => document.addEventListener('click', closePopup), 0);
        return;
      }
      // 차트 유형 선택
      const item = e.target.closest('.kd-item');
      if (item) {
        const newKind = item.dataset.kind;
        if (newKind !== slide.chartKind) {
          slide.chartKind = newKind;
          rerenderChart(slide, wrapper);
          saveProject();
          // 인라인 에디터가 열려있으면 재렌더링
          const existingEditor = wrapper.querySelector('.inline-editor');
          if (existingEditor) {
            existingEditor.remove();
            wrapper.classList.remove('editing');
            requestAnimationFrame(() => toggleInlineEditor(slide, wrapper));
          }
        }
        renderToolbarContent();
        toolbar.querySelector('.kd-popup').classList.remove('open');
        return;
      }
    });

    const el = buildChart(slide);
    el.dataset.slideId = slide.id;
    chartArea.appendChild(el);

    // 더블클릭으로 텍스트 바로 수정
    if (!localStorage.getItem('cs-dblhint-dismissed')) {
      const hint = document.createElement('div');
      hint.className = 'dbl-click-hint';
      hint.innerHTML = '✏️ 텍스트를 더블클릭하면 수정할 수 있어요 <button class="dbl-hint-close">✕</button>';
      chartArea.appendChild(hint);
      hint.querySelector('.dbl-hint-close').addEventListener('click', () => {
        hint.remove();
        localStorage.setItem('cs-dblhint-dismissed', '1');
      });
    }
    chartArea.addEventListener('dblclick', e => {
      e.preventDefault();
      window.getSelection().removeAllRanges();
      const currentChart = chartArea.querySelector('.chart-slide');
      if (!currentChart) return;
      const svgEl = currentChart.querySelector('svg');
      if (!svgEl) return;
      // 클릭 위치에서 가장 가까운 text 요소 찾기
      const pt = svgEl.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const svgPt = pt.matrixTransform(svgEl.getScreenCTM().inverse());
      const texts = Array.from(svgEl.querySelectorAll('text'));
      let closest = null, closestDist = Infinity;
      texts.forEach(t => {
        try {
          const bbox = t.getBBox();
          if (bbox.width === 0 && bbox.height === 0) return;
          // bbox에 여유 패딩 추가
          const pad = 8;
          const inBox = svgPt.x >= bbox.x - pad && svgPt.x <= bbox.x + bbox.width + pad &&
                        svgPt.y >= bbox.y - pad && svgPt.y <= bbox.y + bbox.height + pad;
          const cx = bbox.x + bbox.width/2, cy = bbox.y + bbox.height/2;
          const dist = Math.sqrt((svgPt.x - cx)**2 + (svgPt.y - cy)**2);
          if (inBox) {
            if (dist < closestDist) { closest = t; closestDist = 0; }
          } else if (dist < closestDist && dist < 80) {
            closest = t; closestDist = dist;
          }
        } catch(err) {}
      });
      if (closest) {
        svgEl.style.pointerEvents = 'auto';
        textClick({ stopPropagation(){}, target: closest });
        slide._dblFailCount = 0;
      } else {
        slide._dblFailCount = (slide._dblFailCount || 0) + 1;
        if (slide._dblFailCount >= 2) {
          showToast('💡 텍스트 수정이 잘 안되시나요? <b>⚙️ 설정</b>을 열어서 수정도 가능합니다');
          slide._dblFailCount = 0;
        }
      }
    });

    // 드래그 시도 감지 → 텍스트 수정 안내 토스트
    let _dragAttempts = 0;
    let _dragStart = null;
    el.addEventListener('mousedown', () => { _dragStart = Date.now(); });
    el.addEventListener('mouseup', (e) => {
      if (_dragStart && Date.now() - _dragStart > 300) {
        // 300ms 이상 누르고 있었으면 드래그 시도로 판단
        _dragAttempts++;
        if (_dragAttempts >= 2) {
          showToast('💡 텍스트 수정이 잘 안되시나요? <b>⚙️ 설정</b>을 열어서 수정도 가능합니다');
          _dragAttempts = 0;
        }
      } else {
        _dragAttempts = 0;
      }
      _dragStart = null;
    });

    chartArea.style.position = 'relative';

    // 텍스트 편집 버튼 (우측 하단)
    const textEditBtn = document.createElement('button');
    textEditBtn.className = 'text-edit-fab';
    textEditBtn.innerHTML = '✏️<span class="text-edit-fab-label">텍스트 편집</span>';
    textEditBtn.title = '텍스트 편집 모드';
    textEditBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentChart = chartArea.querySelector('.chart-slide');
      if (currentChart) toggleTextEditMode(currentChart, chartArea, textEditBtn);
    });
    chartArea.appendChild(textEditBtn);

    wrapper.appendChild(chartArea);

    // ── 툴바 이벤트 위임 (innerHTML 재생성에도 유지) ──
    toolbar.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;

      // 데이터 영역 다시 선택
      if (btn.classList.contains('reselect-btn')) {
        e.stopPropagation();
        if (slide._wb) {
          openSpreadsheetViewer(slide._wb, slide._wbName, slide);
        } else {
          const fd = slide.fullParsed || slide.parsed;
          const fakeSheetData = [fd.headers, ...fd.data];
          openSpreadsheetViewer({ _fakeSheets: [{ name: '데이터', data: fakeSheetData }] }, slide.title || '데이터', slide);
        }
        return;
      }

      // 행/열 바꾸기
      if (btn.classList.contains('transpose-btn')) {
        e.stopPropagation();
        slide.transposed = !slide.transposed;
        rerenderChart(slide, wrapper);
        saveProject();
        return;
      }

      // 앱 아이콘 토글
      if (btn.classList.contains('icon-toggle-btn')) {
        e.stopPropagation();
        slide.showAppIcons = slide.showAppIcons === false ? true : false;
        renderToolbarContent();
        rerenderChart(slide, wrapper);
        saveProject();
        return;
      }

      // 아이콘 드롭다운 트리거
      if (btn.classList.contains('icon-dropdown-trigger')) {
        e.stopPropagation();
        if (slide.showAppIcons === false) return;
        var ddMenu = btn.parentElement.querySelector('.icon-dropdown-menu');
        if (!ddMenu) return;
        ddMenu.classList.toggle('open');
        var closeDd = function(ev) {
          if (!ddMenu.contains(ev.target) && ev.target !== btn) {
            ddMenu.classList.remove('open');
            document.removeEventListener('click', closeDd);
          }
        };
        if (ddMenu.classList.contains('open')) setTimeout(function() { document.addEventListener('click', closeDd); }, 0);
        return;
      }

      // 아이콘 드롭다운 옵션 선택
      if (btn.classList.contains('icon-dd-opt') && !btn.classList.contains('palette-opt')) {
        e.stopPropagation();
        var prop = btn.dataset.prop;
        var val = btn.dataset.val;
        if (prop === 'iconShape') slide.iconShape = val;
        if (prop === 'iconSize') slide.iconSize = val;
        if (prop === 'lineIconMode') slide.lineIconMode = val;
        renderToolbarContent();
        rerenderChart(slide, wrapper);
        saveProject();
        return;
      }

      // 팔레트 버튼 클릭 → 드롭다운 토글
      if (btn.classList.contains('palette-btn')) {
        e.stopPropagation();
        var palMenu = toolbar.querySelector('.palette-dropdown-menu');
        if (!palMenu) return;
        var isOpen = palMenu.classList.contains('open');
        // 다른 드롭다운 닫기
        toolbar.querySelectorAll('.icon-dropdown-menu.open').forEach(function(m) { m.classList.remove('open'); });
        if (!isOpen) {
          palMenu.classList.add('open');
          setTimeout(function() {
            var closePal = function(ev) {
              if (!palMenu.contains(ev.target) && ev.target !== btn) {
                palMenu.classList.remove('open');
                document.removeEventListener('click', closePal);
              }
            };
            document.addEventListener('click', closePal);
          }, 0);
        }
        return;
      }

      // 팔레트 옵션 선택
      if (btn.classList.contains('palette-opt')) {
        e.stopPropagation();
        // 드롭다운 먼저 닫기
        toolbar.querySelectorAll('.icon-dropdown-menu.open').forEach(function(m) { m.classList.remove('open'); });
        var palKey = btn.dataset.palette;
        if (T.PALETTES[palKey]) {
          slide.palette = palKey;
          slide.colors = [...T.getPaletteColors(palKey)];
          rerenderChart(slide, wrapper);
          renderToolbarContent();
          saveProject();
        }
        return;
      }

      // 설정
      if (btn.classList.contains('edit-btn')) {
        e.stopPropagation();
        try { toggleInlineEditor(slide, wrapper); } catch(err) { alert('에디터 오류: ' + err.message); console.error(err); }
        return;
      }
      // PNG
      if (btn.classList.contains('dl-png-btn')) {
        e.stopPropagation();
        const chartEl = chartArea.querySelector('.chart-slide');
        const svgEl = chartEl.querySelector('svg');
        const prep = svgEl ? inlineSvgImages(svgEl) : Promise.resolve();
        prep.then(() => html2canvas(chartEl, { scale: 3, backgroundColor: '#F8F8F8', useCORS: true })).then(c => {
          c.toBlob(b => { if(b) { const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`${slide.title}.png`; a.click(); } }, 'image/png');
        });
        return;
      }
      // SVG
      if (btn.classList.contains('dl-svg-btn')) {
        e.stopPropagation();
        const chartEl = chartArea.querySelector('.chart-slide');
        const svgEl = chartEl.querySelector('svg');
        if (!svgEl) { alert('SVG 차트만 다운로드 가능합니다.'); return; }
        inlineSvgImages(svgEl).then(() => {
          const str = new XMLSerializer().serializeToString(svgEl);
          const blob = new Blob([str], {type:'image/svg+xml'});
          const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${slide.title}.svg`; a.click();
        });
        return;
      }
      // 피그마에서 열기 (SVG 클립보드 복사)
      if (btn.classList.contains('figma-btn')) {
        e.stopPropagation();
        const chartEl = chartArea.querySelector('.chart-slide');
        const svgEl = chartEl.querySelector('svg');
        if (!svgEl) { showToast('⚠️ SVG 차트만 지원해요', true); return; }
        inlineSvgImages(svgEl).then(() => {
          const str = new XMLSerializer().serializeToString(svgEl);
          navigator.clipboard.writeText(str).then(() => {
            showToast('✅ SVG가 클립보드에 복사됐어요!<br><span style="font-size:12px;opacity:0.85">피그마에서 <b>Cmd+V</b>로 붙여넣으세요</span>');
          }).catch(() => {
            // 폴백: textarea로 복사
            const ta = document.createElement('textarea');
            ta.value = str; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
            showToast('✅ SVG가 클립보드에 복사됐어요!<br><span style="font-size:12px;opacity:0.85">피그마에서 <b>Cmd+V</b>로 붙여넣으세요</span>');
          });
        });
        return;
      }
      // 삭제
      if (btn.classList.contains('del-btn')) {
        e.stopPropagation();
        if (!confirm('이 장표를 삭제하시겠어요?')) return;
        const idx = slides.indexOf(slide);
        if (idx >= 0) slides.splice(idx, 1);
        wrapper.style.transition = 'opacity 0.3s, transform 0.3s';
        wrapper.style.opacity = '0'; wrapper.style.transform = 'translateY(-10px)';
        setTimeout(() => { wrapper.remove(); updateProjectHeader(); saveProject(); }, 300);
        if (slides.length === 0) {
          results.style.display = 'none';
          onboarding.style.display = '';
          localStorage.removeItem('cs-project');
        }
        return;
      }
    });

    container.appendChild(wrapper);
    requestAnimationFrame(() => { wrapper.style.transition='opacity 0.5s, transform 0.5s'; wrapper.style.opacity='1'; wrapper.style.transform='translateY(0)'; });

    // 아이콘 프리로드: 데이터에서 앱 이름 추출 → API 검색 → 리렌더
    (function preloadIcons() {
      const parsed = slide.parsed || {};
      const headers = parsed.headers || [];
      const data = parsed.data || [];
      const meta = parsed.meta || {};
      const _skip = /^(순위|값|전체|날짜|분류|남성|여성|\d+대|총|경쟁앱|비율|비고|이탈|유입|유지|사용자|사용량|기간|구분|항목|합계|평균|증감|D|W|M)$/;
      const _notAppName = /^(이탈|유입|유지|경쟁앱|총\s|전체|사용자|사용량|신규|기존|순위|점유율|증감)/;
      const names = [];
      // 헤더(열 이름)에서 앱 이름 추출
      headers.slice(1).forEach(h => { if (h && !_skip.test(h) && !_notAppName.test(h)) names.push(h); });
      // 첫 번째 열(행 라벨)에서만 앱 이름 추출
      data.forEach(r => {
        const s = String(r[0] || '').trim();
        if (s && s.length >= 2 && s.length <= 30 && !/^[\d,.%\-+]+$/.test(s) && !_skip.test(s) && !_notAppName.test(s)) names.push(s);
      });
      if (meta.appName) names.push(meta.appName.replace('내 앱:', '').trim());
      const unique = [...new Set(names)].filter(n => n && !SvgCharts._appIcon(n));
      console.log('[아이콘 추출] names:', names, 'unique:', unique);
      if (unique.length > 0) {
        // 아이콘 상태 패널 표시
        const panel = document.createElement('div');
        panel.className = 'icon-status-panel';
        panel.innerHTML = '<div class="isp-header"><span>🖼️ 앱 아이콘 로딩</span><button class="isp-close">✕</button></div>' +
          '<div class="isp-list">' + unique.map(n => '<div class="isp-item" data-name="' + _h(n) + '"><span class="isp-icon">⏳</span><span class="isp-name">' + _h(n) + '</span><span class="isp-status">대기 중</span></div>').join('') + '</div>' +
          '<div class="isp-footer"></div>';
        document.body.appendChild(panel);
        panel.querySelector('.isp-close').addEventListener('click', () => panel.remove());

        const startTime = Date.now();
        const statusInterval = setInterval(() => {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          const footer = panel.querySelector('.isp-footer');
          if (elapsed < 5) footer.textContent = '서버 요청 중...';
          else if (elapsed < 15) footer.textContent = '서버 응답 대기 중... (' + elapsed + '초)';
          else footer.textContent = '서버 깨우는 중... (' + elapsed + '초)';
        }, 1000);

        SvgCharts.preloadAppIcons(unique).then(() => {
          clearInterval(statusInterval);
          // 각 앱 상태 업데이트
          unique.forEach(n => {
            const item = panel.querySelector('.isp-item[data-name="' + CSS.escape(n) + '"]');
            if (!item) return;
            const hasIcon = SvgCharts._appIcon(n);
            const iconEl = item.querySelector('.isp-icon');
            const statusEl = item.querySelector('.isp-status');
            if (hasIcon) {
              iconEl.textContent = '✅';
              statusEl.textContent = '완료';
              item.classList.add('isp-done');
            } else {
              iconEl.textContent = '❌';
              statusEl.innerHTML = '<input class="isp-url-input" type="text" placeholder="아이콘 URL 붙여넣기" spellcheck="false"><button class="isp-url-apply">적용</button>';
              item.classList.add('isp-fail');
              // URL 직접 입력 적용
              const applyBtn = statusEl.querySelector('.isp-url-apply');
              const urlInput = statusEl.querySelector('.isp-url-input');
              applyBtn.addEventListener('click', () => {
                const url = urlInput.value.trim();
                if (!url) return;
                // URL이면 프록시 경유, data:면 직접 사용
                if (url.startsWith('data:')) {
                  SvgCharts._iconCache[n] = url;
                } else if (url.startsWith('http')) {
                  SvgCharts._iconCache[n] = ApiClient.BASE_URL + '/icon?url=' + encodeURIComponent(url);
                } else {
                  SvgCharts._iconCache[n] = url;
                }
                try { localStorage.setItem('cs-icon-cache', JSON.stringify(SvgCharts._iconCache)); } catch(e) {}
                iconEl.textContent = '✅';
                statusEl.textContent = '적용됨';
                item.classList.remove('isp-fail');
                item.classList.add('isp-done');
                rerenderChart(slide, wrapper);
              });
              urlInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') applyBtn.click(); });
            }
          });
          const footer = panel.querySelector('.isp-footer');
          const loaded = unique.filter(n => SvgCharts._appIcon(n)).length;
          footer.textContent = loaded + '/' + unique.length + '개 완료' + (loaded < unique.length ? ' — 실패한 앱은 URL을 직접 입력할 수 있어요' : '');
          if (loaded === unique.length) setTimeout(() => panel.remove(), 2000);
          rerenderChart(slide, wrapper);
        }).catch(() => {
          clearInterval(statusInterval);
          panel.querySelector('.isp-footer').textContent = '⚠️ 서버 연결 실패';
        });
      }
    })();

    // 아이콘 로드 실패 감지 (scatter 차트)
    if (slide.chartKind === 'scatter') {
      setTimeout(() => {
        const images = el.querySelectorAll('svg image');
        if (images.length === 0) return;
        let failCount = 0, checked = 0;
        images.forEach(img => {
          const testImg = new Image();
          testImg.onload = () => { if (testImg.naturalWidth < 32 || testImg.naturalHeight < 32) failCount++; checked++; checkDone(); };
          testImg.onerror = () => { failCount++; checked++; checkDone(); };
          testImg.src = img.getAttribute('href');
        });
        function checkDone() {
          if (checked < images.length) return;
          if (failCount > 0) {
            const tip = document.createElement('div');
            tip.className = 'icon-tip';
            tip.innerHTML = `⚠️ 앱 아이콘이 안 보이시나요? <button class="icon-tip-btn">✏️ 여기서 직접 등록</button>`;
            tip.querySelector('.icon-tip-btn').addEventListener('click', () => { tip.remove(); toggleInlineEditor(slide, wrapper); });
            chartArea.appendChild(tip);
          }
        }
      }, 500);
    }
  }

  // ── 차트 리렌더 (에디터에서 실시간 업데이트) ──
  function rerenderChart(slide, wrapper) {
    const chartArea = wrapper.querySelector('.slide-chart-area');
    const oldChart = chartArea.querySelector('.chart-slide');

    SvgCharts._filterInfo = slide.filterInfo || '';
    const newEl = buildChart(slide);
    newEl.dataset.slideId = slide.id;

    if (oldChart) oldChart.replaceWith(newEl);

    // 깨진/실패 아이콘 감지 → 클릭 리로드 + 호버 툴팁
    setTimeout(() => {
      const svgEl = newEl.querySelector('svg');
      if (!svgEl) return;

      // 커스텀 툴팁 헬퍼
      let _tip = null;
      function showTip(e, text) {
        if (!_tip) {
          _tip = document.createElement('div');
          _tip.className = 'icon-tooltip';
          document.body.appendChild(_tip);
        }
        _tip.textContent = text;
        _tip.style.left = e.clientX + 12 + 'px';
        _tip.style.top = e.clientY - 30 + 'px';
        _tip.style.display = 'block';
      }
      function hideTip() { if (_tip) _tip.style.display = 'none'; }

      // 리로드 함수: 실패/깨진 캐시를 모두 지우고 다시 검색
      function reloadIcons() {
        const parsed = slide.parsed || {};
        const headers = parsed.headers || [];
        const data = parsed.data || [];
        const allNames = [...headers.slice(1), ...data.map(r => r[0])].filter(n => n && typeof n === 'string');
        // 이 장표의 모든 앱 캐시를 삭제 (깨진 URL 포함)
        allNames.forEach(n => { delete SvgCharts._iconCache[n]; });
        try { localStorage.setItem('cs-icon-cache', JSON.stringify(SvgCharts._iconCache)); } catch(e) {}
        SvgCharts.preloadAppIcons(allNames).then(() => rerenderChart(slide, wrapper));
      }

      // 깨진 이미지 감지
      const images = svgEl.querySelectorAll('image');
      images.forEach(img => {
        const testImg = new Image();
        const imgUrl = img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
        testImg.onload = () => { if (testImg.naturalWidth < 2 || testImg.naturalHeight < 2) makePlaceholder(img); };
        testImg.onerror = () => makePlaceholder(img);
        testImg.src = imgUrl;
        function makePlaceholder(imgEl) {
          const cx = parseFloat(imgEl.getAttribute('x')) + parseFloat(imgEl.getAttribute('width')) / 2;
          const cy = parseFloat(imgEl.getAttribute('y')) + parseFloat(imgEl.getAttribute('height')) / 2;
          const r = parseFloat(imgEl.getAttribute('width')) / 2;
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.setAttribute('style', 'cursor:pointer');
          g.innerHTML = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#F3F0FF" stroke="#E5E1F0" stroke-width="1.5"/>' +
            '<text x="' + cx + '" y="' + (cy + r * 0.35) + '" text-anchor="middle" font-size="' + (r * 0.7) + '" fill="#8B7FC7" font-weight="600">↻</text>';
          g.addEventListener('mouseenter', (e) => showTip(e, '아이콘 로드 실패 — 클릭하면 다시 시도'));
          g.addEventListener('mouseleave', hideTip);
          g.addEventListener('click', (ev) => { ev.stopPropagation(); hideTip(); reloadIcons(); });
          imgEl.parentNode.replaceChild(g, imgEl);
        }
      });

      // SVG 내 플레이스홀더(첫 글자 원)에도 클릭 리로드 + 툴팁
      svgEl.querySelectorAll('g').forEach(g => {
        const title = g.querySelector('title');
        if (!title || !title.textContent.includes('찾을 수 없습니다')) return;
        g.setAttribute('style', 'cursor:pointer');
        const match = title.textContent.match(/"(.+?)"/);
        const appName = match ? match[1] : '';
        title.remove(); // 네이티브 툴팁 제거
        g.addEventListener('mouseenter', (e) => showTip(e, '"' + appName + '" 아이콘을 찾지 못했어요 — 클릭하면 다시 시도'));
        g.addEventListener('mouseleave', hideTip);
        g.addEventListener('click', (ev) => {
          ev.stopPropagation();
          hideTip();
          if (appName) {
            delete SvgCharts._iconCache[appName];
            try { localStorage.setItem('cs-icon-cache', JSON.stringify(SvgCharts._iconCache)); } catch(e) {}
            SvgCharts.preloadAppIcons([appName]).then(() => rerenderChart(slide, wrapper));
          }
        });
      });

      // 스피너(로딩 중 아이콘)에도 클릭 리로드 + 툴팁
      svgEl.querySelectorAll('circle').forEach(circle => {
        const anim = circle.querySelector('animateTransform');
        if (!anim) return;
        const parent = circle.parentNode;
        if (parent.tagName === 'g' && parent._hasReload) return;
        // 스피너의 배경 원 찾기 (같은 위치의 이전 형제)
        const bg = circle.previousElementSibling;
        if (!bg || bg.tagName !== 'circle') return;
        const cx = bg.getAttribute('cx');
        const cy = bg.getAttribute('cy');
        const r = bg.getAttribute('r');
        // 투명 클릭 영역 추가
        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hitArea.setAttribute('cx', cx);
        hitArea.setAttribute('cy', cy);
        hitArea.setAttribute('r', r);
        hitArea.setAttribute('fill', 'transparent');
        hitArea.setAttribute('style', 'cursor:pointer');
        hitArea.addEventListener('mouseenter', (e) => showTip(e, '아이콘 로딩 중... 클릭하면 다시 시도'));
        hitArea.addEventListener('mouseleave', hideTip);
        hitArea.addEventListener('click', (ev) => { ev.stopPropagation(); hideTip(); reloadIcons(); });
        circle.parentNode.insertBefore(hitArea, circle.nextSibling);
      });
    }, 500);

    // 드롭다운 트리거 텍스트 동기화
    const trigger = chartArea.querySelector('.kd-trigger');
    if (trigger) {
      const current = T.KINDS[slide.chartKind] || { icon: '📊', label: '차트' };
      trigger.innerHTML = `${current.icon} ${current.label} <span class="kd-change">변경하기</span><span class="kd-arrow">▾</span>`;
    }
  }

  // ── 인라인 에디터 (오른쪽 패널) ──
  function toggleInlineEditor(slide, wrapper) {
    const existing = wrapper.querySelector('.inline-editor');
    if (existing) {
      existing.remove();
      wrapper.classList.remove('editing');
      wrapper.style.transform = '';
      return;
    }

    wrapper.style.transform = '';
    wrapper.classList.add('editing');
    const panel = document.createElement('div');
    panel.className = 'inline-editor';

    const fullData = slide.fullParsed ? slide.fullParsed.data : slide.parsed.data;
    const allHeaders = slide.parsed.headers;

    const dataType = slide.parsed?.type || slide.fullParsed?.type || '';
    const recommended = Parser.getRecommendedKinds(dataType, slide.parsed?.headers || [], slide.parsed?.data || []);
    const kindOptions = buildKindOptionsHTML(slide.chartKind, recommended);

    // 항목 유형 자동 파악
    const firstColName = allHeaders[0] || '항목';
    const sampleVals = fullData.slice(0, 3).map(r => r[0] || '');
    let itemType = '항목';
    if (sampleVals.some(v => /\d{4}[-\/\.]/.test(v))) itemType = '기간';
    else if (/앱|이름/i.test(firstColName)) itemType = '앱';
    else if (firstColName.includes('순위')) itemType = '순위';
    else if (firstColName.includes('분류')) itemType = '분류';
    else itemType = firstColName || '항목';

    const hasRange = fullData.length > 1;
    const rangeOptions = fullData.map((r, i) => `<option value="${i}">${_h(r[0] || (i+1))}</option>`).join('');
    const curStart = slide.rangeStart || 0;
    const curEnd = slide.rangeEnd != null ? slide.rangeEnd : fullData.length - 1;

    // 시리즈 이름 추출 (아이콘 URL 입력용)
    const ieSeriesNames = [];
    if (slide.chartKind === 'scatter' || slide.parsed.type === 'loyalty_compare') {
      const ni = allHeaders.findIndex(h => h.includes('앱') || h.includes('이름'));
      fullData.forEach(r => ieSeriesNames.push(r[ni >= 0 ? ni : 0] || ''));
    }

    // ── 역할 정의 ──
    const colRoleOpts = { label: '이름', value: '숫자', series: '구분', ignore: '제외' };
    const rowRoleOpts = { data: '데이터', ignore: '무시' };
    const roleColors = { label: '#6C5CE7', value: '#00B894', series: '#FDCB6E', ignore: '#B2BEC3', data: '#00B894' };

    // 초기화: 열 역할
    if (!slide.colRoles || slide.colRoles.length !== allHeaders.length) {
      slide.colRoles = allHeaders.map((_, i) => i === 0 ? 'label' : 'value');
    }
    // 초기화: 행 역할
    if (!slide.rowRoles || slide.rowRoles.length !== fullData.length) {
      slide.rowRoles = fullData.map(() => 'data');
    }

    // ── 미리보기 테이블 HTML ──
    const maxPreviewRows = 10;
    const previewRows = fullData.slice(0, maxPreviewRows);
    const previewColCount = Math.min(allHeaders.length, 5);
    const truncatedCols = allHeaders.length > previewColCount;
    const truncatedRows = fullData.length > maxPreviewRows;

    // 열 역할 드롭다운 행
    // 헤더 행
    const headerRowHTML = `<tr>
      ${allHeaders.slice(0, previewColCount).map((h, ci) => {
        return `<th class="ie-preview-th">${_h(h)}</th>`;
      }).join('')}
      ${truncatedCols ? `<th class="ie-preview-th ie-preview-more">+${allHeaders.length - previewColCount}</th>` : ''}
    </tr>`;

    // 데이터 행
    const dataRowsHTML = previewRows.map((row, ri) => {
      return `<tr data-row="${ri}">
        ${row.slice(0, previewColCount).map((cell, ci) => {
          return `<td class="ie-preview-td">${_h(cell || '')}</td>`;
        }).join('')}
        ${truncatedCols ? '<td class="ie-preview-td ie-preview-more">…</td>' : ''}
      </tr>`;
    }).join('');

    const moreRowHTML = truncatedRows
      ? `<tr><td class="ie-preview-td ie-preview-more" colspan="${previewColCount + (truncatedCols?1:0)}">… 외 ${fullData.length - maxPreviewRows}행</td></tr>`
      : '';

    const previewHTML = `<div class="ie-preview-wrap">
      <div class="ie-preview-scroll">
        <table class="ie-preview-table">
          <thead>${headerRowHTML}</thead>
          <tbody>${dataRowsHTML}${moreRowHTML}</tbody>
        </table>
      </div>
    </div>`;

    // 무시된 행/열 카운트
    const ignoredCols = slide.colRoles.filter(r => r === 'ignore').length;
    const ignoredRows = slide.rowRoles.filter(r => r === 'ignore').length;
    const summaryParts = [];
    if (ignoredCols > 0) summaryParts.push(`${ignoredCols}열 무시`);
    if (ignoredRows > 0) summaryParts.push(`${ignoredRows}행 무시`);
    const summaryText = summaryParts.length > 0 ? summaryParts.join(', ') : '전체 사용 중';

    panel.innerHTML = `
      <div class="ie-header">
        <span>장표 설정</span>
        <button class="ie-close">✕</button>
      </div>
      <div class="ie-body">
        <div class="ie-field">
          <label>타이틀</label>
          <input type="text" class="ie-input" data-key="title" value="${_h(slide.title)}">
        </div>
        <div class="ie-field">
          <label>부제목</label>
          <input type="text" class="ie-input" data-key="subtitle" value="${_h(slide.subtitle||'')}">
        </div>
        <div class="ie-field">
          <label>출처</label>
          <input type="text" class="ie-input" data-key="source" value="${_h(slide.source||'')}" placeholder="선택">
        </div>
        <div class="ie-field">
          <label>필터 정보</label>
          <div style="display:flex;gap:6px;align-items:center">
            <input type="text" class="ie-input" data-key="filterInfo" value="${_h(slide.filterInfo||'')}" placeholder="OS: Android+iOS / 기간: 2024.03 / 성별: 전체 / 연령: 전체" style="flex:1">
            <button type="button" class="btn-filter-example" title="예시 채우기" style="white-space:nowrap;padding:4px 10px;border:1px solid #ccc;border-radius:6px;background:#f5f5ff;cursor:pointer;font-size:12px;">예시</button>
          </div>
        </div>
        ${['bubble','heatmap','table','flowCard','venn'].includes(slide.chartKind) ? '' : `<div class="ie-field">
          <label>🔢 숫자 표시</label>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
              <input type="checkbox" class="ie-val-label-toggle" ${slide.hideValueLabels ? '' : 'checked'} style="accent-color:var(--accent);width:15px;height:15px">
              <span>값 표시</span>
            </label>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:12px;color:var(--text-muted)">소수점</span>
              <select class="ie-select ie-decimal-select" style="width:auto;padding:4px 8px;font-size:12px">
                <option value="0" ${(slide.decimalPlaces||0)===0?'selected':''}>없음</option>
                <option value="1" ${slide.decimalPlaces===1?'selected':''}>1자리</option>
                <option value="2" ${slide.decimalPlaces===2?'selected':''}>2자리</option>
              </select>
            </div>
          </div>
        </div>`}
        ${(() => {
          // 범례 설정 — 시리즈 2개 이상 또는 도넛일 때
          const legendHeaders = [];
          for (let i = 1; i < allHeaders.length; i++) {
            if (fullData.some(r => !isNaN(Number(r[i])))) legendHeaders.push({ idx: i, name: allHeaders[i] });
          }
          if (legendHeaders.length < 2 && slide.chartKind !== 'donut') return '';
          if (!slide.legendNames) slide.legendNames = {};
          const showLegend = slide.showLegend !== false;
          const items = legendHeaders.map(h => {
            const customName = slide.legendNames[h.name] || '';
            return `<div style="display:flex;align-items:center;gap:6px;font-size:12px">
              <span style="color:var(--text-muted);min-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_h(h.name)}</span>
              <span style="color:var(--text-muted)">→</span>
              <input type="text" class="ie-input ie-legend-name" data-orig="${_h(h.name)}" value="${_h(customName)}" placeholder="${_h(h.name)}" style="flex:1;font-size:11px;padding:4px 8px">
            </div>`;
          }).join('');
          return `<div class="ie-field">
            <label>📋 범례</label>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;margin-bottom:6px">
              <input type="checkbox" class="ie-legend-toggle" ${showLegend ? 'checked' : ''} style="accent-color:var(--accent);width:15px;height:15px">
              <span>범례 표시</span>
            </label>
            ${showLegend ? `<div style="display:flex;flex-direction:column;gap:4px">${items}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:4px">비워두면 원래 이름 사용</div>` : ''}
          </div>`;
        })()}
        <details class="ie-advanced">
          <summary class="ie-advanced-toggle">🔧 고급 설정</summary>
          <div class="ie-advanced-body">
        <div class="ie-field">
        ${slide.chartKind === 'scatter' || slide.parsed.type === 'loyalty_compare' ? `
        <div class="ie-field">
          <label>앱 아이콘 URL</label>
          <div style="display:flex;flex-direction:column;gap:6px" class="ie-icon-url-list">
            ${ieSeriesNames.map((name, i) => `
              <div style="display:flex;align-items:center;gap:6px">
                ${slide.iconUrls[name] ? `<img src="${_safeUrl(slide.iconUrls[name])}" width="20" height="20" style="border-radius:4px">` : `<div style="width:20px;height:20px;border-radius:4px;background:#EEE;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">${_h(name.charAt(0))}</div>`}
                <input type="text" class="ie-input ie-icon-url-input" data-name="${_h(name)}" value="${_h(slide.iconUrls[name]||'')}" placeholder="${_h(name)} 아이콘 URL" style="flex:1;font-size:11px">
              </div>
            `).join('')}
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">이미지 URL을 붙여넣으세요 (비워두면 자동 감지)</div>
        </div>` : ''}
        <div class="ie-field">
          <button class="ie-transpose" data-active="${slide.transposed}">🔄 행/열 바꾸기 ${slide.transposed?'(전환됨)':''}</button>
        </div>
        ${hasRange ? `
        <div class="ie-field">
          <label>표시할 ${itemType} (${fullData.length}개)</label>
          <div style="display:flex;gap:8px;align-items:center">
            <select class="ie-select" data-key="rangeStart">${rangeOptions}</select>
            <span style="color:var(--text-muted)">~</span>
            <select class="ie-select" data-key="rangeEnd">${rangeOptions}</select>
          </div>
        </div>` : ''}
          </div>
        </details>
      </div>
    `;

    wrapper.appendChild(panel);

    // 에디터 높이를 차트 높이에 맞추기
    requestAnimationFrame(() => {
      const chartEl = wrapper.querySelector('.chart-slide');
      if (chartEl) {
        const h = chartEl.offsetHeight;
        panel.style.height = h + 'px';
        panel.style.maxHeight = h + 'px';
      }
    });

    // 닫기
    panel.querySelector('.ie-close').addEventListener('click', () => {
      panel.remove();
      wrapper.classList.remove('editing');
      wrapper.style.transform = '';
    });

    // 예시 버튼
    panel.querySelector('.btn-filter-example')?.addEventListener('click', () => {
      const inp = panel.querySelector('[data-key="filterInfo"]');
      if (inp) { inp.value = 'OS: Android+iOS / 기간: 2024.03 / 성별: 전체 / 연령: 전체'; inp.dispatchEvent(new Event('input', {bubbles:true})); }
    });

    // 범위 초기값
    if (hasRange) {
      panel.querySelector('[data-key="rangeStart"]').value = curStart;
      panel.querySelector('[data-key="rangeEnd"]').value = curEnd;
    }

    // 요약 텍스트 업데이트 헬퍼
    const updateSummary = () => {
      const ic = slide.colRoles.filter(r => r === 'ignore').length;
      const ir = slide.rowRoles.filter(r => r === 'ignore').length;
      const parts = [];
      if (ic > 0) parts.push(`${ic}열 무시`);
      if (ir > 0) parts.push(`${ir}행 무시`);
      const el = panel.querySelector('.ie-preview-summary');
      if (el) el.textContent = parts.length > 0 ? parts.join(', ') : '전체 사용 중';
    };

    // 실시간 업데이트 함수
    const liveUpdate = () => {
      panel.querySelectorAll('.ie-input:not(.ie-icon-url-input)').forEach(inp => { slide[inp.dataset.key] = inp.value; });
      // 아이콘 URL 업데이트
      panel.querySelectorAll('.ie-icon-url-input').forEach(inp => {
        const name = inp.dataset.name;
        const url = _safeUrl(inp.value);
        if (url) slide.iconUrls[name] = url;
        else delete slide.iconUrls[name];
      });
      // 범위
      if (hasRange) {
        const s = Number(panel.querySelector('[data-key="rangeStart"]').value);
        const e = Number(panel.querySelector('[data-key="rangeEnd"]').value);
        slide.rangeStart = Math.min(s, e);
        slide.rangeEnd = Math.max(s, e);
        const baseParsed = slide.fullParsed || slide.parsed;
        slide.parsed = { ...baseParsed, data: baseParsed.data.slice(slide.rangeStart, slide.rangeEnd + 1) };
      }
      updateSummary();
      rerenderChart(slide, wrapper);
      saveProject();
    };

    // 이벤트 바인딩
    panel.querySelectorAll('.ie-input').forEach(inp => inp.addEventListener('input', liveUpdate));
    panel.querySelectorAll('.ie-select').forEach(sel => sel.addEventListener('change', liveUpdate));

    // 값 라벨 표시 토글
    const vlToggle = panel.querySelector('.ie-val-label-toggle');
    if (vlToggle) {
      vlToggle.addEventListener('change', () => {
        slide.hideValueLabels = !vlToggle.checked;
        liveUpdate();
      });
    }

    // 소수점 자릿수
    const decSelect = panel.querySelector('.ie-decimal-select');
    if (decSelect) {
      decSelect.addEventListener('change', () => {
        slide.decimalPlaces = Number(decSelect.value);
        liveUpdate();
      });
    }

    // 범례 토글
    const legendToggle = panel.querySelector('.ie-legend-toggle');
    if (legendToggle) {
      legendToggle.addEventListener('change', () => {
        slide.showLegend = legendToggle.checked;
        liveUpdate();
      });
    }
    // 범례 이름 편집
    panel.querySelectorAll('.ie-legend-name').forEach(inp => {
      inp.addEventListener('input', () => {
        if (!slide.legendNames) slide.legendNames = {};
        const orig = inp.dataset.orig;
        slide.legendNames[orig] = inp.value;
        liveUpdate();
      });
    });

    // 행/열 바꾸기
    const transposeBtn = panel.querySelector('.ie-transpose');
    if (transposeBtn) {
      transposeBtn.addEventListener('click', () => {
        slide.transposed = !slide.transposed;
        transposeBtn.dataset.active = slide.transposed;
        transposeBtn.textContent = '🔄 행/열 바꾸기 ' + (slide.transposed ? '(전환됨)' : '');
        liveUpdate();
      });
    }

    // ── 차트 내 데이터 위치 하이라이트 헬퍼 ──
    function highlightInChart(ri, ci, sourceEl) {
      // 이전 하이라이트 제거
      wrapper.querySelectorAll('.chart-hl-box').forEach(el => el.remove());
      wrapper.querySelectorAll('.chart-highlight-pulse').forEach(el => el.remove());
      if (sourceEl) {
        const root = sourceEl.closest('.ie-preview-table, .dm-table') || panel;
        root.querySelectorAll('.ie-cell-active').forEach(el => el.classList.remove('ie-cell-active'));
        sourceEl.classList.add('ie-cell-active');
      }

      const chartEl = wrapper.querySelector('.chart-slide');
      if (!chartEl) return;
      const svgEl = chartEl.querySelector('svg');
      if (!svgEl) return;

      const cellValue = fullData[ri] ? String(fullData[ri][ci] || '').trim() : '';
      const rowLabel = fullData[ri] ? String(fullData[ri][0] || '').trim() : '';
      const colRole = slide.colRoles ? slide.colRoles[ci] : 'value';
      if (!cellValue) return;

      // SVG 좌표 → DOM 좌표 변환
      const svgRect = svgEl.getBoundingClientRect();
      const chartRect = chartEl.getBoundingClientRect();
      const vb = svgEl.viewBox.baseVal;
      const scaleX = svgRect.width / (vb.width || 1200);
      const scaleY = svgRect.height / (vb.height || 750);
      const offsetX = svgRect.left - chartRect.left;
      const offsetY = svgRect.top - chartRect.top;

      chartEl.style.position = 'relative';
      let found = false;

      // ── 필터링된 차트 데이터에서의 실제 인덱스 계산 ──
      const filtered = applyVisibleCols(slide);
      const fLabels = filtered.data.map(r => String(r[0] || '').trim());
      const dataRowIdx = fLabels.indexOf(rowLabel); // 필터링된 데이터에서의 행 인덱스

      // 필터링된 헤더에서 열 인덱스 찾기
      const origHeader = allHeaders[ci] || '';
      const fColIdx = filtered.headers.indexOf(origHeader);

      // ── 1. SVG circle/rect 요소로 직접 위치 찾기 (가장 정확) ──
      if (colRole !== 'label' && dataRowIdx >= 0) {
        const kind = slide.chartKind;
        const seriesIdx = fColIdx > 0 ? fColIdx - 1 : -1;
        const numLabels = fLabels.length;

        if (kind === 'horizontalBar') {
          // 수평 바: 행마다 track rect + fill rect 순서로 2개씩
          // fill rect = track 바로 다음 rect (같은 y좌표, 색상이 다름)
          const allRects = Array.from(svgEl.querySelectorAll('rect'));
          // track + fill 쌍으로 묶기: track 색상(T.track)인 것 다음이 fill
          const fillRects = allRects.filter(r => {
            const fill = r.getAttribute('fill') || '';
            return fill !== T.track && fill !== T.bg && fill !== '#F8F8F8' && fill !== '#FFFFFF'
              && !fill.startsWith('url(') && parseFloat(r.getAttribute('height') || 0) > 0
              && parseFloat(r.getAttribute('width') || 0) > 0
              && r.getAttribute('rx'); // 바 rect는 rx가 있음
          });
          if (fillRects[dataRowIdx]) {
            try {
              const bbox = fillRects[dataRowIdx].getBBox();
              const box = document.createElement('div');
              box.className = 'chart-hl-box';
              const pad = 4;
              box.style.left = (offsetX + (bbox.x - pad) * scaleX) + 'px';
              box.style.top = (offsetY + (bbox.y - pad) * scaleY) + 'px';
              box.style.width = ((bbox.width + pad*2) * scaleX) + 'px';
              box.style.height = ((bbox.height + pad*2) * scaleY) + 'px';
              box.style.borderColor = roleColors[colRole] || '#00B894';
              chartEl.appendChild(box);
              found = true;
            } catch(e) {}
          }
        } else if (kind === 'splitBar') {
          // 스플릿 바: 데이터가 전치됨
          // 차트 labels = 열 헤더(앱명), 차트 series = 행(연령대 등)
          // 테이블 ri(행) → 차트의 시리즈(세그먼트) 인덱스
          // 테이블 ci(열) → 차트의 라벨(바) 인덱스
          const segRects = Array.from(svgEl.querySelectorAll('rect[clip-path]'));

          // 필터링된 데이터에서 행/열 매핑
          const fHeaders = filtered.headers; // [라벨열, 값열1, 값열2, ...]
          const fData = filtered.data;

          // 차트의 labels = 값 열 헤더들 (인덱스 1부터)
          const chartLabels = fHeaders.slice(1);
          // 차트의 series = 데이터 행들
          const chartSeriesCount = fData.length;

          // 클릭한 셀의 열 헤더가 차트 labels에서 몇 번째인지 (= 차트의 바 인덱스)
          const barIdx = chartLabels.indexOf(origHeader);
          // 클릭한 셀의 행이 필터링된 데이터에서 몇 번째인지 (= 차트의 세그먼트 인덱스)
          const segIdx = dataRowIdx;

          if (barIdx >= 0 && segIdx >= 0 && chartSeriesCount > 0) {
            // 세그먼트 rect 순서: bar0[seg0,seg1,...], bar1[seg0,seg1,...], ...
            const targetIdx = barIdx * chartSeriesCount + segIdx;
            if (segRects[targetIdx]) {
              try {
                const bbox = segRects[targetIdx].getBBox();
                const box = document.createElement('div');
                box.className = 'chart-hl-box';
                const pad = 4;
                box.style.left = (offsetX + (bbox.x - pad) * scaleX) + 'px';
                box.style.top = (offsetY + (bbox.y - pad) * scaleY) + 'px';
                box.style.width = ((bbox.width + pad*2) * scaleX) + 'px';
                box.style.height = ((bbox.height + pad*2) * scaleY) + 'px';
                box.style.borderColor = roleColors[colRole] || '#00B894';
                chartEl.appendChild(box);
                found = true;
              } catch(e) {}
            }
          }
        } else {
          // 라인 차트: circle 요소들
          const circles = Array.from(svgEl.querySelectorAll('circle:not([r="0"])'));
          if (seriesIdx >= 0 && numLabels > 0) {
            const targetCircleIdx = seriesIdx * numLabels + dataRowIdx;
            const dataCircles = circles.filter(c => c.getAttribute('stroke') && c.getAttribute('stroke-width'));
            if (dataCircles[targetCircleIdx]) {
              try {
                const bbox = dataCircles[targetCircleIdx].getBBox();
                const box = document.createElement('div');
                box.className = 'chart-hl-box';
                const pad = 8;
                box.style.left = (offsetX + (bbox.x - pad/2) * scaleX) + 'px';
                box.style.top = (offsetY + (bbox.y - pad/2) * scaleY) + 'px';
                box.style.width = ((bbox.width + pad) * scaleX) + 'px';
                box.style.height = ((bbox.height + pad) * scaleY) + 'px';
                box.style.borderColor = roleColors[colRole] || '#00B894';
                box.style.borderRadius = '50%';
                chartEl.appendChild(box);
                found = true;
              } catch(e) {}
            }
          }

          // 세로 바 차트: rect 요소들
          if (!found) {
            const rects = Array.from(svgEl.querySelectorAll('rect')).filter(r => {
              const fill = r.getAttribute('fill') || '';
              return fill !== T.bg && fill !== T.track && fill !== '#F8F8F8' && fill !== '#FFFFFF'
                && !fill.startsWith('url(') && r.getAttribute('height') !== String(vb.height || 750)
                && parseFloat(r.getAttribute('height') || 0) > 0;
            });
            const numSeries = filtered.headers.length - 1;
            if (seriesIdx >= 0 && numLabels > 0 && rects.length >= numLabels) {
              const targetIdx = dataRowIdx * numSeries + seriesIdx;
              if (rects[targetIdx]) {
                try {
                  const bbox = rects[targetIdx].getBBox();
                  const box = document.createElement('div');
                  box.className = 'chart-hl-box';
                  const pad = 4;
                  box.style.left = (offsetX + (bbox.x - pad) * scaleX) + 'px';
                  box.style.top = (offsetY + (bbox.y - pad) * scaleY) + 'px';
                  box.style.width = ((bbox.width + pad*2) * scaleX) + 'px';
                  box.style.height = ((bbox.height + pad*2) * scaleY) + 'px';
                  box.style.borderColor = roleColors[colRole] || '#00B894';
                  chartEl.appendChild(box);
                  found = true;
                } catch(e) {}
              }
            }
          }
        }
      }

      // ── 2. 텍스트 매칭 폴백 (위 방법으로 못 찾았을 때) ──
      if (!found) {
        const numVal = Number(cellValue);
        const matchTexts = [cellValue];
        if (!isNaN(numVal)) {
          matchTexts.push(T.fmt(numVal), T.fmtTick(numVal), numVal.toLocaleString(),
            numVal.toFixed(1), String(Math.round(numVal)),
            numVal.toFixed(1) + '%', Math.round(numVal) + '%', numVal.toFixed(2));
        }

        const textEls = Array.from(svgEl.querySelectorAll('text'));

        // 라벨 위치 찾기
        let labelBBox = null;
        if (rowLabel) {
          for (const txt of textEls) {
            if (txt.textContent.trim() === rowLabel) {
              try { labelBBox = txt.getBBox(); } catch(e) {}
              break;
            }
          }
        }

        if (colRole === 'label') {
          if (labelBBox) {
            const box = document.createElement('div');
            box.className = 'chart-hl-box';
            const pad = 4;
            box.style.left = (offsetX + labelBBox.x * scaleX - pad) + 'px';
            box.style.top = (offsetY + labelBBox.y * scaleY - pad) + 'px';
            box.style.width = (labelBBox.width * scaleX + pad * 2) + 'px';
            box.style.height = (labelBBox.height * scaleY + pad * 2) + 'px';
            box.style.borderColor = roleColors[colRole] || '#6C5CE7';
            chartEl.appendChild(box);
            found = true;
          }
        } else {
          // 시리즈 헤더(범례)의 위치도 찾아서 근접 매칭에 활용
          const origHeader = allHeaders[ci] || '';
          let headerBBox = null;
          for (const txt of textEls) {
            if (txt.textContent.trim() === origHeader) {
              try { headerBBox = txt.getBBox(); } catch(e) {}
              break;
            }
          }

          const candidates = [];
          textEls.forEach(txt => {
            const content = txt.textContent.trim();
            const isMatch = matchTexts.some(m => m && content === m);
            if (!isMatch) return;
            try {
              const bbox = txt.getBBox();
              // 라벨과 헤더(범례) 양쪽 거리를 합산해서 가장 가까운 것 선택
              let dist = 0;
              if (labelBBox) {
                const dx = (bbox.x + bbox.width/2) - (labelBBox.x + labelBBox.width/2);
                const dy = (bbox.y + bbox.height/2) - (labelBBox.y + labelBBox.height/2);
                dist += Math.sqrt(dx*dx + dy*dy);
              }
              // 같은 시리즈(열) 색상의 텍스트를 우선
              const fill = txt.getAttribute('fill') || '';
              candidates.push({ txt, bbox, dist, fill });
            } catch(e) {}
          });

          if (candidates.length > 0) {
            candidates.sort((a, b) => a.dist - b.dist);
            const best = candidates[0];
            const box = document.createElement('div');
            box.className = 'chart-hl-box';
            const pad = 4;
            box.style.left = (offsetX + best.bbox.x * scaleX - pad) + 'px';
            box.style.top = (offsetY + best.bbox.y * scaleY - pad) + 'px';
            box.style.width = (best.bbox.width * scaleX + pad * 2) + 'px';
            box.style.height = (best.bbox.height * scaleY + pad * 2) + 'px';
            box.style.borderColor = roleColors[colRole] || '#6C5CE7';
            chartEl.appendChild(box);
            found = true;
          }

          if (!found && labelBBox) {
            const box = document.createElement('div');
            box.className = 'chart-hl-box';
            const pad = 4;
            box.style.left = (offsetX + labelBBox.x * scaleX - pad) + 'px';
            box.style.top = (offsetY + labelBBox.y * scaleY - pad) + 'px';
            box.style.width = (labelBBox.width * scaleX + pad * 2) + 'px';
            box.style.height = (labelBBox.height * scaleY + pad * 2) + 'px';
            box.style.borderColor = '#6C5CE7';
            chartEl.appendChild(box);
            found = true;
          }
        }
      }

      // 하단 툴팁
      const roleName = colRole === 'label' ? '이름' : colRole === 'value' ? '숫자' : colRole === 'series' ? '구분' : '제외';
      const tooltip = document.createElement('div');
      tooltip.className = 'chart-highlight-pulse';
      tooltip.innerHTML = `<span class="hl-dot" style="background:${roleColors[colRole]}"></span>
        <span class="hl-text">"${_h(cellValue)}" → ${roleName} · ${_h(rowLabel || '행 '+(ri+1))}</span>`;
      chartEl.appendChild(tooltip);

      setTimeout(() => {
        wrapper.querySelectorAll('.chart-hl-box').forEach(el => el.remove());
        tooltip.remove();
        if (sourceEl) sourceEl.classList.remove('ie-cell-active');
      }, 4000);
    }

    // ── 셀 클릭 → 차트 하이라이트 ──
    panel.querySelectorAll('.ie-preview-td[data-role]:not(.ie-preview-more)').forEach(td => {
      td.addEventListener('click', () => {
        const tr = td.closest('tr');
        const ri = tr ? Number(tr.dataset.row) : -1;
        const ci = Array.from(td.parentElement.children).indexOf(td) - 1;
        if (ri < 0 || ci < 0) return;
        highlightInChart(ri, ci, td);
      });
    });

    // ── 확대 모달 (분할 뷰: 왼쪽 차트 + 오른쪽 데이터) ──
    const expandBtn = panel.querySelector('.ie-expand-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        const old = document.getElementById('dataExpandModal');
        if (old) old.remove();

        const modal = document.createElement('div');
        modal.id = 'dataExpandModal';
        modal.className = 'data-expand-modal';

        // 전체 데이터 테이블 생성
        const allColCount = allHeaders.length;
        const colRoleRow = allHeaders.map((_, ci) => {
          const r = slide.colRoles[ci] || 'value';
          return `<th><select class="ie-col-role dm-col-role" data-col="${ci}" style="border-color:${roleColors[r]};color:${roleColors[r]}">
            ${Object.entries(colRoleOpts).map(([k,v]) => `<option value="${k}" ${r===k?'selected':''}>${v}</option>`).join('')}
          </select></th>`;
        }).join('');

        const headerRow = allHeaders.map((h, ci) => {
          const r = slide.colRoles[ci] || 'value';
          return `<th class="ie-preview-th" data-role="${r}" data-ci="${ci}">${_h(h)}</th>`;
        }).join('');

        const bodyRows = fullData.map((row, ri) => {
          const rr = slide.rowRoles[ri] || 'data';
          return `<tr data-row="${ri}" data-rowrole="${rr}">
            <td class="ie-row-role-cell">
              <button class="ie-row-tag dm-row-tag" data-row="${ri}" data-role="${rr}" style="background:${rr==='data'?roleColors.data:roleColors.ignore}">${rr==='data'?'✓':'✕'}</button>
            </td>
            ${row.map((cell, ci) => {
              const cr = slide.colRoles[ci] || 'value';
              return `<td class="ie-preview-td dm-cell" data-role="${cr}" data-rowrole="${rr}" data-ri="${ri}" data-ci="${ci}">${_h(cell || '')}</td>`;
            }).join('')}
          </tr>`;
        }).join('');

        // 차트 SVG 복제
        const origChart = wrapper.querySelector('.chart-slide');
        const chartCloneHTML = origChart ? origChart.innerHTML : '';

        modal.innerHTML = `
          <div class="dm-backdrop"></div>
          <div class="dm-split-panel">
            <div class="dm-header">
              <span>📋 데이터 매핑 (${fullData.length}행 × ${allColCount}열)</span>
              <div class="dm-header-actions">
                <div class="dm-callout-inline">
                  <span><span class="ie-callout-dot" style="background:#6C5CE7"></span>이름</span>
                  <span><span class="ie-callout-dot" style="background:#00B894"></span>숫자</span>
                  <span><span class="ie-callout-dot" style="background:#FDCB6E"></span>구분</span>
                  <span><span class="ie-callout-dot" style="background:#B2BEC3"></span>제외</span>
                </div>
                <button class="dm-close">✕</button>
              </div>
            </div>
            <div class="dm-split-body">
              <div class="dm-chart-side">
                <div class="dm-chart-preview">${chartCloneHTML}</div>
                <div class="dm-chart-hint">셀을 클릭하면 차트에서 위치가 표시돼요</div>
              </div>
              <div class="dm-data-side">
                <div class="dm-scroll">
                  <table class="ie-preview-table dm-table">
                    <thead>
                      <tr class="ie-preview-role-row"><th class="ie-row-role-corner"></th>${colRoleRow}</tr>
                      <tr><th class="ie-row-role-corner ie-row-role-label">행</th>${headerRow}</tr>
                    </thead>
                    <tbody>${bodyRows}</tbody>
                  </table>
                </div>
              </div>
            </div>
            <div class="dm-footer">
              <button class="dm-done">완료</button>
            </div>
          </div>
        `;

        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add('open'));

        // 모달 내 차트 프리뷰 참조 (하이라이트용)
        const dmChartPreview = modal.querySelector('.dm-chart-preview');

        const closeModal = () => { modal.classList.remove('open'); setTimeout(() => modal.remove(), 250); liveUpdate(); };
        modal.querySelector('.dm-backdrop').addEventListener('click', closeModal);
        modal.querySelector('.dm-close').addEventListener('click', closeModal);
        modal.querySelector('.dm-done').addEventListener('click', closeModal);

        // 모달 내 차트 하이라이트 헬퍼
        function highlightInModalChart(ri, ci, sourceEl) {
          dmChartPreview.querySelectorAll('.chart-hl-box').forEach(el => el.remove());
          dmChartPreview.querySelectorAll('.chart-highlight-pulse').forEach(el => el.remove());
          modal.querySelectorAll('.ie-cell-active').forEach(el => el.classList.remove('ie-cell-active'));
          if (sourceEl) sourceEl.classList.add('ie-cell-active');

          const svgEl = dmChartPreview.querySelector('svg');
          if (!svgEl) return;

          const cellValue = fullData[ri] ? String(fullData[ri][ci] || '').trim() : '';
          const rowLabel = fullData[ri] ? String(fullData[ri][0] || '').trim() : '';
          const colRole = slide.colRoles ? slide.colRoles[ci] : 'value';
          if (!cellValue) return;

          const svgRect = svgEl.getBoundingClientRect();
          const parentRect = dmChartPreview.getBoundingClientRect();
          const vb = svgEl.viewBox.baseVal;
          const scaleX = svgRect.width / (vb.width || 1200);
          const scaleY = svgRect.height / (vb.height || 750);
          const offsetX = svgRect.left - parentRect.left;
          const offsetY = svgRect.top - parentRect.top;

          dmChartPreview.style.position = 'relative';
          let found = false;

          // 필터링된 차트 데이터에서의 실제 인덱스 계산
          const filtered = applyVisibleCols(slide);
          const fLabels = filtered.data.map(r => String(r[0] || '').trim());
          const dataRowIdx = fLabels.indexOf(rowLabel);
          const origHeader = allHeaders[ci] || '';
          const fColIdx = filtered.headers.indexOf(origHeader);

          // SVG circle/rect로 직접 위치 찾기
          if (colRole !== 'label' && dataRowIdx >= 0) {
            const kind = slide.chartKind;
            const seriesIdx = fColIdx > 0 ? fColIdx - 1 : -1;
            const numLabels = fLabels.length;

            if (kind === 'horizontalBar') {
              const allRects = Array.from(svgEl.querySelectorAll('rect'));
              const fillRects = allRects.filter(r => {
                const fill = r.getAttribute('fill') || '';
                return fill !== T.track && fill !== T.bg && fill !== '#F8F8F8' && fill !== '#FFFFFF'
                  && !fill.startsWith('url(') && parseFloat(r.getAttribute('height') || 0) > 0
                  && parseFloat(r.getAttribute('width') || 0) > 0
                  && r.getAttribute('rx');
              });
              if (fillRects[dataRowIdx]) {
                try {
                  const bbox = fillRects[dataRowIdx].getBBox();
                  const box = document.createElement('div');
                  box.className = 'chart-hl-box';
                  const pad = 4;
                  box.style.left = (offsetX + (bbox.x - pad) * scaleX) + 'px';
                  box.style.top = (offsetY + (bbox.y - pad) * scaleY) + 'px';
                  box.style.width = ((bbox.width + pad*2) * scaleX) + 'px';
                  box.style.height = ((bbox.height + pad*2) * scaleY) + 'px';
                  box.style.borderColor = roleColors[colRole] || '#00B894';
                  dmChartPreview.appendChild(box);
                  found = true;
                } catch(e) {}
              }
            } else if (kind === 'splitBar') {
              const segRects = Array.from(svgEl.querySelectorAll('rect[clip-path]'));
              const fHeaders = filtered.headers;
              const fData = filtered.data;
              const chartLabels = fHeaders.slice(1);
              const chartSeriesCount = fData.length;
              const barIdx = chartLabels.indexOf(origHeader);
              const segIdx = dataRowIdx;

              if (barIdx >= 0 && segIdx >= 0 && chartSeriesCount > 0) {
                const targetIdx = barIdx * chartSeriesCount + segIdx;
                if (segRects[targetIdx]) {
                  try {
                    const bbox = segRects[targetIdx].getBBox();
                    const box = document.createElement('div');
                    box.className = 'chart-hl-box';
                    const pad = 4;
                    box.style.left = (offsetX + (bbox.x - pad) * scaleX) + 'px';
                    box.style.top = (offsetY + (bbox.y - pad) * scaleY) + 'px';
                    box.style.width = ((bbox.width + pad*2) * scaleX) + 'px';
                    box.style.height = ((bbox.height + pad*2) * scaleY) + 'px';
                    box.style.borderColor = roleColors[colRole] || '#00B894';
                    dmChartPreview.appendChild(box);
                    found = true;
                  } catch(e) {}
                }
              }
            } else {
              const circles = Array.from(svgEl.querySelectorAll('circle:not([r="0"])'));
              if (seriesIdx >= 0 && numLabels > 0) {
                const targetCircleIdx = seriesIdx * numLabels + dataRowIdx;
                const dataCircles = circles.filter(c => c.getAttribute('stroke') && c.getAttribute('stroke-width'));
                if (dataCircles[targetCircleIdx]) {
                  try {
                    const bbox = dataCircles[targetCircleIdx].getBBox();
                    const box = document.createElement('div');
                    box.className = 'chart-hl-box';
                    const pad = 8;
                    box.style.left = (offsetX + (bbox.x - pad/2) * scaleX) + 'px';
                    box.style.top = (offsetY + (bbox.y - pad/2) * scaleY) + 'px';
                    box.style.width = ((bbox.width + pad) * scaleX) + 'px';
                    box.style.height = ((bbox.height + pad) * scaleY) + 'px';
                    box.style.borderColor = roleColors[colRole] || '#00B894';
                    box.style.borderRadius = '50%';
                    dmChartPreview.appendChild(box);
                    found = true;
                  } catch(e) {}
                }
              }

              if (!found) {
                const rects = Array.from(svgEl.querySelectorAll('rect')).filter(r => {
                  const fill = r.getAttribute('fill') || '';
                  return fill !== T.bg && fill !== T.track && fill !== '#F8F8F8' && fill !== '#FFFFFF'
                    && !fill.startsWith('url(') && r.getAttribute('height') !== String(vb.height || 750)
                    && parseFloat(r.getAttribute('height') || 0) > 0;
                });
                const numSeries = filtered.headers.length - 1;
                if (seriesIdx >= 0 && numLabels > 0 && rects.length >= numLabels) {
                  const targetIdx = dataRowIdx * numSeries + seriesIdx;
                  if (rects[targetIdx]) {
                    try {
                      const bbox = rects[targetIdx].getBBox();
                      const box = document.createElement('div');
                      box.className = 'chart-hl-box';
                      const pad = 4;
                      box.style.left = (offsetX + (bbox.x - pad) * scaleX) + 'px';
                      box.style.top = (offsetY + (bbox.y - pad) * scaleY) + 'px';
                      box.style.width = ((bbox.width + pad*2) * scaleX) + 'px';
                      box.style.height = ((bbox.height + pad*2) * scaleY) + 'px';
                      box.style.borderColor = roleColors[colRole] || '#00B894';
                      dmChartPreview.appendChild(box);
                      found = true;
                    } catch(e) {}
                  }
                }
              }
            }
          }

          // 텍스트 매칭 폴백
          if (!found) {
            const numVal = Number(cellValue);
            const matchTexts = [cellValue];
            if (!isNaN(numVal)) {
              matchTexts.push(T.fmt(numVal), T.fmtTick(numVal), numVal.toLocaleString(),
                numVal.toFixed(1), String(Math.round(numVal)),
                numVal.toFixed(1)+'%', Math.round(numVal)+'%', numVal.toFixed(2));
            }

            const textEls = Array.from(svgEl.querySelectorAll('text'));
            let labelBBox = null;
            if (rowLabel) {
              for (const txt of textEls) {
                if (txt.textContent.trim() === rowLabel) {
                  try { labelBBox = txt.getBBox(); } catch(e) {}
                  break;
                }
              }
            }

            if (colRole === 'label') {
              if (labelBBox) {
                const box = document.createElement('div');
                box.className = 'chart-hl-box';
                const pad = 4;
                box.style.left = (offsetX + labelBBox.x * scaleX - pad) + 'px';
                box.style.top = (offsetY + labelBBox.y * scaleY - pad) + 'px';
                box.style.width = (labelBBox.width * scaleX + pad * 2) + 'px';
                box.style.height = (labelBBox.height * scaleY + pad * 2) + 'px';
                box.style.borderColor = roleColors[colRole] || '#6C5CE7';
                dmChartPreview.appendChild(box);
                found = true;
              }
            } else {
              const candidates = [];
              textEls.forEach(txt => {
                const content = txt.textContent.trim();
                const isMatch = matchTexts.some(m => m && content === m);
                if (!isMatch) return;
                try {
                  const bbox = txt.getBBox();
                  let dist = 0;
                  if (labelBBox) {
                    const dx = (bbox.x + bbox.width/2) - (labelBBox.x + labelBBox.width/2);
                    const dy = (bbox.y + bbox.height/2) - (labelBBox.y + labelBBox.height/2);
                    dist = Math.sqrt(dx*dx + dy*dy);
                  }
                  candidates.push({ bbox, dist });
                } catch(e) {}
              });

              if (candidates.length > 0) {
                candidates.sort((a, b) => a.dist - b.dist);
                const best = candidates[0];
                const box = document.createElement('div');
                box.className = 'chart-hl-box';
                const pad = 4;
                box.style.left = (offsetX + best.bbox.x * scaleX - pad) + 'px';
                box.style.top = (offsetY + best.bbox.y * scaleY - pad) + 'px';
                box.style.width = (best.bbox.width * scaleX + pad * 2) + 'px';
                box.style.height = (best.bbox.height * scaleY + pad * 2) + 'px';
                box.style.borderColor = roleColors[colRole] || '#6C5CE7';
                dmChartPreview.appendChild(box);
                found = true;
              }

              if (!found && labelBBox) {
                const box = document.createElement('div');
                box.className = 'chart-hl-box';
                const pad = 4;
                box.style.left = (offsetX + labelBBox.x * scaleX - pad) + 'px';
                box.style.top = (offsetY + labelBBox.y * scaleY - pad) + 'px';
                box.style.width = (labelBBox.width * scaleX + pad * 2) + 'px';
                box.style.height = (labelBBox.height * scaleY + pad * 2) + 'px';
                box.style.borderColor = '#6C5CE7';
                dmChartPreview.appendChild(box);
                found = true;
              }
            }
          }

          const roleName = colRole === 'label' ? '라벨' : colRole === 'value' ? '값' : colRole === 'series' ? '시리즈' : '무시';
          const tooltip = document.createElement('div');
          tooltip.className = 'chart-highlight-pulse';
          tooltip.innerHTML = `<span class="hl-dot" style="background:${roleColors[colRole]}"></span>
            <span class="hl-text">"${_h(cellValue)}" → ${roleName} · ${_h(rowLabel || '행 '+(ri+1))}</span>`;
          dmChartPreview.appendChild(tooltip);

          setTimeout(() => {
            dmChartPreview.querySelectorAll('.chart-hl-box').forEach(el => el.remove());
            tooltip.remove();
            if (sourceEl) sourceEl.classList.remove('ie-cell-active');
          }, 4000);
        }

        // 모달 내 열 역할 변경
        modal.querySelectorAll('.dm-col-role').forEach(sel => {
          sel.addEventListener('change', () => {
            const ci = Number(sel.dataset.col);
            const role = sel.value;
            slide.colRoles[ci] = role;
            sel.style.borderColor = roleColors[role];
            sel.style.color = roleColors[role];
            const th = modal.querySelector(`.ie-preview-th[data-ci="${ci}"]`);
            if (th) th.dataset.role = role;
            modal.querySelectorAll(`tbody tr`).forEach(tr => {
              const tds = tr.querySelectorAll('.ie-preview-td');
              if (tds[ci]) tds[ci].dataset.role = role;
            });
            const inlineSel = panel.querySelector(`.ie-col-role[data-col="${ci}"]`);
            if (inlineSel) { inlineSel.value = role; inlineSel.style.borderColor = roleColors[role]; inlineSel.style.color = roleColors[role]; }
            const inlineTh = panel.querySelector(`.ie-preview-th[data-ci="${ci}"]`);
            if (inlineTh) inlineTh.dataset.role = role;
          });
        });

        // 모달 내 행 역할 토글
        modal.querySelectorAll('.dm-row-tag').forEach(btn => {
          btn.addEventListener('click', () => {
            const ri = Number(btn.dataset.row);
            const next = slide.rowRoles[ri] === 'data' ? 'ignore' : 'data';
            slide.rowRoles[ri] = next;
            btn.dataset.role = next;
            btn.textContent = next === 'data' ? '✓' : '✕';
            btn.style.background = next === 'data' ? roleColors.data : roleColors.ignore;
            const tr = modal.querySelector(`tr[data-row="${ri}"]`);
            if (tr) { tr.dataset.rowrole = next; tr.querySelectorAll('.ie-preview-td').forEach(td => td.dataset.rowrole = next); }
            // 인라인 에디터 동기화
            const inlineBtn = panel.querySelector(`.ie-row-tag[data-row="${ri}"]`);
            if (inlineBtn) { inlineBtn.dataset.role = next; inlineBtn.textContent = next==='data'?'✓':'✕'; inlineBtn.style.background = next==='data'?roleColors.data:roleColors.ignore; }
            const inlineTr = panel.querySelector(`tr[data-row="${ri}"]`);
            if (inlineTr) { inlineTr.dataset.rowrole = next; inlineTr.querySelectorAll('.ie-preview-td').forEach(td => td.dataset.rowrole = next); }
          });
        });

        // 모달 내 셀 클릭 → 모달 차트 프리뷰에 하이라이트
        modal.querySelectorAll('.dm-cell').forEach(td => {
          td.addEventListener('click', () => {
            const ri = Number(td.dataset.ri);
            const ci = Number(td.dataset.ci);
            highlightInModalChart(ri, ci, td);
          });
        });
      });
    }
  }

  // ── 차트 빌드 (타입별 분기) ──
  function buildChart(slide) {
    const { chartKind, title, subtitle, source, colors, filterInfo } = slide;
    const parsed = applyVisibleCols(slide);
    const { type, headers, data, meta } = parsed;

    // 데이터 부족 체크 (table은 텍스트만 있어도 OK)
    const numCols = headers.filter((_,i) => i > 0 && data.some(r => !isNaN(Number(r[i])))).length;
    if (!data || data.length === 0 || (numCols === 0 && chartKind !== 'table')) {
      return _buildEmptyCard(slide, '표시할 데이터가 없어요', data.length === 0
        ? '데이터 행이 비어있어요. 시리즈를 다시 선택하거나 데이터를 확인해주세요.'
        : '숫자 열을 찾을 수 없어요. 행/열을 바꿔보거나 데이터를 다시 선택해보세요.');
    }

    // 전역 설정 (SVG 차트에서 참조)
    SvgCharts._filterInfo = filterInfo || '';
    SvgCharts._hideValueLabels = slide.hideValueLabels || false;
    SvgCharts._decimalPlaces = slide.decimalPlaces != null ? slide.decimalPlaces : null;
    SvgCharts._showAppIcons = slide.showAppIcons !== false;
    SvgCharts._iconShape = slide.iconShape || 'circle';
    SvgCharts._iconSize = slide.iconSize || 'medium';
    SvgCharts._lineIconMode = slide.lineIconMode || 'legend';

    // 범례/출처 유무 (chartBottom 동적 계산용)
    const seriesCount = headers.filter((_, i) => i > 0 && data.some(r => !isNaN(Number(r[i])))).length;
    SvgCharts._hasLegend = (seriesCount > 1 || (chartKind === 'donut')) && slide.showLegend !== false;
    SvgCharts._hasSource = !!source;
    SvgCharts._legendNames = slide.legendNames || {};

    try {
      switch (chartKind) {
        case 'line': return buildLine(slide, parsed);
        case 'verticalBar': return buildVerticalBar(slide, parsed);
        case 'horizontalBar': return buildHorizontalBar(slide, parsed);
        case 'donut': return buildDonut(slide, parsed);
        case 'combo': return buildCombo(slide, parsed);
        case 'scatter': return buildScatter(slide, parsed);
        case 'bubble': return buildBubble(slide, parsed);
        case 'stackedBar': return buildStackedBar(slide, parsed);
        case 'splitBar': return buildSplitBar(slide, parsed);
        case 'heatmap': return SvgCharts.heatmap(title, subtitle, source, headers, data);
        case 'venn': return buildVenn(slide, parsed);
        case 'flowCard': return buildFlowCard(slide, parsed);
        case 'table':
        default: return SvgCharts.table(title, subtitle, source, headers, data);
      }
    } catch(err) {
      console.warn('차트 렌더링 실패:', err);
      return _buildEmptyCard(slide, '차트를 그릴 수 없어요', '이 데이터에 맞지 않는 차트 유형일 수 있어요. 다른 유형을 선택하거나 행/열을 바꿔보세요.');
    }
  }

  // 빈 차트 도움말 카드
  function _buildEmptyCard(slide, heading, desc) {
    const div = document.createElement('div');
    div.className = 'chart-slide';
    div.innerHTML = `
      <div class="empty-chart-card">
        <div class="ecc-icon">📊</div>
        <div class="ecc-heading">${_h(heading)}</div>
        <div class="ecc-desc">${_h(desc)}</div>
        <div class="ecc-actions">
          <button class="ecc-btn ecc-transpose-btn">🔄 행/열 바꿔보기</button>
          <button class="ecc-btn ecc-reselect-btn">📂 데이터 다시 선택</button>
        </div>
      </div>
    `;
    // 행/열 바꾸기
    div.querySelector('.ecc-transpose-btn').addEventListener('click', () => {
      slide.transposed = !slide.transposed;
      const wrapper = div.closest('.slide-wrapper');
      if (wrapper) { rerenderChart(slide, wrapper); saveProject(); }
    });
    // 데이터 다시 선택 — 파일 입력 트리거
    div.querySelector('.ecc-reselect-btn').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv,.xlsx,.xls';
      input.multiple = true;
      input.addEventListener('change', () => { if (input.files.length) handleFiles(input.files); });
      input.click();
    });
    return div;
  }

  function applyVisibleCols(slide) {
    let p = slide.parsed;

    // 행/열 전치
    if (slide.transposed && p.headers.length >= 2 && p.data.length >= 1) {
      const origHeaders = p.headers;
      const origData = p.data;
      const newHeaders = [origHeaders[0], ...origData.map(r => r[0])];
      const newData = origHeaders.slice(1).map((h, ci) => {
        return [h, ...origData.map(r => r[ci + 1])];
      });
      p = { ...p, headers: newHeaders, data: newData };
    }

    // 행 역할 기반 필터링 (무시된 행 제거)
    if (slide.rowRoles && slide.rowRoles.length > 0) {
      const rangeStart = slide.rangeStart || 0;
      const filteredData = p.data.filter((_, di) => {
        const origIdx = rangeStart + di;
        return slide.rowRoles[origIdx] !== 'ignore';
      });
      if (filteredData.length < p.data.length) {
        p = { ...p, data: filteredData };
      }
    }

    // 열 역할 기반 필터링 (colRoles가 있으면 우선)
    if (slide.colRoles && slide.colRoles.length > 0) {
      const labelIdx = slide.colRoles.indexOf('label');
      const keepCols = [labelIdx >= 0 ? labelIdx : 0];
      slide.colRoles.forEach((role, i) => {
        if ((role === 'value' || role === 'series') && !keepCols.includes(i)) keepCols.push(i);
      });
      if (keepCols.length > 1 && keepCols.length < p.headers.length) {
        return {
          ...p,
          headers: keepCols.map(i => p.headers[i]).filter(Boolean),
          data: p.data.map(r => keepCols.map(i => r[i])),
        };
      }
      return p;
    }

    if (!slide.visibleCols || slide.visibleCols.length === 0) return p;
    if (slide.chartKind === 'scatter') return p;
    const keep = [0, ...slide.visibleCols.filter(c => c > 0)];
    return {
      ...p,
      headers: keep.map(i => p.headers[i]).filter(Boolean),
      data: p.data.map(r => keep.map(i => r[i])),
    };
  }

  function buildLine(slide, parsed) {
    const { headers, data } = parsed || slide.parsed;
    const labels = data.map(r => r[0]);
    // 시계열: 첫 열이 라벨, 나머지가 시리즈
    const numCols = [];
    for (let i=1;i<headers.length;i++) {
      if (data.some(r => !isNaN(Number(r[i])))) numCols.push(i);
    }
    const series = numCols.map(ci => ({
      label: headers[ci],
      data: data.map(r => Number(r[ci])||0)
    }));
    return SvgCharts.line(slide.title, slide.subtitle, slide.source, labels, series, slide.colors, slide.showValueLabels);
  }

  function buildVerticalBar(slide, parsed) {
    const { headers, data } = parsed || slide.parsed;
    const labels = data.map(r => r[0]);
    const numCols = [];
    for (let i=1;i<headers.length;i++) {
      if (data.some(r => !isNaN(Number(r[i])))) numCols.push(i);
    }
    const series = numCols.map(ci => ({
      label: headers[ci],
      data: data.map(r => Number(r[ci])||0)
    }));
    return SvgCharts.verticalBar(slide.title, slide.subtitle, slide.source, labels, series, slide.colors, slide.showValueLabels);
  }

  function buildHorizontalBar(slide, parsed) {
    const { headers, data, type } = parsed || slide.parsed;

    // 랭킹 타입: 순위, 앱명, 패키지명, 퍼블리셔명, 값, 점유율...
    if (type.startsWith('ranking_')) {
      const nameIdx = headers.findIndex(h => h.includes('앱명'));
      const ni = nameIdx >= 0 ? nameIdx : 1;
      // 숫자 값 열 찾기 (점유율 제외)
      const valIdx = headers.findIndex(h =>
        (h.includes('사용자 수') || h.includes('사용시간') || h.includes('활성 기기') || h.includes('설치 건'))
        && !h.includes('점유율')
      );
      const vi = valIdx >= 0 ? valIdx : 4;
      const top = data.slice(0, 10);
      const rows = top.map(r => ({ label: r[ni] || r[1] || r[0], value: Number(r[vi]) || 0 }));
      return SvgCharts.horizontalBar(slide.title, slide.subtitle, slide.source, rows, slide.colors);
    }

    // 데모그래픽 비교: 성별/연령별 비율 → 수평 바
    if (type.startsWith('demo_') || type.startsWith('industry_demo_')) {
      const apps = headers.slice(3);
      const genderRows = data.filter(r => r[2]==='남성' || r[2]==='여성');
      const ageRows = data.filter(r => r[2]!=='남성' && r[2]!=='여성');
      // 첫 번째 앱의 연령별 데이터를 수평 바로
      const rows = ageRows.map(r => ({ label: r[2] || r[0], value: Number(r[3]) || 0 }));
      return SvgCharts.horizontalBar(slide.title, slide.subtitle, slide.source, rows, slide.colors);
    }

    // 범용
    const nameIdx = headers.findIndex(h => h.includes('앱') || h.includes('이름') || h.includes('분류'));
    const ni = nameIdx >= 0 ? nameIdx : 0;
    const numCols = headers.map((_,i)=>i).filter(i => i!==ni && data.some(r => !isNaN(Number(r[i]))));
    const vi = numCols[0] || 1;
    const top = data.slice(0, 15);
    const rows = top.map(r => ({ label: r[ni] || r[0], value: Number(r[vi]) || 0 }));
    return SvgCharts.horizontalBar(slide.title, slide.subtitle, slide.source, rows, slide.colors);
  }

  function buildDonut(slide, parsed) {
    const { headers, data } = parsed || slide.parsed;
    let segments;

    // 데이터가 1~2행 × 여러 숫자열이면 → 열을 세그먼트로 (자동 전치)
    const numCols = headers.filter((_, i) => i > 0 && data.some(r => !isNaN(Number(r[i])))).length;
    if (data.length <= 2 && numCols >= 2) {
      // 첫 번째 데이터 행의 각 열을 세그먼트로
      const row = data[0];
      segments = [];
      for (let i = 1; i < headers.length; i++) {
        const v = Number(row[i]) || 0;
        if (v > 0) segments.push({ label: headers[i], value: v });
      }
    } else {
      // 기본: 행이 세그먼트 (첫 열=라벨, 둘째 열=값)
      segments = data.map(r => ({
        label: r[0],
        value: Number(r[1]) || 0
      }));
    }
    return SvgCharts.donut(slide.title, slide.subtitle, slide.source, segments);
  }

  function buildCombo(slide, parsed) {
    const { headers, data } = parsed || slide.parsed;
    const labels = data.map(r => r[0]);
    const barData = data.map(r => Number(r[1])||0);
    const lineData = data.map(r => Number(r[2])||Number(r[1])||0);
    return SvgCharts.combo(slide.title, slide.subtitle, slide.source, labels, barData, headers[1]||'', lineData, headers[2]||headers[1]||'');
  }

  function buildScatter(slide, parsed) {
    const { headers, data } = parsed || slide.parsed;
    const nameIdx = headers.findIndex(h => h.includes('앱') || h.includes('이름'));
    const ni = nameIdx >= 0 ? nameIdx : 0;
    const pkgIdx = headers.findIndex(h => h.includes('패키지') || h.includes('package'));
    const timeIdx = headers.findIndex(h => h.includes('사용시간'));
    const dayIdx = headers.findIndex(h => h.includes('사용일'));
    const xi = timeIdx >= 0 ? timeIdx : headers.length - 1;
    const yi = dayIdx >= 0 ? dayIdx : Math.max(0, headers.length - 2);
    const xLabel = headers[xi] || 'X';
    const yLabel = headers[yi] || 'Y';
    const points = data.filter(r => r && r.length > Math.max(xi, yi)).map(r => ({
      label: r[ni] || r[0] || '',
      x: Number(r[xi]) || 0,
      y: Number(r[yi]) || 0,
      pkg: pkgIdx >= 0 ? (r[pkgIdx] || '') : '',
      iconUrl: _safeUrl(slide.iconUrls[(r[ni] || r[0] || '')] || ''),
    }));
    if (points.length === 0) return SvgCharts.table(slide.title, slide.subtitle, slide.source, headers, data);
    return SvgCharts.scatter(slide.title, slide.subtitle, slide.source, points, xLabel, yLabel, slide.colors);
  }

  function buildFlowCard(slide, parsed) {
    const { headers, data, meta } = parsed || slide.parsed;
    // 이 CSV는 두 블록: 요약(총 유입자, 경쟁앱에서 유입) + 상세(순위별)
    // 요약 블록: "총 유입자" 행 찾기
    const summaryRow = data.find(r => r[0] && r[0].includes('총'));
    const totalValue = summaryRow ? Number(summaryRow[1]) || 0 : 0;
    const totalLabel = summaryRow ? summaryRow[0] : '총 유입자';

    // 상세 블록: 순위가 있는 행들
    const rankRows = data.filter(r => !isNaN(Number(r[0])) && Number(r[0]) > 0);
    const items = rankRows.map(r => ({
      rank: r[0],
      name: r[1] || '',
      value: Number(r[2]) || 0,
      pct: r[3] || '',
    }));

    // 내 앱 이름 (meta에서 추출)
    const appName = meta.appName ? meta.appName.replace('내 앱:', '').trim() : meta.reportType.split('>')[0].trim();

    // 내 앱 패키지명 찾기 (아이콘용) — 앱명으로 매핑
    const appPkgMap = {
      'Netflix(넷플릭스)': 'com.netflix.mediaclient',
      'TVING': 'net.cj.cjhv.gs.tving',
      'Wavve (웨이브)': 'kr.co.captv.pooqV2',
      '쿠팡플레이': 'com.coupang.mobile.play',
      'Disney+': 'com.disney.disneyplus',
      '왓챠': 'com.frograms.wplay',
    };
    const appPkg = appPkgMap[appName] || '';

    // 유입이면 왼쪽 랭킹→오른쪽 KPI, 이탈이면 왼쪽 KPI→오른쪽 랭킹
    const direction = parsed.type === 'flow_out' ? 'out' : 'in';
    const headerLabel = direction === 'out' ? '경쟁앱으로 이탈' : '경쟁앱에서 유입';
    const noteText = direction === 'out' ? 'ⓘ 참고 : 경쟁앱 간 중복 이탈자가 발생할 수 있습니다.' : 'ⓘ 참고 : 경쟁앱 간 중복 유입자가 발생할 수 있습니다.';

    const el = SvgCharts.flowCard(slide.title, slide.subtitle, slide.source, appName, totalValue, totalLabel, items, slide.colors, appPkg, direction, headerLabel, noteText);
    return el;
  }


  function buildVenn(slide, parsed) {
    const { headers, data } = parsed || slide.parsed;
    if (!data || data.length < 2) return SvgCharts.table(slide.title, slide.subtitle, slide.source, headers, data);
    // 제목에서 "(단위: ...)" 부분 제거
    slide.title = slide.title.replace(/\s*\(단위[^)]*\)/, '').trim();

    // CSV 컬럼 인덱스
    // [기준앱/대상앱, 패키지명, 전체 사용자 수, 중복 사용자 제외한 사용자 수,
    //  1인당 평균 사용일 수, 1인당 평균 사용 시간, 교차 사용자 1인당 평균 사용일 수, 교차 사용자 1인당 평균 사용 시간]
    const r0 = data[0], r1 = data[1];
    const app1Total  = Number(r0[2]) || 0;
    const app1Only   = Number(r0[3]) || 0;
    const crossCount = app1Total - app1Only;

    const app1 = {
      name:      r0[0],
      pkg:       r0[1],
      onlyUsers: app1Only,
      crossDays: Number(r0[6]) || 0,
      crossTime: Number(r0[7]) || 0,
    };
    const app2 = {
      name:      r1[0],
      pkg:       r1[1],
      onlyUsers: Number(r1[3]) || 0,
      crossDays: Number(r1[6]) || 0,
      crossTime: Number(r1[7]) || 0,
    };

    return SvgCharts.venn(slide.title, slide.subtitle, slide.source, app1, app2, crossCount);
  }

  function buildStackedBar(slide, parsed) {
    const { headers, data } = parsed || slide.parsed;
    const labels = data.map(r => r[0]);
    const numCols = [];
    for (let i = 1; i < headers.length; i++) {
      if (data.some(r => !isNaN(Number(r[i])))) numCols.push(i);
    }
    const series = numCols.map(ci => ({
      label: headers[ci],
      data: data.map(r => Number(r[ci]) || 0)
    }));
    return SvgCharts.stackedBar(slide.title, slide.subtitle, slide.source, labels, series, slide.colors);
  }

  function buildSplitBar(slide, parsed) {
    const { headers, data, type } = parsed || slide.parsed;

    // 데모그래픽 데이터: "분류" 열이 있으면 특수 처리
    const classIdx = headers.findIndex(h => h === '분류' || h === '구분');

    if (classIdx >= 0) {
      // 분류 열에서 연령대만 필터 (남성/여성 제외)
      const ageRows = data.filter(r => r[classIdx] && !/남성|여성/.test(r[classIdx]));
      const numCols = headers.map((_, i) => i).filter(i => i !== classIdx && !['시작','종료'].includes(headers[i]) && ageRows.some(r => !isNaN(Number(r[i]))));

      // labels = 앱/업종 (열 헤더)
      const labels = numCols.map(ci => headers[ci]);
      // series = 연령대 (행)
      const series = ageRows.map(r => ({
        label: r[classIdx],
        data: numCols.map(ci => Number(r[ci]) || 0)
      }));
      return SvgCharts.splitBar(slide.title, slide.subtitle, slide.source, labels, series, slide.colors);
    }

    // 일반: 행=라벨, 열=시리즈 → 전치해서 열이 바, 행이 세그먼트
    const rowLabels = data.map(r => r[0]);
    const numCols = [];
    for (let i = 1; i < headers.length; i++) {
      if (data.some(r => !isNaN(Number(r[i])))) numCols.push(i);
    }
    const labels = numCols.map(ci => headers[ci]);
    const series = rowLabels.map((rl, ri) => ({
      label: rl,
      data: numCols.map(ci => Number(data[ri][ci]) || 0)
    }));
    return SvgCharts.splitBar(slide.title, slide.subtitle, slide.source, labels, series, slide.colors);
  }

  function buildBubble(slide, parsed) {
    const { headers, data } = parsed || slide.parsed;
    const nameIdx = headers.findIndex(h => h.includes('앱') || h.includes('이름') || h.includes('분류'));
    const ni = nameIdx >= 0 ? nameIdx : 0;
    const numCols = headers.map((_, i) => i).filter(i => i !== ni && data.some(r => !isNaN(Number(r[i]))));

    if (numCols.length < 2) {
      // 열 1개 → 행 기준 단일 그룹
      const vi = numCols[0] || 1;
      const items = data.map(r => ({ label: r[ni]||r[0]||'', value: Number(r[vi])||0, subLabel: T.fmt(Number(r[vi])||0) }));
      return SvgCharts.bubble(slide.title, slide.subtitle, slide.source, [{ title: '', items }], slide.colors);
    }

    // 열 기준 + bubbleGroups로 멀티 기간 지원
    const groups = [];
    const bg = slide.bubbleGroups;

    if (bg && bg.length > 0) {
      // 에디터에서 선택한 기간들
      bg.forEach(g => {
        const row = data[g.rowIdx];
        if (!row) return;
        const items = numCols.map(ci => ({
          label: headers[ci],
          value: Number(row[ci]) || 0,
          subLabel: T.fmt(Number(row[ci]) || 0),
        }));
        groups.push({ title: g.label || row[0] || '', items });
      });
    } else {
      // 기본: 마지막 행 하나
      const lastRow = data[data.length - 1] || data[0];
      const items = numCols.map(ci => ({
        label: headers[ci],
        value: Number(lastRow[ci]) || 0,
        subLabel: T.fmt(Number(lastRow[ci]) || 0),
      }));
      groups.push({ title: lastRow[0] || '', items });
    }

    return SvgCharts.bubble(slide.title, slide.subtitle, slide.source, groups, slide.colors);
  }

  // ── 에디터 모달 ──
  function openEditor(slide) {
    const old = document.getElementById('editorModal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'editorModal';
    modal.className = 'editor-modal';

    const dataType = slide.parsed?.type || slide.fullParsed?.type || '';
    const recommended = Parser.getRecommendedKinds(dataType, slide.parsed?.headers || [], slide.parsed?.data || []);
    const kindOptions = buildKindOptionsHTML(slide.chartKind, recommended);

    // 전체 열 목록 (열 선택용)
    const allHeaders = slide.parsed.headers;
    const fullData = slide.fullParsed ? slide.fullParsed.data : slide.parsed.data;
    const colCheckboxes = allHeaders.length > 2 ? allHeaders.map((h, i) => {
      if (i === 0) return '';
      const checked = !slide.visibleCols || slide.visibleCols.includes(i);
      return `<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:4px 0;${!checked?'opacity:0.4':''}">
        <input type="checkbox" class="col-check" data-col="${i}" ${checked ? 'checked' : ''} style="accent-color:var(--accent);width:16px;height:16px">
        <span>${h}</span>
        <span style="font-size:11px;color:var(--text-muted)">${checked ? '표시 중' : '숨김'}</span>
      </label>`;
    }).join('') : '';

    // 지표 라벨 자동 파악
    const metricNames = allHeaders.slice(1).filter(h => fullData.some(r => !isNaN(Number(r[allHeaders.indexOf(h)]))));
    let metricType = '지표';
    if (metricNames.some(n => /사용자|유저|user/i.test(n))) metricType = '앱/서비스';
    else if (metricNames.some(n => /사용시간|사용일/i.test(n))) metricType = '사용 지표';
    else if (metricNames.some(n => /대분류|소분류/i.test(n))) metricType = '업종';
    else if (metricNames.length > 0) metricType = '지표';

    // 시리즈 이름 추출 (데이터 타입에 따라)
    const seriesNames = [];
    if (slide.chartKind === 'scatter' || slide.parsed.type === 'loyalty_compare') {
      // 스캐터: 각 행이 시리즈 (앱 이름)
      const ni = slide.parsed.headers.findIndex(h => h.includes('앱') || h.includes('이름'));
      fullData.forEach(r => seriesNames.push(r[ni >= 0 ? ni : 0] || ''));
    } else {
      // 일반: 헤더가 시리즈
      const { headers } = slide.parsed;
      for (let i = 1; i < headers.length; i++) {
        if (fullData.some(r => !isNaN(Number(r[i])))) seriesNames.push(headers[i]);
      }
    }

    const colorPickers = slide.colors.slice(0, Math.max(8, seriesNames.length)).map((c, i) => {
      const name = seriesNames[i];
      if (!name) return ''; // 시리즈 이름 없으면 숨김
      return `<div class="color-pick">
        <input type="color" value="${c}" data-idx="${i}" class="color-input">
        <span class="color-label">${name}</span>
      </div>`;
    }).join('');

    // 데이터 범위 (원본 데이터 기준 — fullData 위에서 이미 선언)
    const hasRange = fullData.length > 1;
    const rangeOptions = fullData.map((r, i) =>
      `<option value="${i}">${_h(r[0] || '행 ' + (i+1))}</option>`
    ).join('');
    const curStart = slide.rangeStart || 0;
    const curEnd = slide.rangeEnd != null ? slide.rangeEnd : fullData.length - 1;

    // 항목/지표 이름 자동 파악
    const firstColName = allHeaders[0] || '항목';
    // 첫 열 값으로 항목 유형 추측
    const sampleVals = fullData.slice(0, 3).map(r => r[0] || '');
    let itemType = '항목';
    if (sampleVals.some(v => /\d{4}[-\/\.]/.test(v))) itemType = '기간';
    else if (sampleVals.some(v => /앱|App/i.test(firstColName))) itemType = '앱';
    else if (firstColName.includes('순위')) itemType = '순위';
    else if (firstColName.includes('분류') || firstColName.includes('구분')) itemType = '분류';
    else if (firstColName.includes('연령') || firstColName.includes('나이')) itemType = '연령';
    else itemType = firstColName || '항목';

    modal.innerHTML = `
      <div class="editor-backdrop"></div>
      <div class="editor-panel">
        <div class="editor-header">
          <span class="editor-title-label">장표 설정</span>
          <button class="editor-close">✕</button>
        </div>
        <div class="editor-body">
          <div class="editor-field">
            <label>차트 유형</label>
            <div class="kind-grid">${kindOptions}</div>
          </div>
          <div class="editor-field">
            <label>타이틀</label>
            <input type="text" id="edTitle" value="${_h(slide.title)}">
          </div>
          <div class="editor-field">
            <label>부제목</label>
            <input type="text" id="edSubtitle" value="${_h(slide.subtitle)}">
          </div>
          <div class="editor-field">
            <label>출처</label>
            <input type="text" id="edSource" value="${_h(slide.source||'')}" placeholder="선택">
          </div>
          <div class="editor-field">
            <label>필터 정보 (하단 표시)</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input type="text" id="edFilterInfo" value="${_h(slide.filterInfo||'')}" placeholder="OS: Android+iOS / 기간: 2024.03 / 성별: 전체 / 연령: 전체" style="flex:1">
              <button type="button" class="btn-filter-example" title="예시 채우기" style="white-space:nowrap;padding:4px 10px;border:1px solid #ccc;border-radius:6px;background:#f5f5ff;cursor:pointer;font-size:12px;">예시</button>
            </div>
          </div>
          ${(() => {
            const vlKind = slide.chartKind;
            const vlTypes = ['line','combo'];
            if (!vlTypes.includes(vlKind)) return '';
            const vlNames = [];
            if (vlKind === 'line') {
              for (let i = 1; i < allHeaders.length; i++) {
                if (fullData.some(r => !isNaN(Number(r[i])))) vlNames.push({ idx: i - 1, name: allHeaders[i] });
              }
            } else if (vlKind === 'combo') {
              vlNames.push({ idx: 0, name: allHeaders[1] || '막대' });
              vlNames.push({ idx: 1, name: allHeaders[2] || '꺾은선' });
            }
            if (vlNames.length === 0) return '';
            if (!slide.showValueLabels) slide.showValueLabels = vlNames.map(() => true);
            while (slide.showValueLabels.length < vlNames.length) slide.showValueLabels.push(true);
            const items = vlNames.map(v => {
              const on = slide.showValueLabels[v.idx] !== false;
              return `<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:3px 0">
                <input type="checkbox" class="ed-vl-check" data-si="${v.idx}" ${on ? 'checked' : ''} style="accent-color:var(--accent);width:16px;height:16px">
                <span style="${on ? '' : 'opacity:0.4'}">${v.name}</span>
              </label>`;
            }).join('');
            return `<div class="editor-field">
              <label>값 라벨 표시</label>
              <div style="display:flex;flex-direction:column;gap:2px">${items}</div>
            </div>`;
          })()}
          <div class="editor-field">
            <button id="edTranspose" style="width:100%;padding:10px 0;border:1.5px solid var(--divider);border-radius:10px;background:${slide.transposed?'var(--accent)':'#FFF'};color:${slide.transposed?'#FFF':'var(--text-dark)'};font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s">🔄 행/열 바꾸기 ${slide.transposed?'(전환됨)':''}</button>
          </div>
          ${hasRange ? `
          <div class="editor-field">
            <label>표시할 ${itemType} (전체 ${fullData.length}개)</label>
            <div style="display:flex;gap:8px;align-items:center">
              <select id="edRangeStart" style="flex:1;padding:8px 10px;border:1px solid var(--divider);border-radius:8px;font-size:13px;font-family:inherit">${rangeOptions}</select>
              <span style="color:var(--text-muted)">~</span>
              <select id="edRangeEnd" style="flex:1;padding:8px 10px;border:1px solid var(--divider);border-radius:8px;font-size:13px;font-family:inherit">${rangeOptions}</select>
            </div>
            <div id="edRangeCount" style="font-size:12px;color:var(--text-muted);margin-top:4px"></div>
          </div>` : ''}
          ${slide.chartKind === 'scatter' || slide.parsed.type === 'loyalty_compare' ? `
          <div class="editor-field">
            <label>앱 아이콘 URL</label>
            <div style="display:flex;flex-direction:column;gap:6px" id="iconUrlList">
              ${seriesNames.map((name, i) => `
                <div style="display:flex;align-items:center;gap:6px">
                  ${slide.iconUrls[name] ? `<img src="${_safeUrl(slide.iconUrls[name])}" width="20" height="20" style="border-radius:4px">` : `<div style="width:20;height:20;border-radius:4px;background:#EEE;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">${_h(name.charAt(0))}</div>`}
                  <input type="text" class="icon-url-input" data-name="${_h(name)}" value="${_h(slide.iconUrls[name]||'')}" placeholder="${_h(name)} 아이콘 URL" style="flex:1;padding:6px 8px;border:1px solid var(--divider);border-radius:6px;font-size:11px;font-family:inherit;outline:none">
                </div>
              `).join('')}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">이미지 URL을 붙여넣으세요 (비워두면 자동 감지)</div>
          </div>` : ''}
          ${slide.chartKind === 'bubble' && fullData.length > 1 ? `
          <div class="editor-field">
            <label>버블 기간 그룹</label>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">기간을 선택하면 해당 시점의 앱별 버블이 나와요</div>
            <div id="bubbleGroupList" style="display:flex;flex-direction:column;gap:8px"></div>
            <button id="addBubbleGroup" style="margin-top:8px;padding:8px 14px;border:1.5px dashed var(--divider);border-radius:10px;background:none;cursor:pointer;font-size:13px;color:var(--accent);font-weight:600;font-family:inherit;width:100%">+ 기간 추가</button>
          </div>` : ''}
          ${colCheckboxes ? `
          <div class="editor-field">
            <label>비교할 ${metricType}</label>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">차트에 보여줄 항목을 선택하세요</div>
            <div style="display:flex;flex-direction:column;gap:2px">${colCheckboxes}</div>
          </div>` : ''}
          <div class="editor-field">
            <label>색상</label>
            <div class="color-grid">${colorPickers}</div>
          </div>
        </div>
        <div class="editor-footer">
          <button class="editor-apply">적용</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('open'));

    // 행/열 바꾸기 토글
    const transposeBtn = modal.querySelector('#edTranspose');
    if (transposeBtn) {
      transposeBtn.addEventListener('click', () => {
        slide.transposed = !slide.transposed;
        // 버튼 스타일 업데이트
        transposeBtn.style.background = slide.transposed ? 'var(--accent)' : '#FFF';
        transposeBtn.style.color = slide.transposed ? '#FFF' : 'var(--text-dark)';
        transposeBtn.textContent = '🔄 행/열 바꾸기 ' + (slide.transposed ? '(전환됨)' : '');
      });
    }

    // 범위 초기값 + 카운트 업데이트
    if (hasRange) {
      const startSel = document.getElementById('edRangeStart');
      const endSel = document.getElementById('edRangeEnd');
      const countEl = document.getElementById('edRangeCount');
      startSel.value = curStart;
      endSel.value = curEnd;
      const updateCount = () => {
        const s = Number(startSel.value), e = Number(endSel.value);
        const cnt = Math.abs(e - s) + 1;
        const warn = cnt > MAX_ROWS ? ' ⚠️ 폰트가 작아질 수 있어요' : ' ✅';
        countEl.innerHTML = `${cnt}개 선택${warn}`;
      };
      updateCount();
      startSel.addEventListener('change', updateCount);
      endSel.addEventListener('change', updateCount);
    }

    // 버블 그룹 관리
    const bgList = modal.querySelector('#bubbleGroupList');
    const bgAddBtn = modal.querySelector('#addBubbleGroup');
    if (bgList && bgAddBtn) {
      const rowOptions = fullData.map((r, i) => `<option value="${i}">${r[0] || '행 '+(i+1)}</option>`).join('');
      const currentGroups = slide.bubbleGroups || [{ rowIdx: fullData.length - 1, label: fullData[fullData.length-1][0] || '' }];

      function renderBgList() {
        bgList.innerHTML = currentGroups.map((g, gi) => `
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;font-weight:600;color:var(--text-dark);min-width:20px">${gi+1}</span>
            <select class="bg-select" data-gi="${gi}" style="flex:1;padding:6px 8px;border:1px solid var(--divider);border-radius:8px;font-size:13px;font-family:inherit">${rowOptions}</select>
            ${currentGroups.length > 1 ? `<button class="bg-remove" data-gi="${gi}" style="width:24px;height:24px;border-radius:50%;border:none;background:#F3F3F3;cursor:pointer;font-size:12px;color:#999">✕</button>` : ''}
          </div>
        `).join('');
        bgList.querySelectorAll('.bg-select').forEach(sel => {
          sel.value = currentGroups[Number(sel.dataset.gi)].rowIdx;
          sel.addEventListener('change', () => {
            const gi = Number(sel.dataset.gi);
            currentGroups[gi].rowIdx = Number(sel.value);
            currentGroups[gi].label = fullData[Number(sel.value)][0] || '';
          });
        });
        bgList.querySelectorAll('.bg-remove').forEach(btn => {
          btn.addEventListener('click', () => {
            currentGroups.splice(Number(btn.dataset.gi), 1);
            renderBgList();
          });
        });
      }
      renderBgList();
      bgAddBtn.addEventListener('click', () => {
        currentGroups.push({ rowIdx: 0, label: fullData[0][0] || '' });
        renderBgList();
      });
      // 적용 시 저장할 수 있도록 modal에 참조 저장
      modal._bubbleGroups = currentGroups;
    }

    // 차트 유형 선택
    modal.querySelectorAll('.kind-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.kind-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // 닫기
    const close = () => { modal.classList.remove('open'); setTimeout(()=>modal.remove(), 300); };
    modal.querySelector('.editor-backdrop').addEventListener('click', close);
    modal.querySelector('.editor-close').addEventListener('click', close);

    // 예시 버튼 (에디터 모달)
    modal.querySelector('.btn-filter-example')?.addEventListener('click', () => {
      const inp = document.getElementById('edFilterInfo');
      if (inp) inp.value = 'OS: Android+iOS / 기간: 2024.03 / 성별: 전체 / 연령: 전체';
    });

    // 적용
    modal.querySelector('.editor-apply').addEventListener('click', () => {
      slide.title = document.getElementById('edTitle').value;
      slide.subtitle = document.getElementById('edSubtitle').value;
      slide.source = document.getElementById('edSource').value;
      slide.filterInfo = document.getElementById('edFilterInfo').value;
      const activeKind = modal.querySelector('.kind-btn.active');
      if (activeKind) slide.chartKind = activeKind.dataset.kind;
      modal.querySelectorAll('.color-input').forEach(inp => {
        slide.colors[Number(inp.dataset.idx)] = inp.value;
      });

      // 아이콘 URL 업데이트
      modal.querySelectorAll('.icon-url-input').forEach(inp => {
        const name = inp.dataset.name;
        const url = _safeUrl(inp.value);
        if (url) slide.iconUrls[name] = url;
        else delete slide.iconUrls[name];
      });

      // 값 라벨 표시 업데이트
      const vlChecks = modal.querySelectorAll('.ed-vl-check');
      if (vlChecks.length > 0) {
        if (!slide.showValueLabels) slide.showValueLabels = [];
        vlChecks.forEach(cb => {
          slide.showValueLabels[Number(cb.dataset.si)] = cb.checked;
        });
      }

      // 버블 그룹 업데이트
      if (modal._bubbleGroups) {
        slide.bubbleGroups = modal._bubbleGroups.length > 0 ? [...modal._bubbleGroups] : null;
      }

      // 열 선택 업데이트
      const colChecks = modal.querySelectorAll('.col-check');
      if (colChecks.length > 0) {
        const selected = [];
        colChecks.forEach(cb => { if (cb.checked) selected.push(Number(cb.dataset.col)); });
        slide.visibleCols = selected.length === colChecks.length ? null : selected;
      }

      // 범위 업데이트
      if (hasRange) {
        const s = Number(document.getElementById('edRangeStart').value);
        const e = Number(document.getElementById('edRangeEnd').value);
        const newStart = Math.min(s, e), newEnd = Math.max(s, e);
        slide.rangeStart = newStart;
        slide.rangeEnd = newEnd;
        const baseParsed = slide.fullParsed || slide.parsed;
        slide.parsed = { ...baseParsed, data: baseParsed.data.slice(newStart, newEnd + 1) };
      }

      // 리렌더
      const oldEl = container.querySelector(`[data-slide-id="${slide.id}"]`);
      if (oldEl) oldEl.remove();
      renderSlide(slide);
      close();
    });
  }
  // ── 가이드 팝업 ──
  function openGuideModal() {
    const old = document.querySelector('.guide-modal');
    if (old) { old.remove(); return; }
    const modal = document.createElement('div');
    modal.className = 'guide-modal';
    modal.innerHTML = `
      <div class="guide-modal-panel">
        <div class="guide-modal-header">
          <span class="guide-modal-title">📖 이렇게 사용하세요</span>
          <button class="guide-modal-close">✕</button>
        </div>
        <div class="guide-modal-steps">
          <div class="guide-modal-step">
            <div class="guide-modal-num">1</div>
            <div>
              <div class="guide-modal-heading">데이터 불러오기</div>
              <div class="guide-modal-desc">두 가지 방법으로 데이터를 불러올 수 있어요.<br>
                <b>📁 파일 업로드</b> — CSV 또는 엑셀(.xlsx) 파일을 드래그하거나 클릭해서 올려주세요. 여러 파일을 한번에 올릴 수 있어요.<br>
                <b>🔍 API 조회</b> — MI-INSIGHT API를 통해 실시간 데이터를 직접 조회할 수 있어요. 카테고리, 기간, 앱을 선택하면 바로 차트가 생성됩니다.<br>
                <span style="color:#E55;font-weight:600">⚠️ 주의: 한 파일에 여러 가지 데이터가 섞여있으면 인식하기 어려워요.</span></div>
            </div>
          </div>
          <div class="guide-modal-step">
            <div class="guide-modal-num">2</div>
            <div>
              <div class="guide-modal-heading">엑셀 데이터 범위 선택</div>
              <div class="guide-modal-desc">엑셀 파일을 올리면 스프레드시트 뷰어가 열려요. 원하는 영역을 드래그해서 선택하면 해당 범위만 차트로 만들어줍니다. 헤더 행을 포함해서 선택해주세요.<br>
                <span style="color:var(--accent);font-weight:600">💡 엑셀 날짜가 숫자(45658 등)로 보여도 자동으로 날짜(2025.01)로 변환돼요.</span></div>
            </div>
          </div>
          <div class="guide-modal-step">
            <div class="guide-modal-num">3</div>
            <div>
              <div class="guide-modal-heading">자동 차트 생성</div>
              <div class="guide-modal-desc">데이터 유형을 자동으로 감지해서 가장 적합한 차트를 추천해드려요. 라인, 바, 도넛, 히트맵 등 13가지 차트를 지원합니다. 앱 아이콘도 자동으로 불러와요.</div>
            </div>
          </div>
          <div class="guide-modal-step">
            <div class="guide-modal-num">4</div>
            <div>
              <div class="guide-modal-heading">장표 설정 & 편집</div>
              <div class="guide-modal-desc">장표에 마우스를 올리면 ⚙️ 설정 버튼이 나타나요. 차트 유형 변경, 타이틀 수정, 데이터 범위 조절, 색상 변경, 아이콘 ON/OFF가 가능합니다.<br>
                <b>📊 데이터 다시 선택</b> — 이미 만든 장표의 데이터 범위를 다시 선택할 수 있어요.<br>
                <b>Aa 텍스트 편집</b> — 차트 안의 글자를 직접 클릭해서 수정할 수 있어요.</div>
            </div>
          </div>
          <div class="guide-modal-step">
            <div class="guide-modal-num">5</div>
            <div>
              <div class="guide-modal-heading">다운로드 & 저장</div>
              <div class="guide-modal-desc">개별 PNG/SVG 다운로드, 일괄 다운로드, 프로젝트 저장/불러오기를 지원합니다. 앱 아이콘도 포함돼요.<br><span style="color:var(--accent);font-weight:600">💡 SVG로 다운받으면 Figma에서 바로 편집할 수 있어요.</span></div>
            </div>
          </div>
        </div>
        <div class="guide-modal-tip">
          💡 차트 유형 선택 시 <span class="guide-modal-rec">추천</span> 뱃지가 붙은 차트가 해당 데이터에 가장 잘 어울리는 유형이에요.
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.guide-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  // 온보딩 콜아웃
  document.getElementById('guideCallout').addEventListener('click', openGuideModal);
  // 결과 화면 헤더 버튼
  document.getElementById('guideBtn').addEventListener('click', openGuideModal);

  // ── 일괄 다운로드 (모달) ──
  const batchDlBtn = document.getElementById('batchDlBtn');

  batchDlBtn.addEventListener('click', () => {
    if (slides.length === 0) { alert('다운로드할 장표가 없어요.'); return; }

    const old = document.getElementById('batchModal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'batchModal';
    modal.className = 'batch-modal';

    const listHTML = slides.map((s, i) => `
      <label class="bm-item" data-idx="${i}">
        <input type="checkbox" class="bm-check" data-idx="${i}" checked>
        <span class="bm-check-custom"></span>
        <span class="bm-num">${i + 1}</span>
        <span class="bm-title">${_h(s.title || '장표 ' + (i+1))}</span>
      </label>
    `).join('');

    modal.innerHTML = `
      <div class="bm-backdrop"></div>
      <div class="bm-panel">
        <div class="bm-header">
          <span>📥 일괄 다운로드</span>
          <button class="bm-close">✕</button>
        </div>
        <div class="bm-body">
          <div class="bm-select-bar">
            <button class="bm-select-all">전체 선택</button>
            <button class="bm-select-none">전체 해제</button>
            <span class="bm-count-label"><span class="bm-count">${slides.length}</span>개 선택</span>
          </div>
          <div class="bm-list">${listHTML}</div>
          <div class="bm-format">
            <label>포맷</label>
            <div class="bm-format-btns">
              <button class="bm-fmt-btn active" data-fmt="png">PNG</button>
              <button class="bm-fmt-btn" data-fmt="svg">SVG</button>
            </div>
          </div>
        </div>
        <div class="bm-footer">
          <button class="bm-cancel">취소</button>
          <button class="bm-download">📥 다운로드</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('open'));

    let selectedFormat = 'png';

    const closeModal = () => { modal.classList.remove('open'); setTimeout(() => modal.remove(), 250); };
    modal.querySelector('.bm-backdrop').addEventListener('click', closeModal);
    modal.querySelector('.bm-close').addEventListener('click', closeModal);
    modal.querySelector('.bm-cancel').addEventListener('click', closeModal);

    // 카운트 업데이트
    const updateCount = () => {
      const cnt = modal.querySelectorAll('.bm-check:checked').length;
      modal.querySelector('.bm-count').textContent = cnt;
    };
    modal.querySelectorAll('.bm-check').forEach(cb => cb.addEventListener('change', updateCount));

    // 전체 선택/해제
    modal.querySelector('.bm-select-all').addEventListener('click', () => {
      modal.querySelectorAll('.bm-check').forEach(cb => { cb.checked = true; });
      updateCount();
    });
    modal.querySelector('.bm-select-none').addEventListener('click', () => {
      modal.querySelectorAll('.bm-check').forEach(cb => { cb.checked = false; });
      updateCount();
    });

    // 포맷 선택
    modal.querySelectorAll('.bm-fmt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.bm-fmt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedFormat = btn.dataset.fmt;
      });
    });

    // 다운로드 실행
    modal.querySelector('.bm-download').addEventListener('click', async () => {
      const dlBtn = modal.querySelector('.bm-download');
      dlBtn.textContent = '⏳ 다운로드 중…';
      dlBtn.disabled = true;

      const wrappers = container.querySelectorAll('.slide-wrapper');
      const checked = Array.from(modal.querySelectorAll('.bm-check:checked')).map(cb => Number(cb.dataset.idx));

      for (const idx of checked) {
        const slide = slides[idx];
        if (!slide) continue;
        const w = wrappers[idx];
        if (!w) continue;
        const chartEl = w.querySelector('.chart-slide');
        if (!chartEl) continue;

        try {
          if (selectedFormat === 'svg') {
            const svgEl = chartEl.querySelector('svg');
            if (!svgEl) continue;
            const str = new XMLSerializer().serializeToString(svgEl);
            const blob = new Blob([str], { type: 'image/svg+xml' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${slide.title || '장표' + (idx+1)}.svg`;
            a.click();
          } else {
            const svgInChart = chartEl.querySelector('svg');
            if (svgInChart && typeof inlineSvgImages === 'function') await inlineSvgImages(svgInChart);
            const canvas = await html2canvas(chartEl, { scale: 3, backgroundColor: '#F8F8F8', useCORS: true });
            const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
            if (blob) {
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `${slide.title || '장표' + (idx+1)}.png`;
              a.click();
            }
          }
        } catch(e) { console.warn('다운로드 실패:', e); }
        await new Promise(r => setTimeout(r, 300));
      }

      closeModal();
    });
  });

  // ── 프로젝트 저장 (사이트 내 localStorage) ──
  document.getElementById('saveBtn').addEventListener('click', () => {
    saveProject();
    const isFirst = !localStorage.getItem('cs-save-noticed');
    const toast = document.createElement('div');
    toast.className = 'save-toast';
    toast.innerHTML = isFirst
      ? '✅ 저장 완료!<br><span style="font-size:12px;opacity:0.8">이 브라우저에 저장돼요. 캐시 삭제 시 사라질 수 있어요.</span>'
      : '✅ 프로젝트가 저장되었어요!';
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, isFirst ? 4000 : 2000);
    if (isFirst) localStorage.setItem('cs-save-noticed', '1');
  });

  // ── 프로젝트 불러오기 (사이트 내 localStorage 모달) ──
  document.getElementById('loadBtn').addEventListener('click', () => {
    const projects = JSON.parse(localStorage.getItem('cs-projects') || '{}');
    const entries = Object.entries(projects).sort((a,b) => (b[1].updatedAt||'').localeCompare(a[1].updatedAt||''));

    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:480px">
        <h3 style="margin:0 0 16px">📂 저장된 프로젝트</h3>
        ${entries.length === 0
          ? '<p style="color:#888;text-align:center;padding:24px 0">저장된 프로젝트가 없어요.</p>'
          : `<div class="load-project-list">${entries.map(([id, p]) => {
              const date = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('ko') : '';
              return `<div class="load-project-item" data-id="${_h(id)}">
                <div class="lp-info">
                  <div class="lp-name">${_h(p.name || '이름 없음')}</div>
                  <div class="lp-meta">${_h(p.slideCount || 0)}개 장표 · ${_h(date)}</div>
                </div>
                <button class="lp-delete" data-id="${_h(id)}" title="삭제">🗑</button>
              </div>`;
            }).join('')}</div>`
        }
        <div style="text-align:right;margin-top:16px">
          <p class="lp-notice">💡 이 브라우저에 저장된 데이터예요. 다른 기기나 브라우저에서는 보이지 않아요.</p>
          <button class="lp-close" style="padding:8px 20px;border-radius:8px;border:1px solid #ddd;background:#fff;cursor:pointer">닫기</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector('.lp-close').addEventListener('click', () => {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 250);
    });
    modal.addEventListener('click', e => {
      if (e.target === modal) { modal.classList.remove('open'); setTimeout(() => modal.remove(), 250); }
    });

    modal.querySelectorAll('.load-project-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('.lp-delete')) return;
        loadProject(item.dataset.id);
        modal.classList.remove('open');
        setTimeout(() => modal.remove(), 250);
      });
    });
    modal.querySelectorAll('.lp-delete').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm('이 프로젝트를 삭제하시겠어요?')) return;
        const pjs = JSON.parse(localStorage.getItem('cs-projects') || '{}');
        delete pjs[btn.dataset.id];
        localStorage.setItem('cs-projects', JSON.stringify(pjs));
        btn.closest('.load-project-item').remove();
        if (!modal.querySelector('.load-project-item')) {
          modal.querySelector('.load-project-list').innerHTML = '<p style="color:#888;text-align:center;padding:24px 0">저장된 프로젝트가 없어요.</p>';
        }
        showSavedProjects();
      });
    });
  });

  // 프로젝트 이름 변경
  document.getElementById('projectName').addEventListener('blur', e => {
    projectName = e.target.textContent.trim() || '새 프로젝트';
    saveProject();
  });
  document.getElementById('projectName').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  });

  // ── 온보딩 탭 전환 ──
  (function initOnboardingTabs() {
    const tabsContainer = document.getElementById('onboardingTabs');
    const panelUpload = document.getElementById('panelUpload');
    const panelApi = document.getElementById('panelApi');
    if (!tabsContainer || !panelUpload || !panelApi) return;

    let industriesLoaded = false;

    // 카테고리별 UI 표시 제어
    const SINGLE_APP_CATEGORIES = [
      'usage/overlap-rank',
      'usage/app/concurrent', 'usage/app/involvement', 'usage/app/break',
      'usage/app/interest', 'usage/app/persona', 'usage/app/persona-relative', 'usage/app/region',
      'apps/summary', 'apps/info', 'apps/ranking-history', 'apps/market-info',
      'apps/timeline', 'apps/rate-total', 'apps/rate'
    ];
    const MULTI_APP_CATEGORIES = [
      'usage/competitor/install-delete', 'usage/competitor/loyalty',
      'usage/retention',
      'apps/usage', 'apps/demographic', 'apps/ranking', 'apps/biz-rate'
    ];
    const MARKET_CATEGORIES = [
      'chart/market/rank', 'chart/market/global-rank', 'chart/market/realtime-rank',
      'apps/ranking-history', 'apps/market-info'
    ];

    tabsContainer.addEventListener('click', function(e) {
      const tab = e.target.closest('.onboarding-tab');
      if (!tab) return;
      const target = tab.dataset.tab;

      tabsContainer.querySelectorAll('.onboarding-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');

      if (target === 'upload') {
        panelUpload.style.display = '';
        panelApi.style.display = 'none';
      } else if (target === 'api') {
        panelUpload.style.display = 'none';
        panelApi.style.display = '';
        // 업종 목록 최초 1회 로드
        if (!industriesLoaded) {
          industriesLoaded = true;
          ApiClient.getIndustries().then(function(list) {
            const sel = document.getElementById('apiIndustry');
            if (!sel || !list.length) return;
            list.forEach(function(item) {
              var opt = document.createElement('option');
              opt.value = item.cate_cd || item.code || item.name || '';
              opt.textContent = item.cate_nm || item.name || item.code || '';
              sel.appendChild(opt);
            });
          });
        }
      }
    });

    // 카테고리 변경 시 동적 필드 표시/숨김
    var categoryInput = document.getElementById('apiCategory');
    var pkgNameSection = document.getElementById('apiPkgNameSection');
    var appIdsSection = document.getElementById('apiAppIdsSection');
    var marketRow = document.getElementById('apiMarketRow');
    var apiForm = document.getElementById('apiForm');
    var apiMainTitle = document.getElementById('apiMainTitle');

    // 사이드바 아코디언 토글
    var sidebar = document.getElementById('apiSidebar');
    if (sidebar) {
      sidebar.addEventListener('click', function(e) {
        // 그룹 헤더 클릭 → 아코디언 토글
        var header = e.target.closest('.api-sidebar-header');
        if (header) {
          var group = header.closest('.api-sidebar-group');
          var items = group.querySelector('.api-sidebar-items');
          var isOpen = group.classList.contains('open');
          group.classList.toggle('open');
          items.style.display = isOpen ? 'none' : '';
          return;
        }
        // 아이템 클릭 → 카테고리 선택
        var item = e.target.closest('.api-sidebar-item');
        if (item) {
          var cat = item.dataset.cat;
          // active 표시
          sidebar.querySelectorAll('.api-sidebar-item').forEach(function(el) { el.classList.remove('active'); });
          item.classList.add('active');
          // hidden input 업데이트
          if (categoryInput) categoryInput.value = cat;
          // 타이틀 업데이트
          if (apiMainTitle) apiMainTitle.textContent = item.textContent;
          // 폼 표시
          if (apiForm) apiForm.style.display = '';
          // 동적 필드
          if (pkgNameSection) pkgNameSection.style.display = SINGLE_APP_CATEGORIES.includes(cat) ? '' : 'none';
          if (appIdsSection) appIdsSection.style.display = MULTI_APP_CATEGORIES.includes(cat) ? '' : 'none';
          if (marketRow) marketRow.style.display = MARKET_CATEGORIES.includes(cat) ? '' : 'none';
          // 업종 선택: 사용량 순위/업종 트렌드만 필요
          var industryBar = document.getElementById('apiIndustryBar');
          if (industryBar) {
            var needsIndustry = cat.startsWith('usage/usage-rank') || cat.startsWith('usage/demographic') || cat.startsWith('usage/trend/') || cat.startsWith('usage/rise-rank');
            industryBar.style.display = needsIndustry ? '' : 'none';
          }
        }
      });
    }

    // OS 탭 클릭
    var osTabs = document.getElementById('apiOsTabs');
    var osInput = document.getElementById('apiOs');
    if (osTabs) {
      osTabs.addEventListener('click', function(e) {
        var tab = e.target.closest('.api-os-tab');
        if (!tab) return;
        osTabs.querySelectorAll('.api-os-tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        if (osInput) osInput.value = tab.dataset.os;
      });
    }

    // 빠른 기간 선택 버튼
    function setDateRange(months) {
      var now = new Date();
      var endYear = now.getFullYear();
      var endMonth = now.getMonth(); // 이번 달 (0-indexed), 전월 데이터까지 가능하므로
      if (endMonth === 0) { endYear--; endMonth = 12; }
      var startMonth = endMonth - months + 1;
      var startYear = endYear;
      while (startMonth <= 0) { startMonth += 12; startYear--; }
      var startEl = document.getElementById('apiStartDate');
      var endEl = document.getElementById('apiEndDate');
      if (startEl) startEl.value = startYear + '-' + String(startMonth).padStart(2, '0');
      if (endEl) endEl.value = endYear + '-' + String(endMonth).padStart(2, '0');
    }

    // 기본값: 최근 3개월
    setDateRange(3);

    var quickDates = document.querySelectorAll('.api-quick-btn');
    quickDates.forEach(function(btn) {
      btn.addEventListener('click', function() {
        quickDates.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        setDateRange(Number(btn.dataset.months));
      });
    });

    // 업종 대분류 변경 시 소분류 로드
    var industrySelect = document.getElementById('apiIndustry');
    var subIndustryGroup = document.getElementById('apiSubIndustryGroup');
    var subIndustrySelect = document.getElementById('apiSubIndustry');
    if (industrySelect && subIndustryGroup && subIndustrySelect) {
      industrySelect.addEventListener('change', function() {
        var mainCd = this.value;
        if (!mainCd) {
          subIndustryGroup.style.display = 'none';
          subIndustrySelect.innerHTML = '<option value="">전체 (선택 안 함)</option>';
          return;
        }
        subIndustryGroup.style.display = '';
        subIndustrySelect.innerHTML = '<option value="">로딩 중...</option>';
        ApiClient.getSubCategories(mainCd).then(function(list) {
          subIndustrySelect.innerHTML = '<option value="">전체 (선택 안 함)</option>';
          if (list && list.length) {
            list.forEach(function(item) {
              var opt = document.createElement('option');
              opt.value = item.sub_cate_cd || item.code || item.name || '';
              opt.textContent = item.sub_cate_nm || item.name || item.code || '';
              subIndustrySelect.appendChild(opt);
            });
          }
        });
      });
    }

    // ── 앱 검색 공통 함수 ──
    function createAppSearchHandler(searchInput, resultsEl, onSelect) {
      var searchTimeout = null;
      searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        var kw = this.value.trim();
        if (kw.length < 2) { resultsEl.style.display = 'none'; return; }
        searchTimeout = setTimeout(function() {
          ApiClient.searchApps(kw).then(function(list) {
            if (!list || !list.length) {
              resultsEl.innerHTML = '<div class="api-search-empty">검색 결과 없음</div>';
              resultsEl.style.display = '';
              return;
            }
            resultsEl.innerHTML = list.slice(0, 8).map(function(app) {
              var name = _h(app.appName || app.app_name || app.name || '');
              var pkg = _h(app.pkgName || app.pkg_name || '');
              var icon = app.iconUrl || app.icon_url || '';
              var iconHtml = icon ? '<img class="api-search-icon" src="' + _h(icon) + '" onerror="this.style.display=\'none\'">' : '<div class="api-search-icon-placeholder">📱</div>';
              return '<div class="api-search-item" data-pkg="' + pkg + '" data-name="' + name + '" data-icon="' + _h(icon) + '">' +
                iconHtml +
                '<div class="api-search-item-info"><div class="api-search-item-name">' + name + '</div>' +
                '<div class="api-search-item-pkg">' + pkg + '</div></div></div>';
            }).join('');
            resultsEl.style.display = '';
            resultsEl.querySelectorAll('.api-search-item').forEach(function(item) {
              item.addEventListener('click', function() {
                onSelect({ pkg: this.dataset.pkg, name: this.dataset.name, icon: this.dataset.icon });
                resultsEl.style.display = 'none';
                searchInput.value = '';
              });
            });
          });
        }, 300);
      });
    }

    // 외부 클릭 시 모든 검색 결과 닫기
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.api-app-search')) {
        document.querySelectorAll('.api-search-results').forEach(function(el) { el.style.display = 'none'; });
      }
    });

    // ── 단일 앱 검색 ──
    var singleSearchInput = document.getElementById('apiAppSearch');
    var singleSearchResults = document.getElementById('apiSearchResults');
    var singleSelectedEl = document.getElementById('apiSelectedApp');
    var singlePkgInput = document.getElementById('apiPkgName');

    if (singleSearchInput && singleSearchResults) {
      createAppSearchHandler(singleSearchInput, singleSearchResults, function(app) {
        if (singlePkgInput) singlePkgInput.value = app.pkg;
        if (singleSelectedEl) {
          var iconHtml = app.icon ? '<img class="api-chip-icon" src="' + _h(app.icon) + '" onerror="this.style.display=\'none\'">' : '';
          singleSelectedEl.innerHTML = '<div class="api-app-chip">' + iconHtml +
            '<span class="api-chip-name">' + _h(app.name) + '</span>' +
            '<button type="button" class="api-chip-remove" title="제거">✕</button></div>';
          singleSelectedEl.style.display = '';
          singleSelectedEl.querySelector('.api-chip-remove').addEventListener('click', function() {
            singlePkgInput.value = '';
            singleSelectedEl.innerHTML = '';
            singleSelectedEl.style.display = 'none';
          });
        }
      });
    }

    // ── 복수 앱 검색 (경쟁앱 비교) ──
    var multiSearchInput = document.getElementById('apiMultiAppSearch');
    var multiSearchResults = document.getElementById('apiMultiSearchResults');
    var selectedAppsList = document.getElementById('apiSelectedAppsList');
    var _selectedApps = []; // { pkg, name, icon }

    function renderSelectedApps() {
      if (!selectedAppsList) return;
      if (_selectedApps.length === 0) {
        selectedAppsList.innerHTML = '<div class="api-apps-empty">검색해서 비교할 앱을 추가하세요</div>';
        return;
      }
      selectedAppsList.innerHTML = _selectedApps.map(function(app, i) {
        var iconHtml = app.icon ? '<img class="api-chip-icon" src="' + _h(app.icon) + '" onerror="this.style.display=\'none\'">' : '';
        return '<div class="api-app-chip" data-idx="' + i + '">' + iconHtml +
          '<span class="api-chip-name">' + _h(app.name) + '</span>' +
          '<button type="button" class="api-chip-remove" data-idx="' + i + '" title="제거">✕</button></div>';
      }).join('');
      selectedAppsList.querySelectorAll('.api-chip-remove').forEach(function(btn) {
        btn.addEventListener('click', function() {
          _selectedApps.splice(Number(this.dataset.idx), 1);
          renderSelectedApps();
        });
      });
    }

    if (multiSearchInput && multiSearchResults) {
      createAppSearchHandler(multiSearchInput, multiSearchResults, function(app) {
        if (_selectedApps.length >= 10) { showToast('⚠️ 최대 10개까지 추가할 수 있어요', true); return; }
        if (_selectedApps.some(function(a) { return a.pkg === app.pkg; })) { showToast('⚠️ 이미 추가된 앱이에요', true); return; }
        _selectedApps.push(app);
        renderSelectedApps();
      });
      renderSelectedApps();
    }

    // 폼 제출
    var apiForm = document.getElementById('apiForm');
    if (apiForm) {
      apiForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        var submitBtn = document.getElementById('apiSubmitBtn');
        var submitText = submitBtn.querySelector('.api-submit-text');
        var loadingEl = document.getElementById('apiLoading');
        var category = document.getElementById('apiCategory').value;
        if (!category) { showToast('⚠️ 카테고리를 선택해주세요', true); return; }

        var startDate = document.getElementById('apiStartDate').value;
        var endDate = document.getElementById('apiEndDate').value;
        if (!startDate || !endDate) { showToast('⚠️ 기간을 선택해주세요', true); return; }

        var periodTypeEl = document.getElementById('apiPeriodType');
        var filters = {
          startDate: startDate,
          endDate: endDate,
          periodType: periodTypeEl ? periodTypeEl.value : 'monthly',
          os: document.getElementById('apiOs').value,
          gender: document.getElementById('apiGender').value,
          ageRange: document.getElementById('apiAge').value,
          appIds: []
        };

        // 마켓
        var marketEl = document.getElementById('apiMarket');
        if (marketEl && MARKET_CATEGORIES.includes(category)) {
          filters.market = marketEl.value;
        }

        // 업종
        var industryVal = document.getElementById('apiIndustry').value;
        if (industryVal) filters.cate_cd = industryVal;
        var subIndustryVal = document.getElementById('apiSubIndustry');
        if (subIndustryVal && subIndustryVal.value) filters.sub_cate_cd = subIndustryVal.value;

        // 단일 앱
        if (SINGLE_APP_CATEGORIES.includes(category)) {
          var pkgName = document.getElementById('apiPkgName');
          if (pkgName && pkgName.value.trim()) {
            filters.pkg_name = pkgName.value.trim();
          } else {
            showToast('⚠️ 앱을 검색해서 선택해주세요', true);
            return;
          }
        }

        // 복수 앱 비교
        if (MULTI_APP_CATEGORIES.includes(category)) {
          var appNameMap = {};
          _selectedApps.forEach(function(app) {
            if (app.pkg) {
              filters.appIds.push(app.pkg);
              appNameMap[app.pkg] = app.name || app.pkg;
            }
          });
          filters.appNameMap = appNameMap;
          if (filters.appIds.length === 0) { showToast('⚠️ 비교할 앱을 최소 1개 검색해서 추가해주세요', true); return; }
        }

        // 로딩 상태
        submitBtn.disabled = true;
        submitText.style.display = 'none';
        loadingEl.style.display = '';

        try {
          var result = await ApiClient.fetchData(category, filters);
          // API 데이터를 스프레드시트 뷰어로 열기 (기존 파일 업로드와 동일한 경험)
          var sheetData = [];
          if (result.headers && result.headers.length) {
            sheetData.push(result.headers);
          }
          if (result.data && result.data.length) {
            result.data.forEach(function(row) { sheetData.push(row); });
          }
          var catLabel = document.getElementById('apiMainTitle');
          var sheetName = (catLabel ? catLabel.textContent : '') || 'API 데이터';
          var fakeWb = { _fakeSheets: [{ name: sheetName, data: sheetData }] };
          if (window.openSpreadsheetViewer) {
            window.openSpreadsheetViewer(fakeWb, sheetName + '.api');
          } else if (window.addSlide) {
            window.addSlide(result);
          }
        } catch (err) {
          if (err.name === 'AbortError') return;
          showToast('⚠️ ' + (err.message || '데이터를 가져올 수 없습니다'), true);
        } finally {
          submitBtn.disabled = false;
          submitText.style.display = '';
          loadingEl.style.display = 'none';
        }
      });
    }
  })();

  // 페이지 로드 시 마지막 프로젝트 자동 복원
  const lastProjectId = localStorage.getItem('cs-last-project');
  if (lastProjectId && loadProject(lastProjectId)) {
    // 마지막 프로젝트 복원 성공
  } else {
    showSavedProjects();
  }

})();
