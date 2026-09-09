// app.js - Main Application

let publicData = null;
let teacherData = null;
let sessionToken = null;
let selectedSubject = null;
let currentTeacherTab = 'overview';
let pendingStudentLoad = false;
let toastTimer = null;

// =====================================================
// API HELPER
// =====================================================

async function callAPI(action, params = {}) {
  const url = new URL(CONFIG.API_URL);
  url.searchParams.append('action', action);
  
  Object.keys(params).forEach(key => {
    if (typeof params[key] === 'object') {
      url.searchParams.append(key, JSON.stringify(params[key]));
    } else {
      url.searchParams.append(key, params[key]);
    }
  });
  
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
    
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, message: error.message || 'Failed to connect to server' };
  }
}

// =====================================================
// INITIAL LOAD
// =====================================================

document.addEventListener('DOMContentLoaded', function() {
  loadPublicDashboard();
});

async function loadPublicDashboard(callback) {
  showLoading(true);
  
  const timeoutId = setTimeout(() => {
    showLoading(false);
    showToast('Loading timed out. Please refresh and try again.');
    if (callback) callback(false);
  }, 8000);
  
  try {
    const data = await callAPI('getPublicDashboard');
    clearTimeout(timeoutId);
    showLoading(false);
    
    if (!data.success) {
      showToast(data.message || 'Unable to load dashboard.');
      if (callback) callback(false);
      return;
    }
    
    publicData = data;
    renderHome(data);
    
    if (pendingStudentLoad) {
      pendingStudentLoad = false;
      renderStudentDashboard();
      showPage('studentPage');
    }
    
    if (callback) callback(true);
    
  } catch (error) {
    clearTimeout(timeoutId);
    showLoading(false);
    showToast(error.message || 'Failed to connect to server.');
    if (callback) callback(false);
  }
}

// =====================================================
// PAGE NAVIGATION
// =====================================================

function showPage(id) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  const page = document.getElementById(id);
  if (page) page.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showHome() { showPage('homePage'); }
function showTeacherLogin() {
  document.getElementById('loginForm').reset();
  showPage('teacherLoginPage');
}

function showStudentDashboard() {
  if (!publicData) {
    pendingStudentLoad = true;
    loadPublicDashboard();
    return;
  }
  renderStudentDashboard();
  showPage('studentPage');
}

// =====================================================
// RENDER FUNCTIONS
// =====================================================

function renderHome(data) {
  const settings = data.settings || {};
  document.getElementById('homeCollegeName').textContent = settings.COLLEGE_NAME || 'YOUR COLLEGE NAME';
  document.getElementById('homeDepartment').textContent = settings.DEPARTMENT || 'Department of Mathematics';
  document.getElementById('homeWelcome').textContent = settings.WELCOME_TEXT || 'Welcome to the Subject Dashboard';
}

function renderStudentDashboard() {
  const settings = publicData.settings || {};
  const teacher = publicData.teacher || {};
  
  document.getElementById('studentCollegeName').textContent = settings.COLLEGE_NAME || 'YOUR COLLEGE NAME';
  document.getElementById('studentDepartment').textContent = settings.DEPARTMENT || 'Department of Mathematics';
  document.getElementById('studentTeacherName').textContent = teacher.name || 'Teacher Name';
  document.getElementById('studentTeacherDesignation').textContent = teacher.designation || '';
  
  const subjects = publicData.subjects || [];
  document.getElementById('studentSubjectCount').textContent = subjects.length;
  document.getElementById('studentSubjectsSection').classList.add('hidden');
}

// =====================================================
// STUDENT SUBJECTS
// =====================================================

function showStudentSubjects() {
  const section = document.getElementById('studentSubjectsSection');
  section.classList.remove('hidden');
  
  const grid = document.getElementById('studentSubjectGrid');
  const subjects = publicData.subjects || [];
  
  if (subjects.length === 0) {
    grid.innerHTML = '<div class="empty-state">No subjects have been added yet.</div>';
    return;
  }
  
  grid.innerHTML = subjects.map(subject => `
    <button class="subject-card" onclick="openStudentSubject('${escapeJs(subject.SUBJECT_CODE)}')">
      <div class="code">${escapeHtml(subject.SUBJECT_CODE)}</div>
      <h3>${escapeHtml(subject.SUBJECT_NAME)}</h3>
      <div class="subject-meta">
        Semester: ${escapeHtml(subject.SEMESTER || '-')}<br>
        Branch: ${escapeHtml(subject.BRANCH || '-')}<br>
        Division: ${escapeHtml(subject.DIVISION || '-')}
      </div>
    </button>
  `).join('');
}

function openStudentSubject(code) {
  const subjects = publicData.subjects || [];
  selectedSubject = subjects.find(s => String(s.SUBJECT_CODE) === String(code));
  
  if (!selectedSubject) {
    showToast('Subject not found.');
    return;
  }
  
  document.getElementById('detailCollegeName').textContent = publicData.settings.COLLEGE_NAME || 'YOUR COLLEGE NAME';
  document.getElementById('detailDepartment').textContent = publicData.settings.DEPARTMENT || 'Department of Mathematics';
  document.getElementById('detailSubjectCode').textContent = selectedSubject.SUBJECT_CODE;
  document.getElementById('detailSubjectName').textContent = selectedSubject.SUBJECT_NAME;
  document.getElementById('detailSubjectInfo').innerHTML = `
    Semester: <strong>${escapeHtml(selectedSubject.SEMESTER || '-')}</strong> &nbsp;|&nbsp;
    Branch: <strong>${escapeHtml(selectedSubject.BRANCH || '-')}</strong> &nbsp;|&nbsp;
    Division: <strong>${escapeHtml(selectedSubject.DIVISION || '-')}</strong>
  `;
  
  document.getElementById('studentContentArea').innerHTML = '<div class="empty-state">Select an option above.</div>';
  showPage('studentSubjectPage');
}

function backToStudentSubjects() { showPage('studentPage'); }

// =====================================================
// STUDENT CONTENT VIEWERS
// =====================================================

function showStudentResources() {
  if (!selectedSubject) return;
  const items = (publicData.resources || []).filter(i => String(i.SUBJECT_CODE) === String(selectedSubject.SUBJECT_CODE));
  renderStudentList('📚 Resources', items, item => `
    <h3>${escapeHtml(item.TITLE)}</h3>
    <p>${escapeHtml(item.TYPE || 'Resource')}</p>
    <p>${escapeHtml(item.DESCRIPTION || '')}</p>
    ${item.URL ? `<a href="${safeUrl(item.URL)}" target="_blank">Open Resource →</a>` : ''}
  `);
}

function showStudentTimetable() {
  if (!selectedSubject) return;
  const items = (publicData.timetable || []).filter(i => String(i.SUBJECT_CODE) === String(selectedSubject.SUBJECT_CODE));
  renderStudentList('📅 Timetable', items, item => `
    <h3>${escapeHtml(item.DAY || '')}</h3>
    <p>${escapeHtml(item.START_TIME || '')} - ${escapeHtml(item.END_TIME || '')}</p>
    <p>Room: ${escapeHtml(item.ROOM || '-')}</p>
  `);
}

function showStudentAssignments() {
  if (!selectedSubject) return;
  const items = (publicData.assignments || []).filter(i => String(i.SUBJECT_CODE) === String(selectedSubject.SUBJECT_CODE));
  renderStudentList('📝 Assignments', items, item => `
    <h3>${escapeHtml(item.TITLE)}</h3>
    <p>${escapeHtml(item.DESCRIPTION || '')}</p>
    <p>Due: <strong>${escapeHtml(item.DUE_DATE || '-')}</strong></p>
    ${item.URL ? `<a href="${safeUrl(item.URL)}" target="_blank">Open Assignment →</a>` : ''}
  `);
}

function showStudentAnnouncements() {
  if (!selectedSubject) return;
  const items = (publicData.announcements || []).filter(i => String(i.SUBJECT_CODE) === String(selectedSubject.SUBJECT_CODE));
  renderStudentList('📢 Announcements', items, item => `
    <h3>${escapeHtml(item.TITLE)}</h3>
    <p>${escapeHtml(item.MESSAGE || '')}</p>
    <p>Date: ${escapeHtml(item.DATE || '-')}</p>
  `);
}

function showStudentAttendance() {
  if (!selectedSubject) return;
  document.getElementById('studentContentArea').innerHTML = `
    <div class="empty-state">Attendance information is available to the teacher management system.</div>
  `;
}

function openStudentWhatsapp() {
  if (!selectedSubject) return;
  const item = (publicData.whatsapp || []).find(i => String(i.SUBJECT_CODE) === String(selectedSubject.SUBJECT_CODE));
  if (!item || !item.GROUP_URL) {
    showToast('WhatsApp group link is not available.');
    return;
  }
  window.open(safeUrl(item.GROUP_URL), '_blank');
}

function renderStudentList(title, items, renderer) {
  const area = document.getElementById('studentContentArea');
  if (!items.length) {
    area.innerHTML = `<div class="empty-state"><h3>${title}</h3><p>No information available yet.</p></div>`;
    return;
  }
  area.innerHTML = `<div class="content-list">${items.map(item => `<div class="content-item">${renderer(item)}</div>`).join('')}</div>`;
}

// =====================================================
// TEACHER LOGIN
// =====================================================

async function handleLogin(event) {
  event.preventDefault();
  
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  showLoading(true);
  
  try {
    const result = await callAPI('teacherLogin', { username, password });
    showLoading(false);
    
    if (!result.success) {
      showToast(result.message || 'Login failed.');
      return;
    }
    
    sessionToken = result.token;
    await loadTeacherDashboard();
    
  } catch (error) {
    showLoading(false);
    showToast(error.message || 'Login failed.');
  }
}

// =====================================================
// TEACHER DASHBOARD
// =====================================================

async function loadTeacherDashboard() {
  showLoading(true);
  
  try {
    const data = await callAPI('getTeacherDashboard', { token: sessionToken });
    showLoading(false);
    
    if (!data.success) {
      showToast('Unable to load teacher dashboard.');
      return;
    }
    
    teacherData = data;
    const teacher = data.teacher.find(t => String(t.TEACHER_ID) === String(data.teacher[0]?.TEACHER_ID || '')) || data.teacher[0] || {};
    
    document.getElementById('teacherWelcome').textContent = 'Welcome, ' + (teacher.NAME || 'Teacher');
    updateTeacherStats();
    showPage('teacherPage');
    openTeacherTab('overview');
    
  } catch (error) {
    showLoading(false);
    showToast(error.message || 'Session expired.');
    sessionToken = null;
    showTeacherLogin();
  }
}

function updateTeacherStats() {
  document.getElementById('teacherSubjectCount').textContent = (teacherData.subjects || []).length;
  document.getElementById('teacherStudentCount').textContent = (teacherData.students || []).length;
  document.getElementById('teacherResourceCount').textContent = (teacherData.resources || []).length;
  document.getElementById('teacherAnnouncementCount').textContent = (teacherData.announcements || []).length;
}

// =====================================================
// TEACHER TABS
// =====================================================

function openTeacherTab(tab, button) {
  currentTeacherTab = tab;
  
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  if (button) button.classList.add('active');
  
  document.querySelectorAll('.admin-tab').forEach(t => {
    if (t.textContent.toLowerCase().includes(tab.toLowerCase())) t.classList.add('active');
  });
  
  const renderers = {
    'overview': renderTeacherOverview,
    'settings': renderSettings,
    'subjects': renderSubjectsManager,
    'students': renderStudentsManager,
    'resources': renderResourcesManager,
    'timetable': renderTimetableManager,
    'assignments': renderAssignmentsManager,
    'announcements': renderAnnouncementsManager,
    'attendance': renderAttendanceManager,
    'whatsapp': renderWhatsappManager,
    'profile': renderProfileManager
  };
  
  if (renderers[tab]) renderers[tab]();
}

// =====================================================
// TEACHER RENDER FUNCTIONS
// =====================================================

function renderTeacherOverview() {
  document.getElementById('teacherContent').innerHTML = `
    <div class="admin-panel">
      <h2>Dashboard Overview</h2>
      <p>Manage your complete subject dashboard from here.</p>
      <div class="overview-note">
        All information is stored in Google Sheets. Resources can be linked from Google Drive.
        Students access the latest information through the same permanent dashboard link.
      </div>
    </div>
  `;
}

function renderSettings() {
  const settings = teacherData.settings[0] || {};
  document.getElementById('teacherContent').innerHTML = `
    <div class="admin-panel">
      <div class="admin-panel-header">
        <div>
          <h2>⚙️ Dashboard Settings</h2>
          <p>Update your public dashboard.</p>
        </div>
      </div>
      <form class="admin-form" onsubmit="saveSettingsForm(event)">
        <div class="form-group">
          <label>College Name</label>
          <input id="settingCollegeName" value="${escapeAttr(settings.COLLEGE_NAME || '')}" required>
        </div>
        <div class="form-group">
          <label>Department</label>
          <input id="settingDepartment" value="${escapeAttr(settings.DEPARTMENT || '')}" required>
        </div>
        <div class="form-group">
          <label>Welcome Text</label>
          <textarea id="settingWelcome">${escapeHtml(settings.WELCOME_TEXT || '')}</textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="save-button">Save Settings</button>
        </div>
      </form>
    </div>
  `;
}

async function saveSettingsForm(event) {
  event.preventDefault();
  const data = {
    collegeName: document.getElementById('settingCollegeName').value,
    department: document.getElementById('settingDepartment').value,
    welcomeText: document.getElementById('settingWelcome').value
  };
  await callServer('saveSettings', data, 'Settings saved.');
}

// =====================================================
// SUBJECT MANAGER
// =====================================================

function renderSubjectsManager() {
  const rows = teacherData.subjects || [];
  document.getElementById('teacherContent').innerHTML = `
    <div class="admin-panel">
      <div class="admin-panel-header">
        <div>
          <h2>📚 Subjects</h2>
          <p>Manage subjects handled by you.</p>
        </div>
        <button class="add-button" onclick="showSubjectForm()">+ Add Subject</button>
      </div>
      ${buildSubjectsTable(rows)}
    </div>
  `;
}

function buildSubjectsTable(rows) {
  if (!rows.length) return '<div class="empty-state">No subjects added.</div>';
  
  return `
    <div class="table-wrapper">
      <table class="admin-table">
        <thead>
          <tr><th>Code</th><th>Subject</th><th>Semester</th><th>Branch</th><th>Division</th><th>Action</th></tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${escapeHtml(row.SUBJECT_CODE)}</td>
              <td>${escapeHtml(row.SUBJECT_NAME)}</td>
              <td>${escapeHtml(row.SEMESTER || '')}</td>
              <td>${escapeHtml(row.BRANCH || '')}</td>
              <td>${escapeHtml(row.DIVISION || '')}</td>
              <td>
                <button class="action-button edit-button" onclick="showSubjectForm('${escapeJs(row.ID)}')">Edit</button>
                <button class="action-button delete-button" onclick="deleteRecord('deleteSubject','${escapeJs(row.ID)}')">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function showSubjectForm(id) {
  const row = (teacherData.subjects || []).find(i => String(i.ID) === String(id)) || {};
  openModal(id ? 'Edit Subject' : 'Add Subject', `
    <form class="admin-form" onsubmit="submitSubjectForm(event, '${escapeJs(id || '')}')">
      <div class="form-grid">
        <div class="form-group">
          <label>Subject Code</label>
          <input id="subjectCode" value="${escapeAttr(row.SUBJECT_CODE || '')}" required>
        </div>
        <div class="form-group">
          <label>Subject Name</label>
          <input id="subjectName" value="${escapeAttr(row.SUBJECT_NAME || '')}" required>
        </div>
        <div class="form-group">
          <label>Semester</label>
          <input id="subjectSemester" value="${escapeAttr(row.SEMESTER || '')}">
        </div>
        <div class="form-group">
          <label>Branch</label>
          <input id="subjectBranch" value="${escapeAttr(row.BRANCH || '')}">
        </div>
        <div class="form-group">
          <label>Division</label>
          <input id="subjectDivision" value="${escapeAttr(row.DIVISION || '')}">
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="subjectDescription">${escapeHtml(row.DESCRIPTION || '')}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-button" onclick="closeModal()">Cancel</button>
        <button type="submit" class="save-button">Save Subject</button>
      </div>
    </form>
  `);
}

async function submitSubjectForm(event, id) {
  event.preventDefault();
  const data = {
    id: id,
    subjectCode: document.getElementById('subjectCode').value,
    subjectName: document.getElementById('subjectName').value,
    semester: document.getElementById('subjectSemester').value,
    branch: document.getElementById('subjectBranch').value,
    division: document.getElementById('subjectDivision').value,
    description: document.getElementById('subjectDescription').value
  };
  await saveTeacherRecord('saveSubject', data, 'Subject saved.');
}

// =====================================================
// STUDENT MANAGER
// =====================================================

function renderStudentsManager() {
  const rows = teacherData.students || [];
  document.getElementById('teacherContent').innerHTML = `
    <div class="admin-panel">
      <div class="admin-panel-header">
        <div>
          <h2>👨‍🎓 Students</h2>
          <p>Manage student records.</p>
        </div>
        <button class="add-button" onclick="showStudentForm()">+ Add Student</button>
      </div>
      ${buildStudentsTable(rows)}
    </div>
  `;
}

function buildStudentsTable(rows) {
  if (!rows.length) return '<div class="empty-state">No students added.</div>';
  
  return `
    <div class="table-wrapper">
      <table class="admin-table">
        <thead>
          <tr><th>Student ID</th><th>Name</th><th>Branch</th><th>Sem</th><th>Div</th><th>Action</th></tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${escapeHtml(row.STUDENT_ID)}</td>
              <td>${escapeHtml(row.NAME)}</td>
              <td>${escapeHtml(row.BRANCH || '')}</td>
              <td>${escapeHtml(row.SEMESTER || '')}</td>
              <td>${escapeHtml(row.DIVISION || '')}</td>
              <td>
                <button class="action-button edit-button" onclick="showStudentForm('${escapeJs(row.ID)}')">Edit</button>
                <button class="action-button delete-button" onclick="deleteRecord('deleteStudent','${escapeJs(row.ID)}')">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function showStudentForm(id) {
  const row = (teacherData.students || []).find(i => String(i.ID) === String(id)) || {};
  openModal(id ? 'Edit Student' : 'Add Student', `
    <form class="admin-form" onsubmit="submitStudentForm(event, '${escapeJs(id || '')}')">
      <div class="form-grid">
        <div class="form-group">
          <label>Student ID</label>
          <input id="studentId" value="${escapeAttr(row.STUDENT_ID || '')}" required>
        </div>
        <div class="form-group">
          <label>Student Name</label>
          <input id="studentName" value="${escapeAttr(row.NAME || '')}" required>
        </div>
        <div class="form-group">
          <label>Branch</label>
          <input id="studentBranch" value="${escapeAttr(row.BRANCH || '')}">
        </div>
        <div class="form-group">
          <label>Semester</label>
          <input id="studentSemester" value="${escapeAttr(row.SEMESTER || '')}">
        </div>
        <div class="form-group">
          <label>Division</label>
          <input id="studentDivision" value="${escapeAttr(row.DIVISION || '')}">
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-button" onclick="closeModal()">Cancel</button>
        <button type="submit" class="save-button">Save Student</button>
      </div>
    </form>
  `);
}

async function submitStudentForm(event, id) {
  event.preventDefault();
  const data = {
    id: id,
    studentId: document.getElementById('studentId').value,
    name: document.getElementById('studentName').value,
    branch: document.getElementById('studentBranch').value,
    semester: document.getElementById('studentSemester').value,
    division: document.getElementById('studentDivision').value
  };
  await saveTeacherRecord('saveStudent', data, 'Student saved.');
}

// =====================================================
// RESOURCE MANAGER
// =====================================================

function renderResourcesManager() {
  const rows = teacherData.resources || [];
  document.getElementById('teacherContent').innerHTML = `
    <div class="admin-panel">
      <div class="admin-panel-header">
        <div>
          <h2>📄 Resources</h2>
          <p>Add PDF, notes and other resource links.</p>
        </div>
        <button class="add-button" onclick="showResourceForm()">+ Add Resource</button>
      </div>
      ${buildGenericTable(rows, [
        ['SUBJECT_CODE', 'Subject'],
        ['TITLE', 'Title'],
        ['TYPE', 'Type'],
        ['URL', 'Link']
      ], 'showResourceForm', 'deleteResource')}
    </div>
  `;
}

function showResourceForm(id) {
  const row = (teacherData.resources || []).find(i => String(i.ID) === String(id)) || {};
  openModal(id ? 'Edit Resource' : 'Add Resource', `
    <form class="admin-form" onsubmit="submitResourceForm(event, '${escapeJs(id || '')}')">
      <div class="form-group">
        <label>Subject Code</label>
        <select id="resourceSubject" required>
          <option value="">Select Subject</option>
          ${buildSubjectOptions(row.SUBJECT_CODE)}
        </select>
      </div>
      <div class="form-group">
        <label>Title</label>
        <input id="resourceTitle" value="${escapeAttr(row.TITLE || '')}" required>
      </div>
      <div class="form-group">
        <label>Type</label>
        <select id="resourceType">
          <option ${row.TYPE === 'PDF' ? 'selected' : ''}>PDF</option>
          <option ${row.TYPE === 'Notes' ? 'selected' : ''}>Notes</option>
          <option ${row.TYPE === 'Video' ? 'selected' : ''}>Video</option>
          <option ${row.TYPE === 'Link' ? 'selected' : ''}>Link</option>
          <option ${row.TYPE === 'Other' ? 'selected' : ''}>Other</option>
        </select>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="resourceDescription">${escapeHtml(row.DESCRIPTION || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Google Drive / Resource URL</label>
        <input id="resourceUrl" type="url" value="${escapeAttr(row.URL || '')}" placeholder="https://drive.google.com/...">
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-button" onclick="closeModal()">Cancel</button>
        <button type="submit" class="save-button">Save Resource</button>
      </div>
    </form>
  `);
}

async function submitResourceForm(event, id) {
  event.preventDefault();
  const data = {
    id: id,
    subjectCode: document.getElementById('resourceSubject').value,
    title: document.getElementById('resourceTitle').value,
    type: document.getElementById('resourceType').value,
    description: document.getElementById('resourceDescription').value,
    url: document.getElementById('resourceUrl').value
  };
  await saveTeacherRecord('saveResource', data, 'Resource saved.');
}

// =====================================================
// TIMETABLE MANAGER
// =====================================================

function renderTimetableManager() {
  const rows = teacherData.timetable || [];
  document.getElementById('teacherContent').innerHTML = `
    <div class="admin-panel">
      <div class="admin-panel-header">
        <div><h2>📅 Timetable</h2></div>
        <button class="add-button" onclick="showTimetableForm()">+ Add Timetable</button>
      </div>
      ${buildGenericTable(rows, [
        ['SUBJECT_CODE', 'Subject'],
        ['DAY', 'Day'],
        ['START_TIME', 'Start'],
        ['END_TIME', 'End'],
        ['ROOM', 'Room']
      ], 'showTimetableForm', 'deleteTimetable')}
    </div>
  `;
}

function showTimetableForm(id) {
  const row = (teacherData.timetable || []).find(i => String(i.ID) === String(id)) || {};
  openModal(id ? 'Edit Timetable' : 'Add Timetable', `
    <form class="admin-form" onsubmit="submitTimetableForm(event, '${escapeJs(id || '')}')">
      <div class="form-group">
        <label>Subject</label>
        <select id="timetableSubject" required>
          <option value="">Select Subject</option>
          ${buildSubjectOptions(row.SUBJECT_CODE)}
        </select>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Day</label>
          <select id="timetableDay">
            ${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(day => `
              <option ${row.DAY === day ? 'selected' : ''}>${day}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Room</label>
          <input id="timetableRoom" value="${escapeAttr(row.ROOM || '')}">
        </div>
        <div class="form-group">
          <label>Start Time</label>
          <input id="timetableStart" type="time" value="${escapeAttr(row.START_TIME || '')}">
        </div>
        <div class="form-group">
          <label>End Time</label>
          <input id="timetableEnd" type="time" value="${escapeAttr(row.END_TIME || '')}">
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-button" onclick="closeModal()">Cancel</button>
        <button type="submit" class="save-button">Save</button>
      </div>
    </form>
  `);
}

async function submitTimetableForm(event, id) {
  event.preventDefault();
  const data = {
    id: id,
    subjectCode: document.getElementById('timetableSubject').value,
    day: document.getElementById('timetableDay').value,
    startTime: document.getElementById('timetableStart').value,
    endTime: document.getElementById('timetableEnd').value,
    room: document.getElementById('timetableRoom').value
  };
  await saveTeacherRecord('saveTimetable', data, 'Timetable saved.');
}

// =====================================================
// ASSIGNMENTS MANAGER
// =====================================================

function renderAssignmentsManager() {
  const rows = teacherData.assignments || [];
  document.getElementById('teacherContent').innerHTML = `
    <div class="admin-panel">
      <div class="admin-panel-header">
        <div><h2>📝 Assignments</h2></div>
        <button class="add-button" onclick="showAssignmentForm()">+ Add Assignment</button>
      </div>
      ${buildGenericTable(rows, [
        ['SUBJECT_CODE', 'Subject'],
        ['TITLE', 'Title'],
        ['DUE_DATE', 'Due Date'],
        ['URL', 'Link']
      ], 'showAssignmentForm', 'deleteAssignment')}
    </div>
  `;
}

function showAssignmentForm(id) {
  const row = (teacherData.assignments || []).find(i => String(i.ID) === String(id)) || {};
  openModal(id ? 'Edit Assignment' : 'Add Assignment', `
    <form class="admin-form" onsubmit="submitAssignmentForm(event, '${escapeJs(id || '')}')">
      <div class="form-group">
        <label>Subject</label>
        <select id="assignmentSubject" required>
          <option value="">Select Subject</option>
          ${buildSubjectOptions(row.SUBJECT_CODE)}
        </select>
      </div>
      <div class="form-group">
        <label>Title</label>
        <input id="assignmentTitle" value="${escapeAttr(row.TITLE || '')}" required>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="assignmentDescription">${escapeHtml(row.DESCRIPTION || '')}</textarea>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Due Date</label>
          <input id="assignmentDueDate" type="date" value="${escapeAttr(row.DUE_DATE || '')}">
        </div>
        <div class="form-group">
          <label>Link</label>
          <input id="assignmentUrl" type="url" value="${escapeAttr(row.URL || '')}">
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-button" onclick="closeModal()">Cancel</button>
        <button type="submit" class="save-button">Save</button>
      </div>
    </form>
  `);
}

async function submitAssignmentForm(event, id) {
  event.preventDefault();
  const data = {
    id: id,
    subjectCode: document.getElementById('assignmentSubject').value,
    title: document.getElementById('assignmentTitle').value,
    description: document.getElementById('assignmentDescription').value,
    dueDate: document.getElementById('assignmentDueDate').value,
    url: document.getElementById('assignmentUrl').value
  };
  await saveTeacherRecord('saveAssignment', data, 'Assignment saved.');
}

// =====================================================
// ANNOUNCEMENTS MANAGER
// =====================================================

function renderAnnouncementsManager() {
  const rows = teacherData.announcements || [];
  document.getElementById('teacherContent').innerHTML = `
    <div class="admin-panel">
      <div class="admin-panel-header">
        <div><h2>📢 Announcements</h2></div>
        <button class="add-button" onclick="showAnnouncementForm()">+ Add Announcement</button>
      </div>
      ${buildGenericTable(rows, [
        ['SUBJECT_CODE', 'Subject'],
        ['TITLE', 'Title'],
        ['DATE', 'Date']
      ], 'showAnnouncementForm', 'deleteAnnouncement')}
    </div>
  `;
}

function showAnnouncementForm(id) {
  const row = (teacherData.announcements || []).find(i => String(i.ID) === String(id)) || {};
  openModal(id ? 'Edit Announcement' : 'Add Announcement', `
    <form class="admin-form" onsubmit="submitAnnouncementForm(event, '${escapeJs(id || '')}')">
      <div class="form-group">
        <label>Subject</label>
        <select id="announcementSubject" required>
          <option value="">Select Subject</option>
          ${buildSubjectOptions(row.SUBJECT_CODE)}
        </select>
      </div>
      <div class="form-group">
        <label>Title</label>
        <input id="announcementTitle" value="${escapeAttr(row.TITLE || '')}" required>
      </div>
      <div class="form-group">
        <label>Message</label>
        <textarea id="announcementMessage" required>${escapeHtml(row.MESSAGE || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Date</label>
        <input id="announcementDate" type="date" value="${escapeAttr(row.DATE || new Date().toISOString().slice(0,10))}">
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-button" onclick="closeModal()">Cancel</button>
        <button type="submit" class="save-button">Save</button>
      </div>
    </form>
  `);
}

async function submitAnnouncementForm(event, id) {
  event.preventDefault();
  const data = {
    id: id,
    subjectCode: document.getElementById('announcementSubject').value,
    title: document.getElementById('announcementTitle').value,
    message: document.getElementById('announcementMessage').value,
    date: document.getElementById('announcementDate').value
  };
  await saveTeacherRecord('saveAnnouncement', data, 'Announcement saved.');
}

// =====================================================
// WHATSAPP MANAGER
// =====================================================

function renderWhatsappManager() {
  const rows = teacherData.whatsapp || [];
  document.getElementById('teacherContent').innerHTML = `
    <div class="admin-panel">
      <div class="admin-panel-header">
        <div>
          <h2>💬 WhatsApp Groups</h2>
          <p>Add the WhatsApp group for each subject.</p>
        </div>
        <button class="add-button" onclick="showWhatsappForm()">+ Add Group</button>
      </div>
      ${buildGenericTable(rows, [
        ['SUBJECT_CODE', 'Subject'],
        ['GROUP_NAME', 'Group Name'],
        ['GROUP_URL', 'Link']
      ], 'showWhatsappForm', 'deleteWhatsapp')}
    </div>
  `;
}

function showWhatsappForm(id) {
  const row = (teacherData.whatsapp || []).find(i => String(i.ID) === String(id)) || {};
  openModal(id ? 'Edit WhatsApp Group' : 'Add WhatsApp Group', `
    <form class="admin-form" onsubmit="submitWhatsappForm(event, '${escapeJs(id || '')}')">
      <div class="form-group">
        <label>Subject</label>
        <select id="whatsappSubject" required>
          <option value="">Select Subject</option>
          ${buildSubjectOptions(row.SUBJECT_CODE)}
        </select>
      </div>
      <div class="form-group">
        <label>Group Name</label>
        <input id="whatsappGroupName" value="${escapeAttr(row.GROUP_NAME || '')}" placeholder="22MAT201 CSE-A">
      </div>
      <div class="form-group">
        <label>WhatsApp Group Invite Link</label>
        <input id="whatsappGroupUrl" type="url" value="${escapeAttr(row.GROUP_URL || '')}" placeholder="https://chat.whatsapp.com/..." required>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-button" onclick="closeModal()">Cancel</button>
        <button type="submit" class="save-button">Save</button>
      </div>
    </form>
  `);
}

async function submitWhatsappForm(event, id) {
  event.preventDefault();
  const data = {
    id: id,
    subjectCode: document.getElementById('whatsappSubject').value,
    groupName: document.getElementById('whatsappGroupName').value,
    groupUrl: document.getElementById('whatsappGroupUrl').value
  };
  await saveTeacherRecord('saveWhatsapp', data, 'WhatsApp group saved.');
}

// =====================================================
// ATTENDANCE MANAGER
// =====================================================

function renderAttendanceManager() {
  const subjects = teacherData.subjects || [];
  document.getElementById('teacherContent').innerHTML = `
    <div class="admin-panel">
      <div class="admin-panel-header">
        <div>
          <h2>📊 Attendance</h2>
          <p>Select a subject and date.</p>
        </div>
      </div>
      <div class="admin-form">
        <div class="form-grid">
          <div class="form-group">
            <label>Subject</label>
            <select id="attendanceSubject" onchange="loadAttendanceGrid()">
              <option value="">Select Subject</option>
              ${subjects.map(subject => `
                <option value="${escapeAttr(subject.SUBJECT_CODE)}">
                  ${escapeHtml(subject.SUBJECT_CODE + ' - ' + subject.SUBJECT_NAME)}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Date</label>
            <input id="attendanceDate" type="date" value="${new Date().toISOString().slice(0,10)}" onchange="loadAttendanceGrid()">
          </div>
        </div>
      </div>
      <div id="attendanceGridArea" style="margin-top:20px;"></div>
    </div>
  `;
}

function loadAttendanceGrid() {
  const subjectCode = document.getElementById('attendanceSubject').value;
  const date = document.getElementById('attendanceDate').value;
  
  if (!subjectCode || !date) {
    document.getElementById('attendanceGridArea').innerHTML = '';
    return;
  }
  
  const subject = teacherData.subjects.find(i => String(i.SUBJECT_CODE) === String(subjectCode));
  if (!subject) {
    document.getElementById('attendanceGridArea').innerHTML = '<div class="empty-state">Subject not found. Please select a valid subject.</div>';
    return;
  }
  
  const students = (teacherData.students || []).filter(student => {
    return String(student.BRANCH || '') === String(subject.BRANCH || '') &&
           String(student.SEMESTER || '') === String(subject.SEMESTER || '') &&
           String(student.DIVISION || '') === String(subject.DIVISION || '') &&
           String(student.ACTIVE).toUpperCase() !== 'NO';
  });
  
  if (!students.length) {
    document.getElementById('attendanceGridArea').innerHTML = '<div class="empty-state">No students found for this subject/class.</div>';
    return;
  }
  
  const existing = (teacherData.attendance || []).filter(record => {
    return String(record.SUBJECT_CODE) === String(subjectCode) && String(record.DATE) === String(date);
  });
  
  const statusMap = {};
  existing.forEach(record => { statusMap[record.STUDENT_ID] = record.STATUS || 'P'; });
  
  document.getElementById('attendanceGridArea').innerHTML = `
    <div class="table-wrapper">
      <table class="admin-table">
        <thead><tr><th>Student ID</th><th>Name</th><th>Status</th></tr></thead>
        <tbody>
          ${students.map(student => {
            const status = statusMap[student.STUDENT_ID] || 'P';
            return `
              <tr>
                <td>${escapeHtml(student.STUDENT_ID)}</td>
                <td>${escapeHtml(student.NAME)}</td>
                <td>
                  <select data-student-id="${escapeAttr(student.STUDENT_ID)}" class="attendance-status">
                    <option value="P" ${status === 'P' ? 'selected' : ''}>Present</option>
                    <option value="A" ${status === 'A' ? 'selected' : ''}>Absent</option>
                    <option value="OD" ${status === 'OD' ? 'selected' : ''}>OD</option>
                    <option value="L" ${status === 'L' ? 'selected' : ''}>Leave</option>
                  </select>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:20px;text-align:right;">
      <button class="save-button" onclick="submitAttendance()">💾 Submit Attendance</button>
    </div>
  `;
}

async function submitAttendance() {
  const subjectCode = document.getElementById('attendanceSubject').value;
  const date = document.getElementById('attendanceDate').value;
  const selects = document.querySelectorAll('.attendance-status');
  
  const records = [];
  selects.forEach(select => {
    records.push({
      subjectCode: subjectCode,
      date: date,
      studentId: select.dataset.studentId,
      status: select.value
    });
  });
  
  showLoading(true);
  try {
    const result = await callAPI('saveAttendanceBatch', {
      token: sessionToken,
      data: { records: records }
    });
    showLoading(false);
    showToast(result.message || 'Attendance submitted.');
    await refreshTeacherData();
  } catch (error) {
    showLoading(false);
    showToast(error.message || 'Unable to save attendance.');
  }
}

// =====================================================
// PROFILE MANAGER
// =====================================================

function renderProfileManager() {
  const teacher = teacherData.teacher[0] || {};
  document.getElementById('teacherContent').innerHTML = `
    <div class="admin-panel">
      <h2>👤 Teacher Profile</h2>
      <form class="admin-form" onsubmit="submitProfileForm(event)">
        <div class="form-group">
          <label>Name</label>
          <input id="profileName" value="${escapeAttr(teacher.NAME || '')}" required>
        </div>
        <div class="form-group">
          <label>Designation</label>
          <input id="profileDesignation" value="${escapeAttr(teacher.DESIGNATION || '')}">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input id="profileEmail" type="email" value="${escapeAttr(teacher.EMAIL || '')}">
        </div>
        <div class="form-group">
          <label>Username</label>
          <input id="profileUsername" value="${escapeAttr(teacher.USERNAME || '')}" required>
        </div>
        <div class="form-group">
          <label>New Password</label>
          <input id="profilePassword" type="password" placeholder="Leave blank to keep current password">
        </div>
        <div class="form-actions">
          <button type="submit" class="save-button">Update Profile</button>
        </div>
      </form>
    </div>
  `;
}

async function submitProfileForm(event) {
  event.preventDefault();
  const data = {
    name: document.getElementById('profileName').value,
    designation: document.getElementById('profileDesignation').value,
    email: document.getElementById('profileEmail').value,
    username: document.getElementById('profileUsername').value,
    newPassword: document.getElementById('profilePassword').value
  };
  
  showLoading(true);
  try {
    const result = await callAPI('saveTeacherProfile', {
      token: sessionToken,
      data: data
    });
    showLoading(false);
    showToast(result.message || 'Profile updated.');
    await refreshTeacherData();
  } catch (error) {
    showLoading(false);
    showToast(error.message || 'Unable to update profile.');
  }
}

// =====================================================
// GENERIC HELPERS
// =====================================================

function buildGenericTable(rows, columns, editFunction, deleteFunction) {
  if (!rows.length) return '<div class="empty-state">No records found.</div>';
  
  return `
    <div class="table-wrapper">
      <table class="admin-table">
        <thead>
          <tr>
            ${columns.map(col => `<th>${escapeHtml(col[1])}</th>`).join('')}
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${columns.map(col => {
                let value = row[col[0]] || '';
                if (col[0] === 'URL' || col[0] === 'GROUP_URL') {
                  value = value ? `<a href="${safeUrl(value)}" target="_blank">Open</a>` : '';
                }
                return `<td>${value}</td>`;
              }).join('')}
              <td>
                <button class="action-button edit-button" onclick="${editFunction}('${escapeJs(row.ID)}')">Edit</button>
                <button class="action-button delete-button" onclick="deleteRecord('${deleteFunction}','${escapeJs(row.ID)}')">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function buildSubjectOptions(selected) {
  return (teacherData.subjects || []).map(subject => `
    <option value="${escapeAttr(subject.SUBJECT_CODE)}" ${String(selected || '') === String(subject.SUBJECT_CODE) ? 'selected' : ''}>
      ${escapeHtml(subject.SUBJECT_CODE + ' - ' + subject.SUBJECT_NAME)}
    </option>
  `).join('');
}

// =====================================================
// SERVER OPERATIONS
// =====================================================

async function saveTeacherRecord(functionName, data, message) {
  showLoading(true);
  try {
    const result = await callAPI(functionName, { token: sessionToken, data: data });
    showLoading(false);
    closeModal();
    showToast(result.message || message);
    await refreshTeacherData();
  } catch (error) {
    showLoading(false);
    showToast(error.message || 'Unable to save record.');
  }
}

async function deleteRecord(functionName, id) {
  if (!confirm('Are you sure you want to delete this record?')) return;
  showLoading(true);
  try {
    const result = await callAPI(functionName, { token: sessionToken, id: id });
    showLoading(false);
    showToast(result.message || 'Record deleted.');
    await refreshTeacherData();
  } catch (error) {
    showLoading(false);
    showToast(error.message || 'Unable to delete record.');
  }
}

async function refreshTeacherData() {
  try {
    const data = await callAPI('getTeacherDashboard', { token: sessionToken });
    teacherData = data;
    updateTeacherStats();
    openTeacherTab(currentTeacherTab);
  } catch (error) {
    showToast(error.message || 'Session expired.');
    sessionToken = null;
    showTeacherLogin();
  }
}

// =====================================================
// LOGOUT
// =====================================================

async function logoutTeacher() {
  if (!sessionToken) { showHome(); return; }
  try {
    await callAPI('teacherLogout', { token: sessionToken });
    sessionToken = null;
    teacherData = null;
    showHome();
  } catch (error) {
    sessionToken = null;
    teacherData = null;
    showHome();
  }
}

// =====================================================
// MODAL
// =====================================================

function openModal(title, body) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

// =====================================================
// LOADING & TOAST
// =====================================================

function showLoading(show) {
  const element = document.getElementById('loadingScreen');
  if (!element) return;
  element.style.display = show ? 'flex' : 'none';
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message || '';
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// =====================================================
// SECURITY HELPERS
// =====================================================

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeJs(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function safeUrl(url) {
  const value = String(url || '').trim();
  if (value.startsWith('https://') || value.startsWith('http://')) {
    return escapeAttr(value);
  }
  return '#';
}
async function callAPI(action, params = {}) {
  const url = new URL(CONFIG.API_URL);
  url.searchParams.append('action', action);
  
  Object.keys(params).forEach(key => {
    if (typeof params[key] === 'object') {
      url.searchParams.append(key, JSON.stringify(params[key]));
    } else {
      url.searchParams.append(key, params[key]);
    }
  });
  
  try {
    // Add timeout and credentials
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      mode: 'cors',  // Explicitly set CORS mode
      credentials: 'omit',  // Don't send cookies
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
    
  } catch (error) {
    console.error('API Error:', error);
    return {
      success: false,
      message: error.message || 'Failed to connect to server'
    };
  }
}
