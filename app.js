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
        <input id="resourceTitle" value="${escape
