/* app.js - Chromebook Summary Ledger for Yeongnam Technical High School */

// 1. Initial configuration and core constants
const GRADES = [1, 2];
const DB_KEY = 'chromebook_summary_ledger_v2';

// Departments configuration for initial setup
const DEPT_1 = ['전동제어과', 'DSW과', '로보틱스과', '소재에너지과'];
const DEPT_2 = ['전동제어과', 'DSW과', '로보틱스과', '소재에너지과', '전기제어과', '정밀기계과'];

// Global App State
let db = null;
let currentGrade = 1; // 1 or 2
let currentDate = ''; // Format: YYYY-MM-DD

// Canvas Drawing State
let canvas = null;
let ctx = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let drawTargetRole = null; // 'homeroom', 'deptHead', or 'vicePrincipal'
let drawTargetRowIndex = null; // if role is 'homeroom', which row index
let strokeColor = '#1e3a8a'; // Deep blue ink default

// 2. Initialize application
document.addEventListener('DOMContentLoaded', () => {
  initDate();
  loadData();
  renderGradeTabs();
  renderStats();
  renderCurrentSheet();
  initEventListeners();
  initCanvas();
  initLucide();
});

function initLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function initDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  currentDate = `${yyyy}-${mm}-${dd}`;
  
  const dateInput = document.getElementById('sheet-date-input');
  if (dateInput) {
    dateInput.value = currentDate;
  }
  updatePrintDateDisplay();
}

function updatePrintDateDisplay() {
  const printDisplay = document.getElementById('print-date-display');
  if (printDisplay) {
    const parts = currentDate.split('-');
    if (parts.length === 3) {
      printDisplay.innerText = `검수 일자: ${parts[0]}년 ${parts[1]}월 ${parts[2]}일`;
    } else {
      printDisplay.innerText = `검수 일자: ${currentDate}`;
    }
  }
}

// 3. Data Loading & Generation
function loadData() {
  const savedData = localStorage.getItem(DB_KEY);
  if (savedData) {
    try {
      db = JSON.parse(savedData);
    } catch (e) {
      console.error("데이터 로딩 실패. 새로 생성합니다.", e);
      db = {};
    }
  } else {
    db = {};
  }
  
  ensureDateDataExists(currentDate);
}

function getLatestAvailableDateBefore(targetDate) {
  const dates = Object.keys(db).filter(d => d < targetDate).sort();
  if (dates.length > 0) {
    return dates[dates.length - 1];
  }
  return null;
}

function ensureDateDataExists(dateStr) {
  if (db[dateStr]) return;
  
  db[dateStr] = {};
  const prevDate = getLatestAvailableDateBefore(dateStr);
  
  GRADES.forEach(grade => {
    if (prevDate && db[prevDate] && db[prevDate][grade]) {
      const prevGradeData = db[prevDate][grade];
      db[dateStr][grade] = {
        classes: prevGradeData.classes.map(cls => ({
          grade: cls.grade,
          deptClass: cls.deptClass,
          teacherName: cls.teacherName,
          quantity: cls.quantity,
          chargingCabinet: cls.chargingCabinet || 'normal',
          signature: '',
          sigStyle: cls.sigStyle || '1',
          signType: 'text'
        })),
        deptHeadName: prevGradeData.deptHeadName || '',
        deptHeadSign: '',
        deptHeadSigStyle: prevGradeData.deptHeadSigStyle || '1',
        deptHeadSignType: 'text',
        vicePrincipalName: prevGradeData.vicePrincipalName || '',
        vicePrincipalSign: '',
        vicePrincipalSigStyle: prevGradeData.vicePrincipalSigStyle || '1',
        vicePrincipalSignType: 'text'
      };
    } else {
      // Generate default data
      db[dateStr][grade] = {
        classes: generateInitialClasses(grade),
        deptHeadName: '',
        deptHeadSign: '',
        deptHeadSigStyle: '1',
        deptHeadSignType: 'text',
        vicePrincipalName: '',
        vicePrincipalSign: '',
        vicePrincipalSigStyle: '1',
        vicePrincipalSignType: 'text'
      };
    }
  });
  
  saveData();
}

function generateInitialClasses(grade) {
  const classesList = [];
  
  if (grade === 1) {
    DEPT_1.forEach(dept => {
      for (let ban = 1; ban <= 3; ban++) {
        classesList.push({
          grade: 1,
          deptClass: `${dept} ${ban}반`,
          teacherName: '',
          quantity: 18,
          chargingCabinet: 'normal',
          signature: '',
          sigStyle: '1',
          signType: 'text'
        });
      }
    });
  } else if (grade === 2) {
    DEPT_2.forEach((dept, idx) => {
      const bansCount = (idx === DEPT_2.length - 1) ? 3 : 2;
      for (let ban = 1; ban <= bansCount; ban++) {
        classesList.push({
          grade: 2,
          deptClass: `${dept} ${ban}반`,
          teacherName: '',
          quantity: 18,
          chargingCabinet: 'normal',
          signature: '',
          sigStyle: '1',
          signType: 'text'
        });
      }
    });
  }
  
  return classesList;
}

function saveData() {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  renderStats();
}

// 4. UI Rendering Functions
function renderGradeTabs() {
  const tabsContainer = document.getElementById('grade-tabs');
  tabsContainer.innerHTML = `
    <button class="tab-btn ${currentGrade === 1 ? 'active' : ''}" data-grade="1">1학년 대장 (12학급)</button>
    <button class="tab-btn ${currentGrade === 2 ? 'active' : ''}" data-grade="2">2학년 대장 (13학급)</button>
  `;
}

function renderStats() {
  let totalClasses = 0;
  let signedCount = 0;
  let cabinetErrors = 0;
  
  if (db[currentDate]) {
    GRADES.forEach(grade => {
      const gradeData = db[currentDate][grade];
      if (gradeData) {
        totalClasses += gradeData.classes.length;
        gradeData.classes.forEach(cls => {
          if (cls.signature && cls.teacherName) {
            signedCount++;
          }
          if (cls.chargingCabinet === 'cable_error' || cls.chargingCabinet === 'port_error') {
            cabinetErrors++;
          }
        });
      }
    });
  }
  
  document.getElementById('stat-total-classes').innerText = `${totalClasses}개 학급`;
  document.getElementById('stat-signed-count').innerText = `${signedCount} / ${totalClasses} 완료`;
  document.getElementById('stat-cabinet-errors').innerText = `${cabinetErrors}개소`;
}

function renderCurrentSheet() {
  const gradeData = db[currentDate][currentGrade];
  
  document.getElementById('current-sheet-title').innerText = `${currentGrade}학년 크롬북 관리 대장`;
  document.getElementById('current-sheet-subtitle').innerText = `영남공업고등학교 | 학급 수: ${gradeData.classes.length}개 반`;
  
  const tbody = document.getElementById('class-table-body');
  tbody.innerHTML = '';
  
  gradeData.classes.forEach((cls, index) => {
    const tr = document.createElement('tr');
    
    const cabinetSelectHtml = `
      <select class="grid-input" data-field="chargingCabinet" data-index="${index}" style="text-align: center; color: ${getCabinetColor(cls.chargingCabinet)}; font-weight: 500;">
        <option value="normal" ${cls.chargingCabinet === 'normal' ? 'selected' : ''} style="color: var(--success-color);">이상없음</option>
        <option value="cable_error" ${cls.chargingCabinet === 'cable_error' ? 'selected' : ''} style="color: #f59e0b;">케이블 불량</option>
        <option value="port_error" ${cls.chargingCabinet === 'port_error' ? 'selected' : ''} style="color: var(--danger-color);">충전 단자 입구 불량</option>
      </select>
    `;

    tr.innerHTML = `
      <td>
        <input type="text" class="grid-input" data-field="deptClass" data-index="${index}" value="${escapeHtml(cls.deptClass)}" style="font-weight: 500;">
      </td>
      <td>
        <input type="text" class="grid-input row-teacher-name" data-field="teacherName" data-index="${index}" value="${escapeHtml(cls.teacherName)}" placeholder="담임이름 입력">
      </td>
      <td>
        <input type="number" class="grid-input" data-field="quantity" data-index="${index}" value="${cls.quantity}" style="text-align: center;">
      </td>
      <td>
        ${cabinetSelectHtml}
      </td>
      <td class="sig-cell">
        <div class="row-sig-container">
          <div class="row-sig-display" data-index="${index}" title="클릭하여 직접 서명하기">
            ${getRowSignatureCellInnerHtml(cls, index)}
          </div>
          <div class="row-sig-controls no-print">
            <select class="table-style-select" data-field="sigStyle" data-index="${index}">
              <option value="1" ${cls.sigStyle === '1' ? 'selected' : ''}>펜</option>
              <option value="2" ${cls.sigStyle === '2' ? 'selected' : ''}>붓</option>
              <option value="3" ${cls.sigStyle === '3' ? 'selected' : ''}>독도</option>
              <option value="seal" ${cls.sigStyle === 'seal' ? 'selected' : ''}>도장</option>
            </select>
            <button class="btn-sig-draw" data-index="${index}" title="직접 그리기 서명패드 열기">
              <i data-lucide="edit-3" style="width:12px; height:12px;"></i>
            </button>
          </div>
        </div>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
  
  // Render Bottom final sign-offs
  // Department Head
  document.getElementById('dept-head-name').value = gradeData.deptHeadName || '';
  document.getElementById('dept-head-sig-style').value = gradeData.deptHeadSigStyle || '1';
  renderDeptHeadSignatureDisplay(gradeData);
  
  // Vice Principal
  document.getElementById('vice-principal-name').value = gradeData.vicePrincipalName || '';
  document.getElementById('vice-principal-sig-style').value = gradeData.vicePrincipalSigStyle || '1';
  renderVicePrincipalSignatureDisplay(gradeData);
  
  initLucide();
}

function getCabinetColor(status) {
  if (status === 'cable_error') return '#d97706';
  if (status === 'port_error') return 'var(--danger-color)';
  return 'var(--success-color)';
}

function getRowSignatureCellInnerHtml(cls, index) {
  const name = cls.teacherName;
  const sign = cls.signature;
  const style = cls.sigStyle;
  const type = cls.signType;
  
  let sigContentHtml = '';
  
  if (!name && !sign) {
    sigContentHtml = `
      <div class="signature-placeholder" style="font-size:0.75rem;">
        <span>이름을 기입해 주세요</span>
      </div>
    `;
  } else if (type === 'draw' && sign) {
    sigContentHtml = `<img src="${sign}" class="signature-image">`;
  } else if (name) {
    if (style === 'seal') {
      let sealText = name;
      if (name.length === 3) sealText = `${name[0]}<br>${name[1]}${name[2]}`;
      else if (name.length === 2) sealText = `${name[0]}<br>${name[1]}인`;
      else if (name.length > 3) sealText = name.substring(0, 4);
      sigContentHtml = `<div class="sig-font-seal">${sealText}</div>`;
    } else {
      sigContentHtml = `<div class="sig-text sig-font-${style}">${name}</div>`;
    }
  }
  
  const resetBtnHtml = (name || sign) ? `<button class="signature-reset-btn row-sig-reset" data-index="${index}" title="서명 지우기">&times;</button>` : '';
  
  return `${sigContentHtml}${resetBtnHtml}`;
}

function renderDeptHeadSignatureDisplay(gradeData) {
  const displayArea = document.getElementById('dept-signature-display');
  const name = gradeData.deptHeadName;
  const sign = gradeData.deptHeadSign;
  const style = gradeData.deptHeadSigStyle;
  const type = gradeData.deptHeadSignType;
  
  if (!name && !sign) {
    displayArea.innerHTML = `
      <div class="signature-placeholder" id="dept-placeholder">
        <i data-lucide="signature" style="width: 24px; height: 24px; color: var(--text-muted);"></i>
        <span>이름 입력 또는 서명란 클릭</span>
      </div>
    `;
    return;
  }
  
  displayArea.innerHTML = '';
  
  if (type === 'draw' && sign) {
    const img = document.createElement('img');
    img.src = sign;
    img.className = 'signature-image';
    displayArea.appendChild(img);
  } else if (name) {
    const container = document.createElement('div');
    if (style === 'seal') {
      container.className = 'sig-font-seal';
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
  
  const resetBtn = document.createElement('button');
  resetBtn.className = 'signature-reset-btn';
  resetBtn.innerHTML = '&times;';
  resetBtn.title = '서명 지우기';
  resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearDeptHeadSignature();
  });
  displayArea.appendChild(resetBtn);
}

function renderVicePrincipalSignatureDisplay(gradeData) {
  const displayArea = document.getElementById('vice-principal-signature-display');
  const name = gradeData.vicePrincipalName;
  const sign = gradeData.vicePrincipalSign;
  const style = gradeData.vicePrincipalSigStyle;
  const type = gradeData.vicePrincipalSignType;
  
  if (!name && !sign) {
    displayArea.innerHTML = `
      <div class="signature-placeholder" id="vice-principal-placeholder">
        <i data-lucide="signature" style="width: 24px; height: 24px; color: var(--text-muted);"></i>
        <span>이름 입력 또는 서명란 클릭</span>
      </div>
    `;
    return;
  }
  
  displayArea.innerHTML = '';
  
  if (type === 'draw' && sign) {
    const img = document.createElement('img');
    img.src = sign;
    img.className = 'signature-image';
    displayArea.appendChild(img);
  } else if (name) {
    const container = document.createElement('div');
    if (style === 'seal') {
      container.className = 'sig-font-seal';
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
  
  const resetBtn = document.createElement('button');
  resetBtn.className = 'signature-reset-btn';
  resetBtn.innerHTML = '&times;';
  resetBtn.title = '서명 지우기';
  resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearVicePrincipalSignature();
  });
  displayArea.appendChild(resetBtn);
}

function clearDeptHeadSignature() {
  const gradeData = db[currentDate][currentGrade];
  gradeData.deptHeadName = '';
  gradeData.deptHeadSign = '';
  gradeData.deptHeadSignType = 'text';
  document.getElementById('dept-head-name').value = '';
  saveData();
  renderCurrentSheet();
  showToast('부장 확인 서명이 지워졌습니다.', 'info');
}

function clearVicePrincipalSignature() {
  const gradeData = db[currentDate][currentGrade];
  gradeData.vicePrincipalName = '';
  gradeData.vicePrincipalSign = '';
  gradeData.vicePrincipalSignType = 'text';
  document.getElementById('vice-principal-name').value = '';
  saveData();
  renderCurrentSheet();
  showToast('교감 확인 서명이 지워졌습니다.', 'info');
}

function clearRowSignature(index) {
  const classRow = db[currentDate][currentGrade].classes[index];
  classRow.signature = '';
  classRow.signType = 'text';
  saveData();
  renderCurrentSheet();
  showToast(`${classRow.deptClass}의 담임 서명이 삭제되었습니다.`, 'info');
}

// 5. Event Listeners initialization
function initEventListeners() {
  // Date Selector Change
  document.getElementById('sheet-date-input').addEventListener('change', (e) => {
    const newDate = e.target.value;
    if (newDate) {
      currentDate = newDate;
      ensureDateDataExists(currentDate);
      updatePrintDateDisplay();
      renderCurrentSheet();
      renderStats();
      showToast(`${currentDate} 대장을 불러왔습니다.`, 'info');
    }
  });

  // Grade Navigation Tabs Click
  document.getElementById('grade-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn) {
      currentGrade = parseInt(btn.dataset.grade);
      renderGradeTabs();
      renderCurrentSheet();
    }
  });

  // Table row elements interaction tracking (Event Delegation)
  const tableBody = document.getElementById('class-table-body');
  
  tableBody.addEventListener('input', (e) => {
    const el = e.target;
    const field = el.dataset.field;
    const index = parseInt(el.dataset.index);
    if (!field || isNaN(index)) return;
    
    const classRow = db[currentDate][currentGrade].classes[index];
    let val = el.value;
    
    if (field === 'grade') val = parseInt(val);
    if (field === 'quantity') val = parseInt(val) || 0;
    
    classRow[field] = val;
    
    // Partial DOM Update for teacherName to avoid focus loss
    if (field === 'teacherName') {
      if (classRow.signType !== 'draw') {
        classRow.signature = val ? val : '';
      }
      saveData();
      
      // Update signature cell DOM directly without full table re-render
      const sigDisplay = document.querySelectorAll('.row-sig-display')[index];
      if (sigDisplay) {
        sigDisplay.innerHTML = getRowSignatureCellInnerHtml(classRow, index);
      }
      return;
    }
    
    saveData();
  });

  tableBody.addEventListener('change', (e) => {
    const el = e.target;
    const field = el.dataset.field;
    const index = parseInt(el.dataset.index);
    if (!field || isNaN(index)) return;
    
    const classRow = db[currentDate][currentGrade].classes[index];
    
    if (field === 'sigStyle') {
      classRow.sigStyle = el.value;
      classRow.signType = 'text'; // override canvas
      saveData();
      renderCurrentSheet();
      return;
    }
    
    if (field === 'chargingCabinet' || field === 'grade') {
      const val = field === 'grade' ? parseInt(el.value) : el.value;
      classRow[field] = val;
      saveData();
      renderCurrentSheet();
    }
  });

  // Handle buttons and signature display click inside table rows
  tableBody.addEventListener('click', (e) => {
    const resetBtn = e.target.closest('.row-sig-reset');
    if (resetBtn) {
      e.stopPropagation();
      const index = parseInt(resetBtn.dataset.index);
      clearRowSignature(index);
      return;
    }
    
    const drawBtn = e.target.closest('.btn-sig-draw');
    if (drawBtn) {
      const index = parseInt(drawBtn.dataset.index);
      openRowSignatureModal(index);
      return;
    }
    
    const sigDisplay = e.target.closest('.row-sig-display');
    if (sigDisplay && !e.target.closest('.row-sig-reset')) {
      const index = parseInt(sigDisplay.dataset.index);
      openRowSignatureModal(index);
    }
  });

  // Dept Head Name change
  document.getElementById('dept-head-name').addEventListener('input', (e) => {
    const val = e.target.value;
    const gradeData = db[currentDate][currentGrade];
    gradeData.deptHeadName = val;
    if (gradeData.deptHeadSignType !== 'draw') {
      gradeData.deptHeadSign = val ? val : '';
    }
    saveData();
    renderDeptHeadSignatureDisplay(gradeData);
  });

  // Dept Head Style Dropdown change
  document.getElementById('dept-head-sig-style').addEventListener('change', (e) => {
    const val = e.target.value;
    const gradeData = db[currentDate][currentGrade];
    gradeData.deptHeadSigStyle = val;
    gradeData.deptHeadSignType = 'text';
    saveData();
    renderCurrentSheet();
  });

  // Dept Head Sign Canvas open
  document.getElementById('dept-draw-btn').addEventListener('click', () => openDeptHeadSignatureModal());
  document.getElementById('dept-signature-display').addEventListener('click', (e) => {
    if (!e.target.closest('.signature-reset-btn')) {
      openDeptHeadSignatureModal();
    }
  });

  // Vice Principal Name change
  document.getElementById('vice-principal-name').addEventListener('input', (e) => {
    const val = e.target.value;
    const gradeData = db[currentDate][currentGrade];
    gradeData.vicePrincipalName = val;
    if (gradeData.vicePrincipalSignType !== 'draw') {
      gradeData.vicePrincipalSign = val ? val : '';
    }
    saveData();
    renderVicePrincipalSignatureDisplay(gradeData);
  });

  // Vice Principal Style Dropdown change
  document.getElementById('vice-principal-sig-style').addEventListener('change', (e) => {
    const val = e.target.value;
    const gradeData = db[currentDate][currentGrade];
    gradeData.vicePrincipalSigStyle = val;
    gradeData.vicePrincipalSignType = 'text';
    saveData();
    renderCurrentSheet();
  });

  // Vice Principal Sign Canvas open
  document.getElementById('vice-principal-draw-btn').addEventListener('click', () => openVicePrincipalSignatureModal());
  document.getElementById('vice-principal-signature-display').addEventListener('click', (e) => {
    if (!e.target.closest('.signature-reset-btn')) {
      openVicePrincipalSignatureModal();
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
    if (confirm(`현재 [${currentGrade}학년] 대장을 초기 기본값으로 복구하시겠습니까?\n작성 중이던 서명과 데이터가 모두 유실됩니다.`)) {
      db[currentDate][currentGrade] = {
        classes: generateInitialClasses(currentGrade),
        deptHeadName: '',
        deptHeadSign: '',
        deptHeadSigStyle: '1',
        deptHeadSignType: 'text',
        vicePrincipalName: '',
        vicePrincipalSign: '',
        vicePrincipalSigStyle: '1',
        vicePrincipalSignType: 'text'
      };
      saveData();
      renderCurrentSheet();
      showToast('대장이 복원되었습니다.', 'success');
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

// 6. Signature Canvas Controllers
function initCanvas() {
  canvas = document.getElementById('signature-canvas');
  ctx = canvas.getContext('2d');
  
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);
  
  canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
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

  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      e.target.classList.add('active');
      strokeColor = e.target.dataset.color;
    });
  });

  document.getElementById('btn-clear-canvas').addEventListener('click', clearCanvas);
  document.getElementById('modal-close-btn').addEventListener('click', closeSignatureModal);
  document.getElementById('btn-cancel-modal').addEventListener('click', closeSignatureModal);
  document.getElementById('btn-save-signature').addEventListener('click', saveCanvasSignature);
}

function openRowSignatureModal(index) {
  const classRow = db[currentDate][currentGrade].classes[index];
  const name = (classRow.teacherName || '').trim();
  
  if (!name) {
    alert('서명하기 전에 먼저 담임 성명을 입력해 주세요.');
    const inputs = document.querySelectorAll(`input[data-field="teacherName"]`);
    if (inputs[index]) inputs[index].focus();
    return;
  }
  
  drawTargetRole = 'homeroom';
  drawTargetRowIndex = index;
  
  document.getElementById('modal-title').innerText = `${classRow.deptClass} 담임교사 [${name}] 직접 서명`;
  document.getElementById('signature-modal').classList.add('active');
  setTimeout(resizeCanvas, 100);
}

function openDeptHeadSignatureModal() {
  const gradeData = db[currentDate][currentGrade];
  const name = (gradeData.deptHeadName || '').trim();
  
  if (!name) {
    alert('서명하기 전에 부서 부장 성명을 입력해 주세요.');
    document.getElementById('dept-head-name').focus();
    return;
  }
  
  drawTargetRole = 'deptHead';
  drawTargetRowIndex = null;
  
  document.getElementById('modal-title').innerText = `부서 부장 [${name}] 직접 서명`;
  document.getElementById('signature-modal').classList.add('active');
  setTimeout(resizeCanvas, 100);
}

function openVicePrincipalSignatureModal() {
  const gradeData = db[currentDate][currentGrade];
  const name = (gradeData.vicePrincipalName || '').trim();
  
  if (!name) {
    alert('서명하기 전에 교감 선생님 성명을 입력해 주세요.');
    document.getElementById('vice-principal-name').focus();
    return;
  }
  
  drawTargetRole = 'vicePrincipal';
  drawTargetRowIndex = null;
  
  document.getElementById('modal-title').innerText = `교감 선생님 [${name}] 직접 서명`;
  document.getElementById('signature-modal').classList.add('active');
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

// Touchend maps to stop drawing
function stopDrawing() {
  isDrawing = false;
}

function closeSignatureModal() {
  document.getElementById('signature-modal').classList.remove('active');
  clearCanvas();
}

function saveCanvasSignature() {
  const dataURL = canvas.toDataURL('image/png');
  
  if (drawTargetRole === 'homeroom') {
    const classRow = db[currentDate][currentGrade].classes[drawTargetRowIndex];
    classRow.signature = dataURL;
    classRow.signType = 'draw';
  } else if (drawTargetRole === 'deptHead') {
    const gradeData = db[currentDate][currentGrade];
    gradeData.deptHeadSign = dataURL;
    gradeData.deptHeadSignType = 'draw';
  } else if (drawTargetRole === 'vicePrincipal') {
    const gradeData = db[currentDate][currentGrade];
    gradeData.vicePrincipalSign = dataURL;
    gradeData.vicePrincipalSignType = 'draw';
  }
  
  saveData();
  renderCurrentSheet();
  closeSignatureModal();
  showToast('서명이 안전하게 삽입되었습니다.', 'success');
}

// 7. Data Import & Export logic
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
          i++;
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

function importCSVToCurrentClasses(rows) {
  if (rows.length === 0) {
    showToast('파싱할 데이터가 없습니다.', 'error');
    return;
  }
  
  let headerIndex = -1;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const rowStr = rows[i].join(' ').toLowerCase();
    if (rowStr.includes('반') || rowStr.includes('담임') || rowStr.includes('학과') || rowStr.includes('수량') || rowStr.includes('학년')) {
      headerIndex = i;
      break;
    }
  }
  
  const dataStart = headerIndex + 1;
  const rawDataRows = rows.slice(dataStart).filter(r => r.some(cell => cell.trim() !== ""));
  
  if (rawDataRows.length === 0) {
    showToast('가져올 데이터 행을 찾을 수 없습니다.', 'error');
    return;
  }
  
  let gradeCol = 0;
  let deptClassCol = 1;
  let teacherCol = 2;
  let qtyCol = 3;
  let cabinetCol = 4;
  
  if (headerIndex !== -1) {
    const headers = rows[headerIndex];
    headers.forEach((h, idx) => {
      const headerText = h.trim();
      if (headerText.includes('학년')) gradeCol = idx;
      else if (headerText.includes('반') || headerText.includes('학과')) deptClassCol = idx;
      else if (headerText.includes('담임') || headerText.includes('교사') || headerText.includes('성명')) teacherCol = idx;
      else if (headerText.includes('수량') || headerText.includes('대수') || headerText.includes('개수')) qtyCol = idx;
      else if (headerText.includes('충전함') || headerText.includes('이상') || headerText.includes('유무') || headerText.includes('상태')) cabinetCol = idx;
    });
  }
  
  const currentGradeData = db[currentDate][currentGrade];
  const newClasses = [];
  
  rawDataRows.forEach((row) => {
    let parsedGrade = currentGrade;
    if (row[gradeCol]) {
      const gStr = row[gradeCol].replace(/[^0-9]/g, '');
      if (gStr === '1' || gStr === '2') {
        parsedGrade = parseInt(gStr);
      }
    }
    
    if (parsedGrade === currentGrade) {
      let cabStatus = 'normal';
      const rawCabVal = row[cabinetCol] ? row[cabinetCol].trim() : '';
      if (rawCabVal.includes('케이블') || rawCabVal.includes('선')) cabStatus = 'cable_error';
      else if (rawCabVal.includes('단자') || rawCabVal.includes('입구') || rawCabVal.includes('포트') || rawCabVal.includes('불량')) cabStatus = 'port_error';
      
      newClasses.push({
        grade: currentGrade,
        deptClass: row[deptClassCol] ? row[deptClassCol].trim() : `전공반`,
        teacherName: row[teacherCol] ? row[teacherCol].trim() : '',
        quantity: row[qtyCol] ? (parseInt(row[qtyCol].replace(/[^0-9]/g, '')) || 0) : 18,
        chargingCabinet: cabStatus,
        signature: '',
        sigStyle: '1',
        signType: 'text'
      });
    }
  });
  
  if (newClasses.length === 0) {
    showToast('현재 학년에 일치하는 데이터를 찾지 못했습니다.', 'error');
    return;
  }
  
  currentGradeData.classes = newClasses;
  saveData();
  renderCurrentSheet();
  showToast(`${newClasses.length}개 학급 데이터를 가져왔습니다.`, 'success');
}

async function loadGoogleSheetCSV() {
  const url = document.getElementById('sheet-url-input').value.trim();
  if (!url) {
    alert('구글 시트 웹 게시 링크(CSV)를 입력해 주세요.');
    return;
  }
  
  if (!url.includes('docs.google.com/spreadsheets') || !url.includes('output=csv')) {
    alert('올바른 구글 시트 CSV 게시 링크 주소가 아닙니다.');
    return;
  }
  
  showToast('구글 시트 연동 중...', 'info');
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('네트워크 응답 오류');
    
    const csvText = await response.text();
    const rows = parseCSV(csvText);
    importCSVToCurrentClasses(rows);
    document.getElementById('sheet-url-input').value = '';
  } catch (error) {
    console.error("구글 시트 로드 실패:", error);
    alert('CORS 오류 또는 네트워크 장벽으로 인해 연동이 차단되었습니다. 복사-붙여넣기 탭 기능을 이용해 주세요!');
    showToast('구글 시트 연동 실패', 'error');
  }
}

function importClipboardData() {
  const text = document.getElementById('clipboard-textarea').value.trim();
  if (!text) {
    alert('붙여넣을 텍스트가 비어 있습니다.');
    return;
  }
  
  const rows = [];
  const lines = text.split('\n');
  
  lines.forEach(line => {
    if (line.includes('\t')) {
      rows.push(line.split('\t'));
    } else {
      rows.push(line.split(','));
    }
  });
  
  importCSVToCurrentClasses(rows);
  document.getElementById('clipboard-textarea').value = '';
  document.getElementById('clipboard-panel').classList.remove('active');
}

function exportToCSV() {
  const gradeData = db[currentDate][currentGrade];
  
  let csvContent = "\ufeff"; // BOM
  csvContent += `검수 일자,${currentDate}\n`;
  csvContent += `학년,반(학과명 포함),담임교사,크롬북 수량,충전함 상태,담임 서명 여부\n`;
  
  gradeData.classes.forEach(cls => {
    let cabinetText = '이상 없음';
    if (cls.chargingCabinet === 'cable_error') cabinetText = '케이블 불량';
    if (cls.chargingCabinet === 'port_error') cabinetText = '충전 단자 입구 불량';
    
    const row = [
      `${cls.grade}학년`,
      `"${cls.deptClass.replace(/"/g, '""')}"`,
      `"${cls.teacherName.replace(/"/g, '""')}"`,
      cls.quantity,
      cabinetText,
      cls.signature ? '서명완료' : '서명누락'
    ];
    csvContent += row.join(",") + "\n";
  });
  
  csvContent += `\n`;
  csvContent += `부서부장 최종 확인 결재,${gradeData.deptHeadName || ''},(${gradeData.deptHeadSign ? '결재완료' : '미결재'})\n`;
  csvContent += `교감 선생님 최종 확인 결재,${gradeData.vicePrincipalName || ''},(${gradeData.vicePrincipalSign ? '결재완료' : '미결재'})\n`;
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `영남공고_크롬북대장_${currentGrade}학년_${currentDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('CSV 내보내기가 완료되었습니다.', 'success');
}

// 8. Visual theme control
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
