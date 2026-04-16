// ─── 상수 ───────────────────────────────────────────────
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

// ─── 저장/불러오기 ──────────────────────────────────────
function getSaved(id) {
  try { return JSON.parse(localStorage.getItem('card_' + id)) || {}; } catch { return {}; }
}
function save(id, data) {
  localStorage.setItem('card_' + id, JSON.stringify({ ...getSaved(id), ...data }));
}
function getGroups() {
  try { return JSON.parse(localStorage.getItem('groups')) || [{ id: 'default', name: '전공 과목', courseIds: [] }]; }
  catch { return [{ id: 'default', name: '전공 과목', courseIds: [] }]; }
}
function saveGroups(groups) {
  localStorage.setItem('groups', JSON.stringify(groups));
}
function formatId(id) {
  return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ─── 전역 상태 ──────────────────────────────────────────
let ALL_COURSES = [];
let groups = [];
let draggedCourseId = null;
let dragOverGroup = null;

// ─── 카드 빌드 ──────────────────────────────────────────
function buildCard(course, index) {
  const saved = getSaved(course.id);
  const colorIdx = saved.colorIdx !== undefined ? saved.colorIdx : (index % COLORS.length);
  const color = COLORS[colorIdx];
  const title = saved.title || formatId(course.id);
  const desc = saved.desc || course.desc || '-';

  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.courseId = course.id;
  card.draggable = true;
  card.style.animationDelay = (index * 0.05 + 0.05) + 's';

  card.innerHTML = `
    <span class="card-arrow">↗</span>
    <div style="position:relative;display:inline-block;">
      <span class="card-tag" style="background:${color.bg};color:${color.text};" data-id="${course.id}">
        ${formatId(course.id)}
      </span>
      <div class="color-palette" id="palette-${course.id}">
        ${COLORS.map((c, i) => `
          <div class="color-dot ${i === colorIdx ? 'active' : ''}" style="background:${c.text};" data-idx="${i}"></div>
        `).join('')}
      </div>
    </div>
    <div class="card-title-row">
      <div class="card-title" id="title-${course.id}">${title}</div>
      <button class="edit-btn" title="제목 편집">✎</button>
    </div>
    <div class="card-desc-row">
      <div class="card-desc" id="desc-${course.id}">${desc}</div>
    </div>
  `;

  // 카드 클릭 → 링크 이동
  card.addEventListener('click', (e) => {
    if (e.target.closest('.edit-btn') || e.target.closest('.card-tag') ||
        e.target.closest('.color-palette') || e.target.closest('.edit-input') ||
        e.target.closest('.card-desc')) return;
    window.location.href = course.href;
  });

  // 드래그 이벤트
  card.addEventListener('dragstart', (e) => {
    draggedCourseId = course.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    document.querySelectorAll('.group-box.drag-over').forEach(g => g.classList.remove('drag-over'));
  });

  return card;
}

// ─── 카드 이벤트 연결 ────────────────────────────────────
function attachEvents(course, card) {
  const tag = card.querySelector('.card-tag');
  const palette = card.querySelector('.color-palette');
  const editBtn = card.querySelector('.edit-btn');
  const descEl = card.querySelector('.card-desc');

  // 태그 → 팔레트
  tag.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = palette.classList.contains('open');
    document.querySelectorAll('.color-palette.open').forEach(p => p.classList.remove('open'));
    if (!isOpen) palette.classList.add('open');
  });

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
    input.focus(); input.select();
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

  // 설명 클릭 편집
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
}

// ─── 그룹 박스 빌드 ─────────────────────────────────────
function buildGroupBox(group) {
  const box = document.createElement('div');
  box.className = 'group-box';
  box.dataset.groupId = group.id;

  box.innerHTML = `
    <div class="group-header">
      <span class="group-name" data-group-id="${group.id}">${group.name}</span>
      ${group.id !== 'default' ? `<button class="group-delete-btn" data-group-id="${group.id}" title="그룹 삭제">✕</button>` : ''}
    </div>
    <div class="group-grid" data-group-id="${group.id}"></div>
  `;

  // 그룹명 클릭 → 편집
  const nameEl = box.querySelector('.group-name');
  nameEl.addEventListener('click', () => {
    const input = document.createElement('input');
    input.className = 'group-name-input';
    input.value = nameEl.textContent;
    nameEl.replaceWith(input);
    input.focus(); input.select();
    function commit() {
      const val = input.value.trim() || group.name;
      const newEl = document.createElement('span');
      newEl.className = 'group-name';
      newEl.dataset.groupId = group.id;
      newEl.textContent = val;
      input.replaceWith(newEl);
      group.name = val;
      saveGroups(groups);
      // 이벤트 재연결
      newEl.addEventListener('click', arguments.callee);
    }
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); commit(); }
    });
  });

  // 그룹 삭제
  const deleteBtn = box.querySelector('.group-delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // 그룹 안 카드를 default 그룹으로 이동
      const defaultGroup = groups.find(g => g.id === 'default');
      defaultGroup.courseIds.push(...group.courseIds);
      groups = groups.filter(g => g.id !== group.id);
      saveGroups(groups);
      render();
    });
  }

  // 드롭 이벤트
  const grid = box.querySelector('.group-grid');
  box.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    box.classList.add('drag-over');
    dragOverGroup = group.id;
  });
  box.addEventListener('dragleave', (e) => {
    if (!box.contains(e.relatedTarget)) {
      box.classList.remove('drag-over');
      if (dragOverGroup === group.id) dragOverGroup = null;
    }
  });
  box.addEventListener('drop', (e) => {
    e.preventDefault();
    box.classList.remove('drag-over');
    if (!draggedCourseId) return;

    // 기존 그룹에서 제거
    groups.forEach(g => {
      g.courseIds = g.courseIds.filter(id => id !== draggedCourseId);
    });
    // 새 그룹에 추가
    group.courseIds.push(draggedCourseId);
    saveGroups(groups);
    render();
    draggedCourseId = null;
  });

  return box;
}

// ─── 전체 렌더 ──────────────────────────────────────────
function render() {
  const container = document.getElementById('groups-container');
  container.innerHTML = '';

  // 모든 courseId 수집
  const assignedIds = new Set(groups.flatMap(g => g.courseIds));

  // 미배정 카드 → default 그룹에 추가
  const defaultGroup = groups.find(g => g.id === 'default');
  ALL_COURSES.forEach(c => {
    if (!assignedIds.has(c.id)) defaultGroup.courseIds.push(c.id);
  });
  saveGroups(groups);

  // 그룹 박스 렌더
  groups.forEach(group => {
    const box = buildGroupBox(group);
    const grid = box.querySelector('.group-grid');

    group.courseIds.forEach((courseId, i) => {
      const course = ALL_COURSES.find(c => c.id === courseId);
      if (!course) return;
      const card = buildCard(course, i);
      attachEvents(course, card);
      grid.appendChild(card);
    });

    container.appendChild(box);
  });
}

// ─── 검색 ────────────────────────────────────────────────
document.getElementById('search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  document.querySelectorAll('.card').forEach(card => {
    const title = (card.querySelector('.card-title')?.textContent || '').toLowerCase();
    const desc  = (card.querySelector('.card-desc')?.textContent  || '').toLowerCase();
    const tag   = (card.querySelector('.card-tag')?.textContent   || '').toLowerCase();
    card.style.display = (!q || title.includes(q) || desc.includes(q) || tag.includes(q)) ? '' : 'none';
  });
});

// ─── 그룹 추가 버튼 ─────────────────────────────────────
document.getElementById('add-group-btn').addEventListener('click', () => {
  const newGroup = {
    id: 'group_' + Date.now(),
    name: '새 그룹',
    courseIds: []
  };
  groups.push(newGroup);
  saveGroups(groups);
  render();
});

// ─── 팔레트 외부 클릭 닫기 ──────────────────────────────
document.addEventListener('click', () => {
  document.querySelectorAll('.color-palette.open').forEach(p => p.classList.remove('open'));
});

// ─── 메인 실행 ───────────────────────────────────────────
fetch('./courses.json')
  .then(r => r.json())
  .then(courses => {
    ALL_COURSES = courses;
    groups = getGroups();
    render();
  });
