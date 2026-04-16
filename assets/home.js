const COLORS = [
  { bg: '#0e2e38', text: '#90e0ef' },
  { bg: '#1a3a25', text: '#7ee8a2' },
  { bg: '#3a2e10', text: '#f9c74f' },
  { bg: '#2a1a40', text: '#c77dff' },
  { bg: '#3a1a10', text: '#f4a261' },
  { bg: '#1a2a3a', text: '#74b0ff' },
  { bg: '#2a1a2a', text: '#ff8fab' },
  { bg: '#1a3a38', text: '#52e0c4' },
];

function getSaved(id) {
  try { return JSON.parse(localStorage.getItem('card_' + id)) || {}; } catch { return {}; }
}

function save(id, data) {
  localStorage.setItem('card_' + id, JSON.stringify({ ...getSaved(id), ...data }));
}

function formatId(id) {
  return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

async function generateDesc(id) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `학부 전공 과목 "${formatId(id)}" 의 핵심 주제를 한국어로 한 줄(30자 이내)로 요약해줘. 키워드 나열 형식으로, 예시처럼: "OSI 7계층, TCP/IP, 신호 이론, PCM". 설명 없이 키워드만.`
      }]
    })
  });
  const data = await response.json();
  return data.content[0].text.trim();
}

function buildCard(course, index) {
  const saved = getSaved(course.id);
  const colorIdx = saved.colorIdx !== undefined ? saved.colorIdx : (index % COLORS.length);
  const color = COLORS[colorIdx];
  const title = saved.title || formatId(course.id);
  const desc = saved.desc || course.desc || '-';

  const card = document.createElement('div');
  card.className = 'card';
  card.style.animationDelay = (index * 0.05 + 0.05) + 's';

  card.innerHTML = `
    <span class="card-arrow">↗</span>

    <div style="position:relative;display:inline-block;">
      <span class="card-tag"
            style="background:${color.bg};color:${color.text};"
            data-id="${course.id}">
        ${formatId(course.id)}
      </span>
      <div class="color-palette" id="palette-${course.id}">
        ${COLORS.map((c, i) => `
          <div class="color-dot ${i === colorIdx ? 'active' : ''}"
               style="background:${c.text};"
               data-idx="${i}"></div>
        `).join('')}
      </div>
    </div>

    <div class="card-title-row">
      <div class="card-title" id="title-${course.id}">${title}</div>
      <button class="edit-btn" title="제목 편집">✎</button>
    </div>

    <div class="card-desc-row">
      <div class="card-desc" id="desc-${course.id}">${desc}</div>
      <button class="ai-btn" title="AI 설명 자동 생성">✦</button>
    </div>
  `;

  // 카드 클릭 → 링크 이동
  card.addEventListener('click', (e) => {
    if (
      e.target.closest('.edit-btn') ||
      e.target.closest('.ai-btn') ||
      e.target.closest('.card-tag') ||
      e.target.closest('.color-palette') ||
      e.target.closest('.edit-input') ||
      e.target.closest('.card-desc')
    ) return;
    window.location.href = course.href;
  });

  return card;
}

function attachEvents(course, card) {
  const tag = card.querySelector('.card-tag');
  const palette = card.querySelector('.color-palette');
  const editBtn = card.querySelector('.edit-btn');
  const aiBtn = card.querySelector('.ai-btn');
  const descEl = card.querySelector('.card-desc');

  // 태그 클릭 → 팔레트 토글
  tag.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = palette.classList.contains('open');
    document.querySelectorAll('.color-palette.open').forEach(p => p.classList.remove('open'));
    if (!isOpen) palette.classList.add('open');
  });

  // 색상 선택
  palette.querySelectorAll('.color-dot').forEach((dot, i) => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      const color = COLORS[i];
      tag.style.background = color.bg;
      tag.style.color = color.text;
      palette.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      save(course.id, { colorIdx: i });
      palette.classList.remove('open');
    });
  });

  // 제목 편집
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const titleEl = card.querySelector('.card-title');
    if (!titleEl) return;

    const input = document.createElement('input');
    input.className = 'edit-input';
    input.value = titleEl.textContent;
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    function commit() {
      const val = input.value.trim() || formatId(course.id);
      const newEl = document.createElement('div');
      newEl.className = 'card-title';
      newEl.id = 'title-' + course.id;
      newEl.textContent = val;
      input.replaceWith(newEl);
      save(course.id, { title: val });
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); commit(); }
    });
  });

  // 설명 클릭 → 직접 편집
  descEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (descEl.querySelector('input')) return;

    const input = document.createElement('input');
    input.className = 'edit-input desc';
    input.value = descEl.textContent === '-' ? '' : descEl.textContent;
    input.placeholder = '설명 입력...';
    descEl.textContent = '';
    descEl.appendChild(input);
    input.focus();

    function commit() {
      const val = input.value.trim() || '-';
      descEl.textContent = val;
      save(course.id, { desc: val });
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); commit(); }
    });
  });

  // AI 버튼 → 자동 생성
  aiBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (aiBtn.classList.contains('loading')) return;

    aiBtn.classList.add('loading');
    aiBtn.textContent = '↻';
    descEl.style.color = '#444';
    descEl.textContent = '생성 중...';

    try {
      const result = await generateDesc(course.id);
      descEl.textContent = result;
      descEl.style.color = '';
      save(course.id, { desc: result });
    } catch (err) {
      descEl.textContent = '-';
      descEl.style.color = '';
      console.error(err);
    }

    aiBtn.classList.remove('loading');
    aiBtn.textContent = '✦';
  });
}

// 실시간 검색
document.getElementById('search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  const cards = document.querySelectorAll('#grid .card');
  let visible = 0;
  cards.forEach(card => {
    const title = (card.querySelector('.card-title')?.textContent || '').toLowerCase();
    const desc  = (card.querySelector('.card-desc')?.textContent  || '').toLowerCase();
    const tag   = (card.querySelector('.card-tag')?.textContent   || '').toLowerCase();
    const match = !q || title.includes(q) || desc.includes(q) || tag.includes(q);
    card.style.display = match ? '' : 'none';
    if (match && card.classList.contains('card')) visible++;
  });
  // 결과 없음 메시지
  let noResult = document.getElementById('no-result');
  if (visible === 0 && q) {
    if (!noResult) {
      noResult = document.createElement('div');
      noResult.id = 'no-result';
      noResult.className = 'no-result';
      document.getElementById('grid').after(noResult);
    }
    noResult.textContent = `"${q}" 에 해당하는 과목이 없어요.`;
  } else if (noResult) {
    noResult.remove();
  }
});

// 팔레트 외부 클릭 시 닫기
document.addEventListener('click', () => {
  document.querySelectorAll('.color-palette.open').forEach(p => p.classList.remove('open'));
});

// 메인 실행
fetch('./courses.json')
  .then(r => r.json())
  .then(courses => {
    const grid = document.getElementById('grid');
    courses.forEach((course, i) => {
      const card = buildCard(course, i);
      grid.appendChild(card);
      attachEvents(course, card);
    });

    const coming = document.createElement('div');
    coming.style.cssText = 'background:var(--surface);border:0.5px dashed var(--border);border-radius:10px;padding:20px;display:flex;align-items:center;gap:10px;';
    coming.innerHTML = `
      <div style="width:6px;height:6px;border-radius:50%;background:var(--border);flex-shrink:0;"></div>
      <span style="font-family:var(--mono);font-size:11px;color:var(--muted);">추가 예정</span>
    `;
    grid.appendChild(coming);
  });
