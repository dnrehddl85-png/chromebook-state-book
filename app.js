/* app.js - Chromebook State Book Application Logic */

// 1. Initial configuration and core constants
const DEPARTMENTS = ['전동제어과', 'DSW과', '로보틱스과', '소재에너지과'];
const CLASSES = [1, 2, 3];
const STUDENTS_PER_CLASS = 18;

// Depatment code maps for serial number and Chromebook ID templates
const DEPT_CODES = {
  '전동제어과': 'EC',  // Electric Control
  'DSW과': 'DSW',      // Digital Software
  '로보틱스과': 'ROB',  // Robotics
  '소재에너지과': 'ME'  // Materials & Energy
};

// Global App State
let db = null;
let currentDept = DEPARTMENTS[0];
let currentClass = CLASSES[0];

// Canvas Drawing State
let canvas = null;
let ctx = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let drawTarget = null; // 'homeroom' or 'deptHead'
let strokeColor = '#1e3a8a'; // Deep blue ink default

// 2. Initialize application
document.addEventListener('DOMContentLoaded', () => {
  initLucide();
  loadData();
  renderTabs();
  renderStats();
  renderCurrentSheet();
  initEventListeners();
  initCanvas();
});

function initLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// 3. Data Loading & Generation
function loadData() {
  const savedData = localStorage.getItem('chromebook_state_book');
  if (savedData) {
    try {
      db = JSON.parse(savedData);
      // Migrate or patch if some departments are missing
      DEPARTMENTS.forEach(dept => {
        if (!db[dept]) db[dept] = {};
        CLASSES.forEach(cls => {
          if (!db[dept][cls]) {
            db[dept][cls] = generateInitialClassData(dept, cls);
          }
        });
      });
    } catch (e) {
      console.error("로컬 스토리지 데이터 파싱 실패. 초기화합니다.", e);
      initializeDefaultDatabase();
    }
  } else {
    initializeDefaultDatabase();
  }
}

function initializeDefaultDatabase() {
  db = {};
  DEPARTMENTS.forEach(dept => {
    db[dept] = {};
    CLASSES.forEach(cls => {
      db[dept][cls] = generateInitialClassData(dept, cls);
    });
  });
  saveData();
}

function generateInitialClassData(dept, cls) {
  const code = DEPT_CODES[dept] || 'CB';
  const students = [];
  
  for (let i = 1; i <= STUDENTS_PER_CLASS; i++) {
    const numStr = String(i).padStart(2, '0');
    students.push({
      id: i,
      studentName: `학생${i}`,
      chromebookId: `CB-${code}-1-${cls}-${numStr}`,
      serialNumber: `SN-${code}-2026-${cls}-${numStr}`,
      remarks: ''
    });
  }
  
  return {
    students: students,
    homeroomTeacher: '',
    homeroomSign: '',      // Base64 image data or empty
    homeroomSigStyle: '1', // 1, 2, 3, 4 or 'seal'
    homeroomSignType: 'text', // 'text' or 'draw'
    departmentHead: '',
    departmentSign: '',
    deptHeadSigStyle: '1',
    deptHeadSignType: 'text'
  };
}

function saveData() {
  localStorage.setItem('chromebook_state_book', JSON.stringify(db));
  renderStats();
}

// 4. UI Rendering Functions
function renderTabs() {
  const deptTabsContainer = document.getElementById('dept-tabs');
  const classTabsContainer = document.getElementById('class-tabs');
  
  // Render Department Tabs
  deptTabsContainer.innerHTML = DEPARTMENTS.map(dept => `
    <button class="tab-btn ${dept === currentDept ? 'active' : ''}" data-dept="${dept}">
      ${dept}
    </button>
  `).join('');
  
  // Render Class Tabs
  classTabsContainer.innerHTML = CLASSES.map(cls => `
    <button class="sub-tab-btn ${cls === currentClass ? 'active' : ''}" data-class="${cls}">
      ${cls}반
    </button>
  `).join('');
}

function renderStats() {
  // Count filled signatures
  let completedSigns = 0;
  let totalPossible = DEPARTMENTS.length * CLASSES.length * 2; // homeroom + deptHead for each class = 24
  
  DEPARTMENTS.forEach(dept => {
    CLASSES.forEach(cls => {
      const data = db[dept][cls];
      if (data.homeroomTeacher && data.homeroomSign) completedSigns++;
      if (data.departmentHead && data.departmentSign) completedSigns++;
    });
  });
  
  document.getElementById('stat-signatures').innerText = `${completedSigns} / ${totalPossible}`;
}

function renderCurrentSheet() {
  const classData = db[currentDept][currentClass];
  
  // Set titles
  document.getElementById('current-sheet-title').innerText = `${currentDept} 1학년 ${currentClass}반 크롬북 관리 대장`;
  document.getElementById('current-sheet-subtitle').innerText = `정원: ${classData.students.length}명 | 크롬북 배정 및 상태 점검표`;
  
  // Render Student Table Rows
  const tbody = document.getElementById('student-table-body');
  tbody.innerHTML = '';
  
  classData.students.forEach((student, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: center; font-weight: 600; background-color: var(--bg-tertiary);">${student.id}</td>
      <td>
        <input type="text" class="grid-input font-mono" data-field="chromebookId" data-index="${index}" value="${escapeHtml(student.chromebookId)}">
      </td>
      <td>
        <input type="text" class="grid-input" data-field="studentName" data-index="${index}" value="${escapeHtml(student.studentName)}">
      </td>
      <td>
        <input type="text" class="grid-input font-mono" data-field="serialNumber" data-index="${index}" value="${escapeHtml(student.serialNumber)}">
      </td>
      <td>
        <input type="text" class="grid-input" data-field="remarks" data-index="${index}" value="${escapeHtml(student.remarks)}" placeholder="상태 양호">
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  // Render Teacher Signatures
  // Homeroom
  document.getElementById('homeroom-teacher-name').value = classData.homeroomTeacher || '';
  document.getElementById('homeroom-sig-style').value = classData.homeroomSigStyle || '1';
  renderSignatureDisplay('homeroom', classData);
  
  // Dept Head
  document.getElementById('dept-head-name').value = classData.departmentHead || '';
  document.getElementById('dept-head-sig-style').value = classData.deptHeadSigStyle || '1';
  renderSignatureDisplay('deptHead', classData);
}

function renderSignatureDisplay(role, classData) {
  const displayArea = document.getElementById(`${role === 'homeroom' ? 'homeroom' : 'dept'}-signature-display`);
  const name = role === 'homeroom' ? classData.homeroomTeacher : classData.departmentHead;
  const sign = role === 'homeroom' ? classData.homeroomSign : classData.departmentSign;
  const style = role === 'homeroom' ? classData.homeroomSigStyle : classData.deptHeadSigStyle;
  const type = role === 'homeroom' ? classData.homeroomSignType : classData.deptHeadSignType;
  
  if (!name && !sign) {
    // Show placeholder
    displayArea.innerHTML = `
      <div class="signature-placeholder">
        <i data-lucide="signature" style="width: 28px; height: 28px; color: var(--text-muted);"></i>
        <span>이름을 입력하거나 클릭하여 서명하세요</span>
      </div>
    `;
    initLucide();
    return;
  }
  
  // Clean display area
  displayArea.innerHTML = '';
  
  if (type === 'draw' && sign) {
    // Canvas drawing signature
    const img = document.createElement('img');
    img.src = sign;
    img.className = 'signature-image';
    displayArea.appendChild(img);
  } else if (name) {
    // Text-based signature font
    const container = document.createElement('div');
    if (style === 'seal') {
      container.className = 'sig-font-seal';
      // Format name to fit in circular seal (up to 3-4 letters)
      let sealText = name;
      if (name.length === 3) sealText = `${name[0]}<br>${name[1]}${name[2]}`;
      else if (name.length === 2) sealText = `${name[0]}<br>${name[1]}인`;
      else if (name.length > 3) sealText = name.substring(0, 4);
      container.innerHTML = sealText;
    } else {
      container.className = `sig-text sig-font-${style}`;
      container.innerText = name;
    }
    displayArea.appendChild(container);
  }
  
  // Add a reset/delete button
  const resetBtn = document.createElement('button');
  resetBtn.className = 'signature-reset-btn';
  resetBtn.innerHTML = '&times;';
  resetBtn.title = '서명 지우기';
  resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearSignature(role);
  });
  displayArea.appendChild(resetBtn);
}

function clearSignature(role) {
  const classData = db[currentDept][currentClass];
  if (role === 'homeroom') {
    classData.homeroomTeacher = '';
    classData.homeroomSign = '';
    classData.homeroomSignType = 'text';
    document.getElementById('homeroom-teacher-name').value = '';
  } else {
    classData.departmentHead = '';
    classData.departmentSign = '';
    classData.deptHeadSignType = 'text';
    document.getElementById('dept-head-name').value = '';
  }
  saveData();
  renderCurrentSheet();
  showToast('서명이 삭제되었습니다.', 'info');
}

// 5. Event Listeners initialization
function initEventListeners() {
  // Department Tab Click
  document.getElementById('dept-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn) {
      currentDept = btn.dataset.dept;
      currentClass = 1; // Reset to class 1 when changing department
      renderTabs();
      renderCurrentSheet();
    }
  });

  // Class Tab Click
  document.getElementById('class-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.sub-tab-btn');
    if (btn) {
      currentClass = parseInt(btn.dataset.class);
      renderTabs();
      renderCurrentSheet();
    }
  });

  // Cell inputs tracking
  document.getElementById('student-table-body').addEventListener('input', (e) => {
    const input = e.target.closest('.grid-input');
    if (input) {
      const field = input.dataset.field;
      const index = parseInt(input.dataset.index);
      const value = input.value;
      
      db[currentDept][currentClass].students[index][field] = value;
      saveData();
    }
  });

  // Teacher Name Inputs (Realtime Text Signature)
  document.getElementById('homeroom-teacher-name').addEventListener('input', (e) => {
    const name = e.target.value;
    const classData = db[currentDept][currentClass];
    classData.homeroomTeacher = name;
    if (classData.homeroomSignType !== 'draw') {
      classData.homeroomSign = name ? name : '';
    }
    saveData();
    renderSignatureDisplay('homeroom', classData);
  });

  document.getElementById('dept-head-name').addEventListener('input', (e) => {
    const name = e.target.value;
    const classData = db[currentDept][currentClass];
    classData.departmentHead = name;
    if (classData.deptHeadSignType !== 'draw') {
      classData.departmentSign = name ? name : '';
    }
    saveData();
    renderSignatureDisplay('deptHead', classData);
  });

  // Signature Font Style Drops
  document.getElementById('homeroom-sig-style').addEventListener('change', (e) => {
    const style = e.target.value;
    const classData = db[currentDept][currentClass];
    classData.homeroomSigStyle = style;
    classData.homeroomSignType = 'text'; // Override canvas when style is changed manually
    saveData();
    renderCurrentSheet();
  });

  document.getElementById('dept-head-sig-style').addEventListener('change', (e) => {
    const style = e.target.value;
    const classData = db[currentDept][currentClass];
    classData.deptHeadSigStyle = style;
    classData.deptHeadSignType = 'text';
    saveData();
    renderCurrentSheet();
  });

  // Direct Sign button opens Canvas Modal
  document.getElementById('homeroom-draw-btn').addEventListener('click', () => openSignatureModal('homeroom'));
  document.getElementById('homeroom-signature-display').addEventListener('click', (e) => {
    if (!e.target.closest('.signature-reset-btn')) {
      openSignatureModal('homeroom');
    }
  });
  
  document.getElementById('dept-draw-btn').addEventListener('click', () => openSignatureModal('deptHead'));
  document.getElementById('dept-signature-display').addEventListener('click', (e) => {
    if (!e.target.closest('.signature-reset-btn')) {
      openSignatureModal('deptHead');
    }
  });

  // Theme Toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // Print Screen
  document.getElementById('print-btn').addEventListener('click', () => {
    window.print();
  });

  // Export CSV
  document.getElementById('btn-export-csv').addEventListener('click', exportToCSV);

  // Reset to Sample
  document.getElementById('btn-reset-current').addEventListener('click', () => {
    if (confirm(`현재 [${currentDept} ${currentClass}반] 데이터를 초기 기본값으로 복구하시겠습니까?\n작성 중이던 서명과 데이터가 유실됩니다.`)) {
      db[currentDept][currentClass] = generateInitialClassData(currentDept, currentClass);
      saveData();
      renderCurrentSheet();
      showToast('샘플 데이터 복원이 완료되었습니다.', 'success');
    }
  });

  // Toggle Clipboard Panel
  document.getElementById('btn-toggle-clipboard').addEventListener('click', () => {
    const panel = document.getElementById('clipboard-panel');
    panel.classList.toggle('active');
    if (panel.classList.contains('active')) {
      document.getElementById('clipboard-textarea').focus();
    }
  });

  document.getElementById('btn-close-clipboard').addEventListener('click', () => {
    document.getElementById('clipboard-panel').classList.remove('active');
  });

  // Import Clipboard data
  document.getElementById('btn-import-clipboard').addEventListener('click', importClipboardData);

  // Google Sheet Web URL loading
  document.getElementById('btn-load-url').addEventListener('click', loadGoogleSheetCSV);
}

// 6. Signature Modal & Canvas Control
function initCanvas() {
  canvas = document.getElementById('signature-canvas');
  ctx = canvas.getContext('2d');
  
  // Set drawing options
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Handle drawing events (Mouse & Touch)
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);
  
  canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    startDrawing({
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    e.preventDefault();
  });
  
  canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    draw({
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    e.preventDefault();
  }, { passive: false });
  
  canvas.addEventListener('touchend', stopDrawing);

  // Color picker selection
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      e.target.classList.add('active');
      strokeColor = e.target.dataset.color;
    });
  });

  // Clear Canvas button
  document.getElementById('btn-clear-canvas').addEventListener('click', clearCanvas);

  // Modal actions
  document.getElementById('modal-close-btn').addEventListener('click', closeSignatureModal);
  document.getElementById('btn-cancel-modal').addEventListener('click', closeSignatureModal);
  document.getElementById('btn-save-signature').addEventListener('click', saveCanvasSignature);
}

function openSignatureModal(role) {
  drawTarget = role;
  const nameInput = role === 'homeroom' ? 'homeroom-teacher-name' : 'dept-head-name';
  const name = document.getElementById(nameInput).value.trim();
  
  if (!name) {
    alert('서명하기 전에 먼저 선생님 이름을 입력해주세요.');
    document.getElementById(nameInput).focus();
    return;
  }
  
  document.getElementById('modal-title').innerText = `${role === 'homeroom' ? '담임교사' : '부서부장'} [${name}] 직접 서명`;
  document.getElementById('signature-modal').classList.add('active');
  
  // Resize canvas according to container
  setTimeout(resizeCanvas, 100);
}

function resizeCanvas() {
  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  clearCanvas();
}

function clearCanvas() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function startDrawing(e) {
  isDrawing = true;
  const rect = canvas.getBoundingClientRect();
  
  // Handle coordinate mapping accurately for different scales
  lastX = (e.clientX - rect.left) * (canvas.width / rect.width);
  lastY = (e.clientY - rect.top) * (canvas.height / rect.height);
}

function draw(e) {
  if (!isDrawing) return;
  
  const rect = canvas.getBoundingClientRect();
  const currentX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const currentY = (e.clientY - rect.top) * (canvas.height / rect.height);
  
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(currentX, currentY);
  ctx.strokeStyle = strokeColor;
  ctx.stroke();
  
  lastX = currentX;
  lastY = currentY;
}

function stopDrawing() {
  isDrawing = false;
}

function closeSignatureModal() {
  document.getElementById('signature-modal').classList.remove('active');
  clearCanvas();
}

function saveCanvasSignature() {
  // Save canvas as image Base64 URL
  const dataURL = canvas.toDataURL('image/png');
  const classData = db[currentDept][currentClass];
  
  if (drawTarget === 'homeroom') {
    classData.homeroomSign = dataURL;
    classData.homeroomSignType = 'draw';
  } else {
    classData.departmentSign = dataURL;
    classData.deptHeadSignType = 'draw';
  }
  
  saveData();
  renderCurrentSheet();
  closeSignatureModal();
  showToast('서명이 삽입되었습니다.', 'success');
}

// 7. Data Import & Export Logic
function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];
    
    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          row[row.length - 1] += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        row[row.length - 1] += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push("");
      } else if (c === '\r' || c === '\n') {
        if (c === '\r' && next === '\n') i++;
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += c;
      }
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  return lines;
}

function importCSVToCurrentClass(rows) {
  // Basic sanity check
  if (rows.length === 0) {
    showToast('파싱할 데이터가 없습니다.', 'error');
    return;
  }
  
  // Try to find headers and filter out metadata rows
  let headerIndex = -1;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const rowStr = rows[i].join(' ').toLowerCase();
    if (rowStr.includes('이름') || rowStr.includes('성명') || rowStr.includes('학생') || rowStr.includes('크롬북') || rowStr.includes('연번')) {
      headerIndex = i;
      break;
    }
  }
  
  // Extract data rows
  const dataStart = headerIndex + 1;
  const rawDataRows = rows.slice(dataStart).filter(r => r.some(cell => cell.trim() !== ""));
  
  if (rawDataRows.length === 0) {
    showToast('가져올 데이터 행을 찾을 수 없습니다.', 'error');
    return;
  }
  
  // Try to map columns based on header or typical patterns
  let nameCol = 2; // Default guesses
  let cbCol = 1;
  let snCol = 3;
  let remCol = 4;
  
  if (headerIndex !== -1) {
    const headers = rows[headerIndex];
    headers.forEach((h, idx) => {
      const headerText = h.trim();
      if (headerText.includes('이름') || headerText.includes('성명')) nameCol = idx;
      else if (headerText.includes('크롬북') || headerText.includes('ID') || headerText.includes('관리번호') || headerText.includes('아이디')) cbCol = idx;
      else if (headerText.includes('일련번호') || headerText.includes('SN') || headerText.includes('S/N')) snCol = idx;
      else if (headerText.includes('비고') || headerText.includes('특이')) remCol = idx;
    });
  }
  
  const classData = db[currentDept][currentClass];
  const newStudents = [];
  
  // We limit or pad to STUDENTS_PER_CLASS (18) as specified by user, but let it grow if user provided more
  const rowLimit = Math.max(STUDENTS_PER_CLASS, rawDataRows.length);
  
  for (let i = 0; i < rowLimit; i++) {
    const row = rawDataRows[i];
    const numStr = String(i + 1).padStart(2, '0');
    
    if (row) {
      newStudents.push({
        id: i + 1,
        studentName: row[nameCol] ? row[nameCol].trim() : `학생${i+1}`,
        chromebookId: row[cbCol] ? row[cbCol].trim() : `CB-${DEPT_CODES[currentDept]}-1-${currentClass}-${numStr}`,
        serialNumber: row[snCol] ? row[snCol].trim() : `SN-${DEPT_CODES[currentDept]}-2026-${currentClass}-${numStr}`,
        remarks: row[remCol] ? row[remCol].trim() : ''
      });
    } else {
      // Pad empty rows
      newStudents.push({
        id: i + 1,
        studentName: '',
        chromebookId: `CB-${DEPT_CODES[currentDept]}-1-${currentClass}-${numStr}`,
        serialNumber: '',
        remarks: ''
      });
    }
  }
  
  classData.students = newStudents;
  saveData();
  renderCurrentSheet();
  showToast(`${rawDataRows.length}명의 학생 데이터를 성공적으로 가져왔습니다.`, 'success');
}

// Fetch Google Sheet CSV published url
async function loadGoogleSheetCSV() {
  const url = document.getElementById('sheet-url-input').value.trim();
  if (!url) {
    alert('구글 시트 웹 게시 링크(CSV)를 입력해 주세요.');
    return;
  }
  
  if (!url.includes('docs.google.com/spreadsheets') || !url.includes('output=csv')) {
    alert('올바른 구글 시트 CSV 게시 링크 주소가 아닙니다. [웹에 게시]를 CSV 옵션으로 내보낸 주소여야 합니다.');
    return;
  }
  
  showToast('구글 시트 연동 중...', 'info');
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('네트워크 응답 오류');
    
    const csvText = await response.text();
    const rows = parseCSV(csvText);
    importCSVToCurrentClass(rows);
    document.getElementById('sheet-url-input').value = '';
  } catch (error) {
    console.error("구글 시트 로드 실패:", error);
    alert('구글 시트 데이터를 가져오지 못했습니다.\n네트워크 차단(CORS) 오류이거나 링크 설정 오류일 수 있습니다. 아래 [복사한 데이터 붙여넣기] 기능을 이용하시면 오류 없이 데이터 적용이 가능합니다.');
    showToast('구글 시트 연동 실패', 'error');
  }
}

// Paste text parsing (TSV/CSV)
function importClipboardData() {
  const text = document.getElementById('clipboard-textarea').value.trim();
  if (!text) {
    alert('붙여넣을 텍스트가 비어 있습니다.');
    return;
  }
  
  // Detect TSV (Tabs) vs CSV (Commas)
  const rows = [];
  const lines = text.split('\n');
  
  lines.forEach(line => {
    if (line.includes('\t')) {
      rows.push(line.split('\t'));
    } else {
      // fallback to CSV parse
      rows.push(line.split(','));
    }
  });
  
  importCSVToCurrentClass(rows);
  document.getElementById('clipboard-textarea').value = '';
  document.getElementById('clipboard-panel').classList.remove('active');
}

// Export sheet grid to local CSV file
function exportToCSV() {
  const classData = db[currentDept][currentClass];
  
  let csvContent = "\ufeff"; // BOM for excel Korean charset support
  csvContent += `학과,반,연번,크롬북 ID,학생 이름,일련번호(S/N),비고\n`;
  
  classData.students.forEach(student => {
    const row = [
      currentDept,
      `${currentClass}반`,
      student.id,
      `"${student.chromebookId.replace(/"/g, '""')}"`,
      `"${student.studentName.replace(/"/g, '""')}"`,
      `"${student.serialNumber.replace(/"/g, '""')}"`,
      `"${student.remarks.replace(/"/g, '""')}"`
    ];
    csvContent += row.join(",") + "\n";
  });
  
  // Add signature state at bottom of csv
  csvContent += `\n`;
  csvContent += `담임교사 서명,${classData.homeroomTeacher || ''},(${classData.homeroomSign ? '서명완료' : '서명누락'})\n`;
  csvContent += `부서부장 서명,${classData.departmentHead || ''},(${classData.departmentSign ? '서명완료' : '서명누락'})\n`;
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `크롬북관리대장_${currentDept}_${currentClass}반.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('CSV 파일이 성공적으로 다운로드되었습니다.', 'success');
}

// 8. Visual theme control (Light/Dark mode)
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  html.setAttribute('data-theme', newTheme);
  
  const themeBtn = document.getElementById('theme-toggle');
  if (newTheme === 'dark') {
    themeBtn.innerHTML = '<i data-lucide="sun"></i><span>라이트 모드</span>';
  } else {
    themeBtn.innerHTML = '<i data-lucide="moon"></i><span>다크 모드</span>';
  }
  initLucide();
  showToast(`${newTheme === 'dark' ? '다크' : '라이트'} 모드로 전환되었습니다.`, 'info');
}

// 9. Utility Functions
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toast-icon');
  const msgEl = document.getElementById('toast-message');
  
  msgEl.innerText = message;
  toast.className = `toast show toast-${type}`;
  
  if (type === 'success') {
    icon.setAttribute('data-lucide', 'check-circle');
    toast.style.borderColor = 'var(--success-color)';
  } else if (type === 'error') {
    icon.setAttribute('data-lucide', 'alert-triangle');
    toast.style.borderColor = 'var(--danger-color)';
  } else {
    icon.setAttribute('data-lucide', 'info');
    toast.style.borderColor = 'var(--accent-color)';
  }
  initLucide();
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
