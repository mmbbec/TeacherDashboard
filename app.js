/**
 * Main Client Logic
 */

let state = {
  user: null,
  role: 'student', // 'teacher' or 'student'
  currentView: 'dashboard',
  cache: {}
};

// API Client
async function api(action, method = 'GET', data = {}) {
  const url = new URL(CONFIG.API_URL);
  let options = { method: method };

  if (method === 'GET') {
    url.searchParams.append('action', action);
    for (let k in data) url.searchParams.append(k, data[k]);
  } else {
    options.body = JSON.stringify({ action, ...data });
  }

  try {
    const res = await fetch(url.toString(), options);
    return await res.json();
  } catch (err) {
    console.error('API Error', err);
    return { success: false, error: err.toString() };
  }
}

// Initializer
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkAuth();
});

function setupEventListeners() {
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const view = item.getAttribute('data-view');
      navigate(view);
    });
  });

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('loginUser').value;
    const p = document.getElementById('loginPass').value;
    const res = await api('login', 'POST', { username: u, password: p });
    if (res.success) {
      state.user = res.user;
      state.role = 'teacher';
      document.getElementById('loginOverlay').style.display = 'none';
      updateProfileUI();
      navigate('dashboard');
    } else {
      alert(res.message || 'Login Failed');
    }
  });

  document.getElementById('viewAsStudent').addEventListener('click', (e) => {
    e.preventDefault();
    state.user = { name: 'Student Viewer', role: 'student' };
    state.role = 'student';
    document.getElementById('loginOverlay').style.display = 'none';
    updateProfileUI();
    navigate('dashboard');
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    document.getElementById('loginOverlay').style.display = 'flex';
  });
}

function updateProfileUI() {
  document.getElementById('userBadge').innerText = state.role.toUpperCase();
}

function checkAuth() {
  if (!state.user) {
    document.getElementById('loginOverlay').style.display = 'flex';
  }
}

function navigate(view) {
  state.currentView = view;
  document.getElementById('currentViewTitle').innerText = view.toUpperCase();
  const area = document.getElementById('dynamicContent');
  area.innerHTML = '<p>Loading...</p>';

  switch (view) {
    case 'dashboard': renderDashboard(); break;
    case 'subjects': renderCRUDTable('Subjects', ['code', 'name', 'grade', 'room']); break;
    case 'students': renderCRUDTable('Students', ['roll', 'name', 'grade', 'email', 'phone']); break;
    case 'attendance': renderAttendance(); break;
    case 'timetable': renderCRUDTable('Timetable', ['day', 'subject_id', 'start_time', 'end_time', 'room']); break;
    case 'assignments': renderCRUDTable('Assignments', ['title', 'subject_id', 'due_date', 'max_marks']); break;
    case 'resources': renderCRUDTable('Resources', ['title', 'subject_id', 'type', 'url']); break;
    case 'announcements': renderCRUDTable('Announcements', ['title', 'message', 'date', 'priority']); break;
    case 'whatsapp': renderWhatsApp(); break;
  }
}

// ---------------- DASHBOARD VIEW ----------------
async function renderDashboard() {
  const area = document.getElementById('dynamicContent');
  const res = await api('getDashboardStats');
  if (!res.success) { area.innerHTML = '<p>Failed loading stats.</p>'; return; }

  const s = res.stats;
  area.innerHTML = `
    <div class="grid-stats">
      <div class="stat-card"><h3>Total Students</h3><div class="val">${s.students}</div></div>
      <div class="stat-card"><h3>Subjects</h3><div class="val">${s.subjects}</div></div>
      <div class="stat-card"><h3>Assignments</h3><div class="val">${s.assignments}</div></div>
      <div class="stat-card"><h3>Resources</h3><div class="val">${s.resources}</div></div>
    </div>
    <div class="card-table">
      <div class="table-header"><h3>Recent Announcements</h3></div>
      <div style="padding:1rem;">
        ${res.announcements.map(a => `<div style="margin-bottom:1rem;"><strong>${a.title}</strong> (${a.date})<p>${a.message}</p></div>`).join('') || '<p>No announcements.</p>'}
      </div>
    </div>
  `;
}

// ---------------- GENERIC CRUD TABLE ----------------
async function renderCRUDTable(sheet, fields) {
  const area = document.getElementById('dynamicContent');
  const res = await api('getAll', 'GET', { sheet });
  const data = res.data || [];

  let html = `
    <div class="card-table">
      <div class="table-header">
        <h3>${sheet} Directory</h3>${state.role === 'teacher' ? `<button class="btn btn-sm" onclick="openCreateModal('${sheet}', ${JSON.stringify(fields).replace(/"/g, '&quot;')})"><i class="fa-solid fa-plus"></i> Add New</button>` : ''}
      </div>
      <table>
        <thead>
          <tr>${fields.map(f => `<th>${f.toUpperCase()}</th>`).join('')} ${state.role === 'teacher' ? '<th>ACTIONS</th>' : ''}</tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${fields.map(f => `<td>${row[f] || ''}</td>`).join('')}
              ${state.role === 'teacher' ? `
                <td>
                  <button class="btn btn-sm btn-secondary" onclick='openEditModal("${sheet}", ${JSON.stringify(row)})'><i class="fa-solid fa-pen"></i></button>
                  <button class="btn btn-sm btn-danger" onclick='deleteRecord("${sheet}", "${row.id}")'><i class="fa-solid fa-trash"></i></button>
                </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  area.innerHTML = html;
}

// ---------------- ATTENDANCE MANAGER ----------------
async function renderAttendance() {
  const area = document.getElementById('dynamicContent');
  const [studRes, subRes] = await Promise.all([
    api('getAll', 'GET', { sheet: 'Students' }),
    api('getAll', 'GET', { sheet: 'Subjects' })
  ]);

  const students = studRes.data || [];
  const subjects = subRes.data || [];

  let html = `
    <div class="card-table">
      <div class="table-header">
        <h3>Mark Attendance</h3>
        <input type="date" id="attDate" class="form-control" style="width: auto;" value="${new Date().toISOString().split('T')[0]}" />
        <select id="attSubject" class="form-control" style="width: auto;">
          ${subjects.map(s => `<option value="${s.code}">${s.name} (${s.code})</option>`).join('')}
        </select>
      </div>
      <table>
        <thead>
          <tr><th>Roll</th><th>Student Name</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${students.map(s => `
            <tr>
              <td>${s.roll}</td>
              <td>${s.name}</td>
              <td>
                <select class="form-control att-status-select" data-studentid="${s.id}">
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Late">Late</option>
                </select>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${state.role === 'teacher' ? `<div style="padding: 1rem;"><button class="btn" onclick="saveAttendance()">Save Attendance</button></div>` : ''}
    </div>
  `;
  area.innerHTML = html;
}

async function saveAttendance() {
  const date = document.getElementById('attDate').value;
  const subject_id = document.getElementById('attSubject').value;
  const records = [];

  document.querySelectorAll('.att-status-select').forEach(sel => {
    records.push({
      date,
      subject_id,
      student_id: sel.getAttribute('data-studentid'),
      status: sel.value
    });
  });

  const res = await api('batchAttendance', 'POST', { records });
  if (res.success) alert('Attendance saved successfully!');
}

// ---------------- WHATSAPP CENTER ----------------
async function renderWhatsApp() {
  const area = document.getElementById('dynamicContent');
  const studs = (await api('getAll', 'GET', { sheet: 'Students' })).data || [];

  area.innerHTML = `
    <div class="card-table" style="padding: 1.5rem;">
      <h3>Quick WhatsApp Notification</h3>
      <div class="form-group" style="margin-top:1rem;">
        <label>Select Student Contact</label>
        <select id="waStudent" class="form-control" onchange="document.getElementById('waPhone').value = this.value">
          <option value="">-- Choose Student --</option>
          ${studs.map(s => `<option value="${s.phone}">${s.name} (${s.phone})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Phone Number (with country code, e.g. 919876543210)</label>
        <input type="text" id="waPhone" class="form-control" placeholder="91..." />
      </div>
      <div class="form-group">
        <label>Message Content</label>
        <textarea id="waMsg" class="form-control" rows="3" placeholder="Dear parent/student, reminder about tomorrow's assignment..."></textarea>
      </div>
      <button class="btn" onclick="sendWhatsApp()"><i class="fa-brands fa-whatsapp"></i> Launch WhatsApp Chat</button>
    </div>
  `;
}

function sendWhatsApp() {
  const phone = document.getElementById('waPhone').value.replace(/[^0-9]/g, '');
  const msg = encodeURIComponent(document.getElementById('waMsg').value);
  if (!phone) { alert('Valid phone number required'); return; }
  
  // Log message intent back to the sheet
  api('insert', 'POST', {
    sheet: 'WhatsApp',
    data: { phone, message: document.getElementById('waMsg').value, status: 'Triggered', sent_at: new Date().toISOString() }
  });

  window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${msg}`, '_blank');
}

// ---------------- MODAL / FORM BUILDER ----------------
function openCreateModal(sheet, fields) {
  const container = document.getElementById('modalFormFields');
  document.getElementById('modalTitle').innerText = `New ${sheet} Entry`;
  container.innerHTML = fields.map(f => `
    <div class="form-group">
      <label>${f.toUpperCase()}</label>
      <input type="text" name="${f}" class="form-control" required />
    </div>
  `).join('');

  setupModalSubmit((formData) => {
    api('insert', 'POST', { sheet, data: formData }).then(() => {
      closeModal();
      navigate(state.currentView);
    });
  });
  document.getElementById('crudModal').classList.add('open');
}

function openEditModal(sheet, row) {
  const container = document.getElementById('modalFormFields');
  document.getElementById('modalTitle').innerText = `Edit ${sheet} Record`;
  container.innerHTML = Object.keys(row).filter(k => k !== 'id').map(k => `
    <div class="form-group">
      <label>${k.toUpperCase()}</label>
      <input type="text" name="${k}" value="${row[k] || ''}" class="form-control" required />
    </div>
  `).join('');

  setupModalSubmit((formData) => {
    api('update', 'POST', { sheet, id: row.id, data: formData }).then(() => {
      closeModal();
      navigate(state.currentView);
    });
  });
  document.getElementById('crudModal').classList.add('open');
}

function setupModalSubmit(callback) {
  const form = document.getElementById('modalForm');
  form.onsubmit = (e) => {
    e.preventDefault();
    const data = {};
    new FormData(form).forEach((v, k) => data[k] = v);
    callback(data);
  };
}

function closeModal() {
  document.getElementById('crudModal').classList.remove('open');
}

async function deleteRecord(sheet, id) {
  if (confirm('Delete this record permanently?')) {
    await api('delete', 'POST', { sheet, id });
    navigate(state.currentView);
  }
}
