// URL에서 파라미터 읽기
const params = new URLSearchParams(location.search);
const repo = params.get('repo') || inferRepo();
const fileParam = params.get('file');

// 폴더명으로 레포 이름 추론
function inferRepo() {
  const path = location.pathname;
  const parts = path.split('/').filter(Boolean);
  // /Study_note/machine-learning/notes.html → machine-learning
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'notes.html' || parts[i+1] === 'notes.html') {
      const folder = parts[i] === 'notes.html' ? parts[i-1] : parts[i];
      return toRepoName(folder);
    }
  }
  return parts[parts.length - 2] || 'machine-learning';
}

function toRepoName(folder) {
  // machine-learning → Machine-Learning 같은 형식 시도
  // 실제 레포명과 다를 수 있으니 파라미터로도 받을 수 있게
  return folder.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
}

const OWNER = 'dyd8115-max';
const BRANCH = 'main';
const API_BASE = `https://api.github.com/repos/${OWNER}/${repo}/contents`;
const RAW_BASE = `https://raw.githubusercontent.com/${OWNER}/${repo}/${BRANCH}`;

// 레포 이름 표시
document.getElementById('repo-name').textContent = repo;
document.getElementById('list-title').textContent = repo;
document.getElementById('list-subtitle').textContent = `${OWNER}/${repo}`;

if (fileParam) {
  showFile(fileParam);
} else {
  loadFileList();
}

async function loadFileList() {
  try {
    const res = await fetch(API_BASE);
    const files = await res.json();
    const mdFiles = files.filter(f => f.name.endsWith('.md')).sort((a, b) => a.name.localeCompare(b.name));

    const list = document.getElementById('file-list');
    if (mdFiles.length === 0) {
      list.innerHTML = '<div class="loading">마크다운 파일이 없습니다.</div>';
      return;
    }

    list.innerHTML = '';
    mdFiles.forEach((file, i) => {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.style.animationDelay = (i * 0.05) + 's';
      item.innerHTML = `
        <span class="file-icon">MD</span>
        <span class="file-name">${file.name}</span>
        <span class="file-arrow">→</span>
      `;
      item.addEventListener('click', () => {
        history.pushState({}, '', `?repo=${repo}&file=${file.name}`);
        showFile(file.name);
      });
      list.appendChild(item);
    });
  } catch (e) {
    document.getElementById('file-list').innerHTML =
      `<div class="loading">파일 목록을 불러올 수 없습니다.<br><small>${e.message}</small></div>`;
  }
}

async function showFile(filename) {
  document.getElementById('list-view').style.display = 'none';
  document.getElementById('md-view').style.display = 'block';
  document.getElementById('nav-sep2').style.display = '';
  document.getElementById('nav-file').style.display = '';
  document.getElementById('nav-file').textContent = filename;
  document.getElementById('md-content').innerHTML = '<div class="loading">불러오는 중...</div>';

  document.getElementById('back-btn').addEventListener('click', (e) => {
    e.preventDefault();
    history.pushState({}, '', `?repo=${repo}`);
    document.getElementById('list-view').style.display = 'block';
    document.getElementById('md-view').style.display = 'none';
    document.getElementById('nav-sep2').style.display = 'none';
    document.getElementById('nav-file').style.display = 'none';
  });

  try {
    const res = await fetch(`${RAW_BASE}/${filename}`);
    const text = await res.text();

    // 1단계: ```math 블록을 $$ $$ 로 변환
    let processed = text.replace(/```math\n([\s\S]*?)```/g, (_, code) => {
      return `\n$$\n${code.trim()}\n$$\n`;
    });

    // 2단계: 마크다운 파싱 ($ 기호 이스케이프 방지)
    // marked가 _ 를 em으로 바꾸지 않도록 수식 보호
    const mathBlocks = [];
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (m) => {
      mathBlocks.push(m);
      return `MATHBLOCK${mathBlocks.length - 1}END`;
    });
    processed = processed.replace(/\$([^$\n]+?)\$/g, (m) => {
      mathBlocks.push(m);
      return `MATHBLOCK${mathBlocks.length - 1}END`;
    });

    let html = marked.parse(processed);

    // 3단계: 플레이스홀더 복원
    html = html.replace(/MATHBLOCK(\d+)END/g, (_, i) => mathBlocks[i]);

    // 5단계: .md 링크를 GitHub 파일 URL로 변환
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    tempDiv.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      // ./DC_01.md 또는 DC_01.md 형태의 상대 링크만 변환
      if (href && href.match(/^\.?\/?[\w\-]+\.md$/)) {
        const mdFile = href.replace(/^\.\//, '');
        a.href = `https://github.com/${OWNER}/${repo}/blob/${BRANCH}/${mdFile}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    });
    html = tempDiv.innerHTML;

    document.getElementById('md-content').innerHTML = html;
    document.title = filename;

    // 4단계: KaTeX 렌더링
    renderMathInElement(document.getElementById('md-content'), {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false }
      ],
      throwOnError: false
    });
  } catch (e) {
    document.getElementById('md-content').innerHTML =
      `<div class="loading">파일을 불러올 수 없습니다.<br><small>${e.message}</small></div>`;
  }
}

// 브라우저 뒤로가기
window.addEventListener('popstate', () => {
  const p = new URLSearchParams(location.search);
  if (p.get('file')) {
    showFile(p.get('file'));
  } else {
    document.getElementById('list-view').style.display = 'block';
    document.getElementById('md-view').style.display = 'none';
    document.getElementById('nav-sep2').style.display = 'none';
    document.getElementById('nav-file').style.display = 'none';
  }
});
