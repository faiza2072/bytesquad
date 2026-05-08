
/* ═══════════════════════════════════════════════════════════
   REIMS — School Admin Portal JS
═══════════════════════════════════════════════════════════ */

const API = 'http://127.0.0.1:5000/api';
let SESSION = null;
let STUDENTS = [];

// ── Auth guard ──────────────────────────────────────────
function initAuth() {
  const raw = sessionStorage.getItem('reims_user');
  if (!raw) { window.location.href = 'login.html'; return false; }
  SESSION = JSON.parse(raw);
  if (SESSION.role !== 'school') { window.location.href = 'login.html'; return false; }
  document.getElementById('schoolName').textContent = SESSION.name;
  return true;
}

// ── Toast ───────────────────────────────────────────────
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ── API helpers ─────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts);
  return res.json();
}

// ── Navigation ──────────────────────────────────────────
function navigate(tabId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`section-${tabId}`).classList.add('active');
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

  if (tabId === 'overview')     loadOverview();
  if (tabId === 'students')     renderStudentsTable();
  if (tabId === 'attendance')   loadAttendanceForm();
  if (tabId === 'dropouts')     loadDropouts();
  if (tabId === 'uploads')      loadUploads();
  if (tabId === 'analytics')    loadAnalytics();
}

// ══════════════════════════════════════════════════════════
// OVERVIEW
// ══════════════════════════════════════════════════════════
async function loadOverview() {
  try {
    const [info, analytics] = await Promise.all([
      api(`/school/info/${SESSION.school_id}`),
      api(`/school/analytics/${SESSION.school_id}`)
    ]);

    document.getElementById('kpi-total').textContent    = analytics.total_students;
    document.getElementById('kpi-dropouts').textContent = analytics.total_dropouts;
    document.getElementById('kpi-uploads').textContent  = analytics.total_uploads;

    const avgAtt = analytics.attendance_summary.length
      ? Math.round(analytics.attendance_summary.reduce((a, s) => a + s.percentage, 0) / analytics.attendance_summary.length)
      : 0;
    document.getElementById('kpi-attendance').textContent = avgAtt + '%';

    document.getElementById('info-name').textContent     = info.school_name;
    document.getElementById('info-id').textContent       = info.school_id;
    document.getElementById('info-region').textContent   = info.region;
    document.getElementById('info-students').textContent = info.students;
    document.getElementById('info-teachers').textContent = info.teacher_count;
    document.getElementById('info-infra').textContent    = info.infrastructure_score + '/100';
    document.getElementById('info-internet').textContent = info.internet_access ? '✅ Yes' : '❌ No';
    document.getElementById('info-funding').textContent  = info.funding_status.charAt(0).toUpperCase() + info.funding_status.slice(1);
  } catch (e) {
    toast('Could not load overview data', 'error');
  }
}

// ══════════════════════════════════════════════════════════
// STUDENTS
// ══════════════════════════════════════════════════════════
async function fetchStudents() {
  try {
    STUDENTS = await api(`/school/students/${SESSION.school_id}`);
  } catch (e) { STUDENTS = []; }
}

function renderStudentsTable() {
  const search = (document.getElementById('searchStudent').value || '').toLowerCase();
  const cls    = document.getElementById('filterClass').value;
  const status = document.getElementById('filterStatus').value;

  let filtered = STUDENTS.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search) || s.roll_number.includes(search);
    const matchClass  = !cls    || s.class === cls;
    const matchStatus = !status || (status === 'dropout' ? s.dropout_status : !s.dropout_status);
    return matchSearch && matchClass && matchStatus;
  });

  // Populate class filter
  const classFilter = document.getElementById('filterClass');
  if (classFilter.options.length === 1) {
    const classes = [...new Set(STUDENTS.map(s => s.class))].sort();
    classes.forEach(c => {
      const opt = document.createElement('option'); opt.value = c; opt.textContent = `Class ${c}`;
      classFilter.appendChild(opt);
    });
  }

  document.getElementById('studentsTableBody').innerHTML = filtered.length
    ? filtered.map(s => `
      <tr>
        <td><b>${s.roll_number}</b></td>
        <td>${s.name}</td>
        <td>${s.class}</td>
        <td>${s.section}</td>
        <td>${s.gender}</td>
        <td>${s.guardian_name}</td>
        <td>${s.guardian_contact}</td>
        <td><span class="badge ${s.dropout_status ? 'badge-dropout' : 'badge-active'}">${s.dropout_status ? 'Dropout' : 'Active'}</span></td>
      </tr>`).join('')
    : `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px">No students found</td></tr>`;
}

// ══════════════════════════════════════════════════════════
// ADD STUDENT
// ══════════════════════════════════════════════════════════
document.getElementById('addStudentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  data.school_id = SESSION.school_id;
  data.age = parseInt(data.age);

  try {
    const res = await api('/school/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.success) {
      toast(`Student added! ID: ${res.student_id}`, 'success');
      e.target.reset();
      await fetchStudents();
      populateDropoutSelect();
    }
  } catch (err) {
    toast('Failed to add student', 'error');
  }
});

// ══════════════════════════════════════════════════════════
// ATTENDANCE
// ══════════════════════════════════════════════════════════
function loadAttendanceForm() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('attendanceDate').value = today;
  renderAttendanceForm();
}

function renderAttendanceForm() {
  const active = STUDENTS.filter(s => !s.dropout_status);
  document.getElementById('attendanceTableBody').innerHTML = active.map(s => `
    <tr>
      <td><b>${s.roll_number}</b></td>
      <td>${s.name}</td>
      <td>${s.class} - ${s.section}</td>
      <td>
        <select name="status_${s.student_id}">
          <option value="Present">✅ Present</option>
          <option value="Absent">❌ Absent</option>
          <option value="Late">🕐 Late</option>
          <option value="Excused">📋 Excused</option>
        </select>
      </td>
    </tr>`).join('');
}

document.getElementById('attendanceForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const date = document.getElementById('attendanceDate').value;
  if (!date) { toast('Please select a date', 'error'); return; }

  const active = STUDENTS.filter(s => !s.dropout_status);
  const records = active.map(s => ({
    student_id: s.student_id,
    status: e.target[`status_${s.student_id}`]?.value || 'Present'
  }));

  try {
    const res = await api('/school/attendance/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, records })
    });
    if (res.success) {
      toast('Attendance saved!', 'success');
      await fetchStudents();
    }
  } catch (err) {
    toast('Failed to save attendance', 'error');
  }
});

// ══════════════════════════════════════════════════════════
// DROPOUTS
// ══════════════════════════════════════════════════════════
function populateDropoutSelect() {
  const sel = document.getElementById('dropoutStudentSelect');
  const active = STUDENTS.filter(s => !s.dropout_status);
  sel.innerHTML = '<option value="">Choose student...</option>' +
    active.map(s => `<option value="${s.student_id}">${s.roll_number} — ${s.name}</option>`).join('');

  // Also populate upload student select
  const uploadSel = document.querySelector('[name="student_id"]');
  if (uploadSel) {
    uploadSel.innerHTML = '<option value="">None (General upload)</option>' +
      STUDENTS.map(s => `<option value="${s.student_id}">${s.roll_number} — ${s.name}</option>`).join('');
  }
}

function loadDropouts() {
  populateDropoutSelect();
  const dropouts = STUDENTS.filter(s => s.dropout_status);
  document.getElementById('dropoutTableBody').innerHTML = dropouts.length
    ? dropouts.map(s => `
      <tr>
        <td><b>${s.roll_number}</b></td>
        <td>${s.name}</td>
        <td>${s.class}</td>
        <td style="color:var(--red)">${s.dropout_date || '—'}</td>
        <td><span class="badge badge-dropout">${s.dropout_reason || '—'}</span></td>
      </tr>`).join('')
    : `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">No dropouts recorded</td></tr>`;
}

document.getElementById('dropoutForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());

  try {
    const res = await api(`/school/dropout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.success) {
      toast('Dropout recorded', 'success');
      e.target.reset();
      await fetchStudents();
      loadDropouts();
    }
  } catch (err) {
    toast('Failed to record dropout', 'error');
  }
});

// ══════════════════════════════════════════════════════════
// UPLOADS
// ══════════════════════════════════════════════════════════
const uploadZone = document.getElementById('uploadZone');
const fileInput  = document.getElementById('fileInput');

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) {
    fileInput.files = e.dataTransfer.files;
    uploadZone.querySelector('.upload-zone-text').textContent = e.dataTransfer.files[0].name;
  }
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) uploadZone.querySelector('.upload-zone-text').textContent = fileInput.files[0].name;
});

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!fileInput.files[0]) { toast('Please select an image', 'error'); return; }

  const fd = new FormData(e.target);
  fd.append('school_id', SESSION.school_id);

  try {
    const res = await fetch(`${API}/school/upload`, { method: 'POST', body: fd });
    const data = await res.json();
    if (data.success) {
      toast('Image uploaded!', 'success');
      e.target.reset();
      uploadZone.querySelector('.upload-zone-text').textContent = 'Click or drag image here';
      loadUploads();
    } else {
      toast(data.error || 'Upload failed', 'error');
    }
  } catch (err) {
    toast('Upload failed', 'error');
  }
});

async function loadUploads() {
  try {
    const uploads = await api(`/school/uploads/${SESSION.school_id}`);
    const typeIcons = { attendance_photo: '📸', register_book: '📖', event_photo: '🎉' };
    document.getElementById('uploadGrid').innerHTML = uploads.length
      ? uploads.map(u => `
        <div class="upload-card" onclick="openSchoolLightbox('${u.upload_id}')" style="cursor:pointer">
          <div style="width:100%;height:140px;overflow:hidden;border-radius:8px;background:#f0f4ff;margin-bottom:10px;display:flex;align-items:center;justify-content:center;">
            <img src="${u.image_url}" alt="${u.description||'photo'}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"
              onerror="this.parentElement.innerHTML='<span style=font-size:36px>${typeIcons[u.upload_type]||'📄'}</span>'" />
          </div>
          <div class="upload-card-name">${u.description || u.filename}</div>
          <div class="upload-card-type">${u.upload_type.replace(/_/g,' ')}</div>
          <div class="upload-card-date">${u.upload_date}</div>
        </div>`).join('')
      : `<p style="color:var(--muted);padding:16px">No uploads yet. Use the form above to upload images.</p>`;

    // Store for lightbox
    window._schoolUploads = uploads;
  } catch (e) {
    document.getElementById('uploadGrid').innerHTML = `<p style="color:var(--muted)">Could not load uploads. Is the backend running?</p>`;
  }
}

function openSchoolLightbox(uploadId) {
  const uploads = window._schoolUploads || [];
  const u = uploads.find(x => x.upload_id === uploadId);
  if (!u) return;

  // Create a simple lightbox overlay
  const existing = document.getElementById('schoolLightbox');
  if (existing) existing.remove();

  const lb = document.createElement('div');
  lb.id = 'schoolLightbox';
  lb.style.cssText = 'position:fixed;inset:0;z-index:999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(200,210,255,0.85);backdrop-filter:blur(8px)';
  lb.innerHTML = `
    <div style="background:#fff;border-radius:16px;overflow:hidden;max-width:800px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(102,126,234,0.3)">
      <div style="position:relative">
        <button onclick="document.getElementById('schoolLightbox').remove()"
          style="position:absolute;top:12px;right:12px;background:rgba(255,255,255,0.9);border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;z-index:10">✕</button>
        <img src="${u.image_url}" style="width:100%;max-height:65vh;object-fit:contain;background:#f8f9ff" />
      </div>
      <div style="padding:16px;background:#f8f9ff;border-top:1px solid #e0e7ff">
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px">
          <span style="color:#64748b;font-weight:600">Type</span>
          <span>${u.upload_type.replace(/_/g,' ')}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px">
          <span style="color:#64748b;font-weight:600">Date</span>
          <span>${u.upload_date}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px">
          <span style="color:#64748b;font-weight:600">Description</span>
          <span>${u.description || '—'}</span>
        </div>
      </div>
    </div>`;
  lb.addEventListener('click', e => { if (e.target === lb) lb.remove(); });
  document.body.appendChild(lb);
}

// ══════════════════════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════════════════════
async function loadAnalytics() {
  try {
    const data = await api(`/school/analytics/${SESSION.school_id}`);

    // Dropout reasons
    const reasons = data.dropout_reasons;
    const total = Object.values(reasons).reduce((a, b) => a + b, 0) || 1;
    const reasonColors = { 'Financial Issues':'var(--red)', 'Migration':'var(--orange)', 'Academic Difficulty':'var(--yellow)', 'Family Issues':'var(--primary)', 'Unknown':'var(--dim)' };
    document.getElementById('dropoutReasons').innerHTML = Object.keys(reasons).length
      ? Object.entries(reasons).map(([r, n]) => `
        <div class="progress-bar-wrap">
          <div class="progress-label"><span>${r}</span><span>${n} student${n>1?'s':''}</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(n/total*100)}%;background:${reasonColors[r]||'var(--primary)'}"></div></div>
        </div>`).join('')
      : `<p style="color:var(--muted)">No dropouts recorded</p>`;

    // Top 5 attendance
    const sorted = [...data.attendance_summary].sort((a, b) => b.percentage - a.percentage).slice(0, 5);
    document.getElementById('topAttendance').innerHTML = sorted.length
      ? sorted.map(s => `
        <div class="progress-bar-wrap">
          <div class="progress-label"><span>${s.name}</span><span style="color:${s.percentage>=75?'var(--green)':s.percentage>=50?'var(--yellow)':'var(--red)'}">${s.percentage}%</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${s.percentage}%;background:${s.percentage>=75?'var(--green)':s.percentage>=50?'var(--yellow)':'var(--red)'}"></div></div>
        </div>`).join('')
      : `<p style="color:var(--muted)">No attendance data yet</p>`;

    // Full table
    document.getElementById('analyticsTableBody').innerHTML = data.attendance_summary.map(s => `
      <tr>
        <td><b>${s.roll_number}</b></td>
        <td>${s.name}</td>
        <td>${s.present}</td>
        <td>${s.total}</td>
        <td><span style="font-weight:700;color:${s.percentage>=75?'var(--green)':s.percentage>=50?'var(--yellow)':'var(--red)'}">${s.percentage}%</span></td>
      </tr>`).join('');
  } catch (e) {
    toast('Could not load analytics', 'error');
  }
}

// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  if (!initAuth()) return;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('reims_user');
    window.location.href = 'login.html';
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.tab));
  });

  document.getElementById('searchStudent').addEventListener('input', renderStudentsTable);
  document.getElementById('filterClass').addEventListener('change', renderStudentsTable);
  document.getElementById('filterStatus').addEventListener('change', renderStudentsTable);
  document.getElementById('attendanceDate').addEventListener('change', renderAttendanceForm);

  await fetchStudents();
  loadOverview();
});
