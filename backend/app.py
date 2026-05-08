from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os
import uuid
from datetime import datetime

app = Flask(__name__)
CORS(app)

DATA_DIR   = os.path.join(os.path.dirname(__file__), '..', 'data')
UPLOAD_DIR = os.path.join(DATA_DIR, 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Serve uploaded images as static files ──
from flask import send_from_directory

@app.route('/uploads/<filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_DIR, filename)

# ─── Helpers ────────────────────────────────────────────────────────────────

def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return []
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filename, data):
    with open(os.path.join(DATA_DIR, filename), 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# ─── AI / Rule-based scoring ────────────────────────────────────────────────

def compute_dropout_risk(school):
    score = 0
    att = school['attendance_rate']
    if att < 50: score += 35
    elif att < 65: score += 20
    elif att < 75: score += 10

    ratio = school['students'] / max(school['teacher_count'], 1)
    if ratio > 60: score += 20
    elif ratio > 40: score += 12
    elif ratio > 25: score += 6

    ngo = school['ngo_support_level']
    if ngo <= 2: score += 15
    elif ngo <= 5: score += 8

    funding = school['funding_status']
    if funding == 'none': score += 15
    elif funding == 'partial': score += 8

    infra = school['infrastructure_score']
    if infra < 35: score += 10
    elif infra < 55: score += 5

    comm = school['community_participation']
    if comm < 30: score += 5
    elif comm < 50: score += 2

    return min(score, 100)

def risk_label(score):
    if score >= 65: return 'Critical'
    elif score >= 40: return 'High'
    elif score >= 20: return 'Medium'
    return 'Low'

def compute_engagement_score(school):
    return round(
        school['attendance_rate'] * 0.30 +
        school['community_participation'] * 0.20 +
        (school['ngo_support_level'] * 10) * 0.15 +
        school['infrastructure_score'] * 0.20 +
        school['books_availability'] * 0.15, 1
    )

def generate_ai_insights(schools):
    insights = []
    for s in schools:
        risk = compute_dropout_risk(s)
        eng  = compute_engagement_score(s)
        if risk >= 65:
            insights.append({'type':'critical','icon':'🚨','school':s['school_name'],'region':s['region'],
                'message':f"{s['school_name']} is at CRITICAL dropout risk (score: {risk}). Immediate intervention required.",
                'metric':f"Dropout Risk: {risk}%"})
        elif risk >= 40:
            insights.append({'type':'warning','icon':'⚠️','school':s['school_name'],'region':s['region'],
                'message':f"{s['school_name']} shows HIGH dropout risk. Attendance at {s['attendance_rate']}% needs attention.",
                'metric':f"Dropout Risk: {risk}%"})
        if eng < 40:
            insights.append({'type':'weak_zone','icon':'📉','school':s['school_name'],'region':s['region'],
                'message':f"Weak engagement zone detected at {s['school_name']} in {s['region']}. Engagement score: {eng}.",
                'metric':f"Engagement: {eng}/100"})
        if s['ngo_support_level'] <= 2:
            insights.append({'type':'info','icon':'🤝','school':s['school_name'],'region':s['region'],
                'message':f"NGO involvement is critically low at {s['school_name']}. Support level: {s['ngo_support_level']}/10.",
                'metric':f"NGO Support: {s['ngo_support_level']}/10"})
        if s['teacher_count'] < 5 and s['students'] > 150:
            insights.append({'type':'warning','icon':'👩‍🏫','school':s['school_name'],'region':s['region'],
                'message':f"Teacher shortage at {s['school_name']}: only {s['teacher_count']} teachers for {s['students']} students.",
                'metric':f"Ratio: 1:{s['students']//s['teacher_count']}"})
    order = {'critical':0,'weak_zone':1,'warning':2,'info':3}
    insights.sort(key=lambda x: order.get(x['type'], 4))
    return insights

# ════════════════════════════════════════════════════════════
# AUTH ROUTES
# ════════════════════════════════════════════════════════════

@app.route('/api/auth/login', methods=['POST'])
def login():
    body = request.get_json(force=True)
    username = body.get('username', '').strip()
    password = body.get('password', '').strip()
    users = load_json('users.json')
    user = next((u for u in users if u['username'] == username and u['password'] == password), None)
    if not user:
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
    return jsonify({
        'success': True,
        'role': user['role'],
        'name': user['name'],
        'school_id': user.get('school_id'),
        'username': user['username']
    })

# ════════════════════════════════════════════════════════════
# EXISTING ADMIN API ROUTES (unchanged)
# ════════════════════════════════════════════════════════════

@app.route('/api/schools', methods=['GET'])
def get_schools():
    schools = load_json('schools_data.json')
    region = request.args.get('region')
    if region:
        schools = [s for s in schools if s['region'].lower() == region.lower()]
    return jsonify(schools)

@app.route('/api/schools/<school_id>', methods=['GET'])
def get_school(school_id):
    schools = load_json('schools_data.json')
    school = next((s for s in schools if s['school_id'] == school_id), None)
    if not school:
        return jsonify({'error': 'School not found'}), 404
    school['dropout_risk_score'] = compute_dropout_risk(school)
    school['risk_label'] = risk_label(compute_dropout_risk(school))
    school['engagement_score'] = compute_engagement_score(school)
    return jsonify(school)

@app.route('/api/dashboard/summary', methods=['GET'])
def dashboard_summary():
    schools = load_json('schools_data.json')
    total_students  = sum(s['students'] for s in schools)
    avg_attendance  = round(sum(s['attendance_rate'] for s in schools) / len(schools), 1)
    avg_ngo         = round(sum(s['ngo_support_level'] for s in schools) / len(schools), 1)
    avg_infra       = round(sum(s['infrastructure_score'] for s in schools) / len(schools), 1)
    avg_books       = round(sum(s['books_availability'] for s in schools) / len(schools), 1)
    avg_dropout     = round(sum(s['dropout_rate'] for s in schools) / len(schools), 1)
    internet_count  = sum(1 for s in schools if s['internet_access'])
    risk_counts     = {'Critical':0,'High':0,'Medium':0,'Low':0}
    for s in schools:
        risk_counts[risk_label(compute_dropout_risk(s))] += 1
    return jsonify({
        'total_schools': len(schools), 'total_students': total_students,
        'avg_attendance': avg_attendance, 'avg_ngo_support': avg_ngo,
        'avg_infrastructure': avg_infra, 'avg_books_availability': avg_books,
        'avg_dropout_rate': avg_dropout, 'internet_enabled_schools': internet_count,
        'risk_distribution': risk_counts
    })

@app.route('/api/ai/insights', methods=['GET'])
def ai_insights():
    schools = load_json('schools_data.json')
    insights = generate_ai_insights(schools)
    return jsonify({'insights': insights, 'total': len(insights)})

@app.route('/api/ai/dropout-risk', methods=['GET'])
def dropout_risk():
    schools = load_json('schools_data.json')
    result = []
    for s in schools:
        score = compute_dropout_risk(s)
        result.append({'school_id':s['school_id'],'school_name':s['school_name'],'region':s['region'],
            'dropout_risk_score':score,'risk_label':risk_label(score),
            'engagement_score':compute_engagement_score(s),
            'attendance_rate':s['attendance_rate'],'dropout_rate':s['dropout_rate']})
    result.sort(key=lambda x: x['dropout_risk_score'], reverse=True)
    return jsonify(result)

@app.route('/api/partnerships', methods=['GET'])
def partnerships():
    timeline = load_json('partnership_timeline.json')
    schools  = load_json('schools_data.json')
    avg_govt   = round(sum(s['govt_partnership'] for s in schools) / len(schools), 1)
    avg_ngo    = round(sum(s['ngo_partnership']  for s in schools) / len(schools), 1)
    avg_school = round(sum(s['school_partnership'] for s in schools) / len(schools), 1)
    weak_areas = []
    for s in schools:
        if s['ngo_partnership'] < 30:
            weak_areas.append({'school':s['school_name'],'region':s['region'],'type':'NGO Partnership','score':s['ngo_partnership']})
        if s['govt_partnership'] < 35:
            weak_areas.append({'school':s['school_name'],'region':s['region'],'type':'Government Partnership','score':s['govt_partnership']})
    return jsonify({
        'timeline': timeline,
        'current_strength': {'government':avg_govt,'ngo':avg_ngo,'school':avg_school},
        'weak_areas': weak_areas,
        'network': [
            {'from':'Government','to':'Schools','strength':avg_govt},
            {'from':'NGOs','to':'Schools','strength':avg_ngo},
            {'from':'Government','to':'NGOs','strength':round((avg_govt+avg_ngo)/2,1)},
        ]
    })

@app.route('/api/regions', methods=['GET'])
def regions():
    schools = load_json('schools_data.json')
    region_map = {}
    for s in schools:
        r = s['region']
        if r not in region_map:
            region_map[r] = {'region':r,'schools':0,'total_students':0,'avg_attendance':0,'avg_dropout':0,'avg_ngo':0,'school_list':[]}
        region_map[r]['schools'] += 1
        region_map[r]['total_students'] += s['students']
        region_map[r]['avg_attendance'] += s['attendance_rate']
        region_map[r]['avg_dropout']    += s['dropout_rate']
        region_map[r]['avg_ngo']        += s['ngo_support_level']
        region_map[r]['school_list'].append(s['school_name'])
    for r in region_map.values():
        n = r['schools']
        r['avg_attendance'] = round(r['avg_attendance']/n, 1)
        r['avg_dropout']    = round(r['avg_dropout']/n, 1)
        r['avg_ngo']        = round(r['avg_ngo']/n, 1)
    return jsonify(list(region_map.values()))

# ════════════════════════════════════════════════════════════
# SCHOOL PORTAL ROUTES (NEW)
# ════════════════════════════════════════════════════════════

@app.route('/api/school/info/<school_id>', methods=['GET'])
def school_info(school_id):
    schools = load_json('schools_data.json')
    school = next((s for s in schools if s['school_id'] == school_id), None)
    if not school:
        return jsonify({'error': 'School not found'}), 404
    return jsonify(school)

# ── Students ──────────────────────────────────────────────

@app.route('/api/school/students/<school_id>', methods=['GET'])
def get_students(school_id):
    students = load_json('students.json')
    return jsonify([s for s in students if s['school_id'] == school_id])

@app.route('/api/school/students', methods=['POST'])
def add_student():
    students = load_json('students.json')
    data = request.get_json(force=True)
    school_id = data.get('school_id', '')
    # Auto-generate student_id
    existing = [s for s in students if s['school_id'] == school_id]
    seq = str(len(existing) + 1).zfill(3)
    data['student_id'] = f"{school_id}-{seq}"
    data.setdefault('attendance', [])
    data.setdefault('dropout_status', False)
    data.setdefault('dropout_date', None)
    data.setdefault('dropout_reason', None)
    students.append(data)
    save_json('students.json', students)
    return jsonify({'success': True, 'student_id': data['student_id']}), 201

@app.route('/api/school/students/<student_id>', methods=['PUT'])
def update_student(student_id):
    students = load_json('students.json')
    idx = next((i for i, s in enumerate(students) if s['student_id'] == student_id), None)
    if idx is None:
        return jsonify({'error': 'Student not found'}), 404
    data = request.get_json(force=True)
    students[idx].update(data)
    save_json('students.json', students)
    return jsonify({'success': True})

# ── Attendance ────────────────────────────────────────────

@app.route('/api/school/attendance', methods=['POST'])
def mark_attendance():
    students = load_json('students.json')
    data = request.get_json(force=True)
    # data = { student_id, date, status }
    student_id = data.get('student_id')
    idx = next((i for i, s in enumerate(students) if s['student_id'] == student_id), None)
    if idx is None:
        return jsonify({'error': 'Student not found'}), 404
    # Remove existing entry for same date, then add new
    students[idx]['attendance'] = [
        a for a in students[idx].get('attendance', []) if a['date'] != data['date']
    ]
    students[idx]['attendance'].append({'date': data['date'], 'status': data['status']})
    save_json('students.json', students)
    return jsonify({'success': True})

@app.route('/api/school/attendance/bulk', methods=['POST'])
def bulk_attendance():
    students = load_json('students.json')
    data = request.get_json(force=True)
    # data = { date, records: [{student_id, status}] }
    date = data.get('date')
    for rec in data.get('records', []):
        idx = next((i for i, s in enumerate(students) if s['student_id'] == rec['student_id']), None)
        if idx is not None:
            students[idx]['attendance'] = [a for a in students[idx].get('attendance', []) if a['date'] != date]
            students[idx]['attendance'].append({'date': date, 'status': rec['status']})
    save_json('students.json', students)
    return jsonify({'success': True})

# ── Dropout ───────────────────────────────────────────────

@app.route('/api/school/dropout', methods=['POST'])
def mark_dropout():
    students = load_json('students.json')
    data = request.get_json(force=True)
    student_id = data.get('student_id')
    idx = next((i for i, s in enumerate(students) if s['student_id'] == student_id), None)
    if idx is None:
        return jsonify({'error': 'Student not found'}), 404
    students[idx]['dropout_status'] = True
    students[idx]['dropout_date']   = data.get('dropout_date')
    students[idx]['dropout_reason'] = data.get('dropout_reason')
    save_json('students.json', students)
    return jsonify({'success': True})

# ── Analytics for school portal ──────────────────────────

@app.route('/api/school/analytics/<school_id>', methods=['GET'])
def school_analytics(school_id):
    students = [s for s in load_json('students.json') if s['school_id'] == school_id]
    total = len(students)
    dropouts = [s for s in students if s.get('dropout_status')]
    dropout_reasons = {}
    for s in dropouts:
        r = s.get('dropout_reason') or 'Unknown'
        dropout_reasons[r] = dropout_reasons.get(r, 0) + 1

    # Attendance summary per student
    att_summary = []
    for s in students:
        records = s.get('attendance', [])
        present = sum(1 for a in records if a['status'] == 'Present')
        total_r = len(records)
        pct = round(present / total_r * 100, 1) if total_r else 0
        att_summary.append({'student_id': s['student_id'], 'name': s['name'],
                             'roll_number': s['roll_number'], 'present': present,
                             'total': total_r, 'percentage': pct})

    uploads = [u for u in load_json('uploads_metadata.json') if u['school_id'] == school_id]

    return jsonify({
        'total_students': total,
        'total_dropouts': len(dropouts),
        'dropout_reasons': dropout_reasons,
        'attendance_summary': att_summary,
        'total_uploads': len(uploads)
    })

# ── Image Upload ──────────────────────────────────────────

@app.route('/api/school/upload', methods=['POST'])
def upload_image():
    school_id   = request.form.get('school_id', '')
    student_id  = request.form.get('student_id', None)
    upload_type = request.form.get('upload_type', 'attendance_photo')
    description = request.form.get('description', '')

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
        return jsonify({'error': 'Invalid file type'}), 400

    upload_id = 'UP' + str(uuid.uuid4())[:6].upper()
    safe_name = f"{upload_id}{ext}"
    file.save(os.path.join(UPLOAD_DIR, safe_name))

    metadata = load_json('uploads_metadata.json')
    metadata.append({
        'upload_id': upload_id,
        'school_id': school_id,
        'student_id': student_id,
        'upload_type': upload_type,
        'filename': safe_name,
        'upload_date': datetime.now().strftime('%Y-%m-%d'),
        'description': description
    })
    save_json('uploads_metadata.json', metadata)
    return jsonify({'success': True, 'upload_id': upload_id, 'filename': safe_name}), 201

@app.route('/api/school/uploads/<school_id>', methods=['GET'])
def get_uploads(school_id):
    uploads = [u for u in load_json('uploads_metadata.json') if u['school_id'] == school_id]
    for u in uploads:
        u['image_url'] = f'http://127.0.0.1:5000/uploads/{u["filename"]}'
    return jsonify(uploads)

# ════════════════════════════════════════════════════════════
# ADMIN — SCHOOL REGISTRATION
# ════════════════════════════════════════════════════════════

@app.route('/api/admin/register-school', methods=['POST'])
def register_school():
    data = request.get_json(force=True)

    # ── Validate required fields ──
    required = ['school_name', 'region', 'district', 'block', 'village',
                'school_type', 'principal_name', 'contact', 'students', 'teacher_count']
    for f in required:
        if not data.get(f):
            return jsonify({'success': False, 'message': f'Missing field: {f}'}), 400

    schools = load_json('schools_data.json')
    users   = load_json('users.json')

    # ── Auto-generate school_id ──
    existing_ids = [s['school_id'] for s in schools]
    num = len(schools) + 1
    while f'SCH{str(num).zfill(3)}' in existing_ids:
        num += 1
    school_id = f'SCH{str(num).zfill(3)}'

    # ── Auto-generate login credentials ──
    username = f'sch{str(num).zfill(3)}'
    password = f'school{str(num).zfill(3)}'

    # ── Build school record ──
    new_school = {
        'school_id':              school_id,
        'school_name':            data['school_name'],
        'region':                 data['region'],
        'district':               data.get('district', ''),
        'block':                  data.get('block', ''),
        'village':                data.get('village', ''),
        'school_type':            data.get('school_type', 'Government'),
        'principal_name':         data.get('principal_name', ''),
        'contact':                data.get('contact', ''),
        'students':               int(data['students']),
        'attendance_rate':        float(data.get('attendance_rate', 70.0)),
        'teacher_count':          int(data['teacher_count']),
        'ngo_support_level':      int(data.get('ngo_support_level', 5)),
        'funding_status':         data.get('funding_status', 'partial'),
        'infrastructure_score':   int(data.get('infrastructure_score', 50)),
        'internet_access':        data.get('internet_access', False),
        'books_availability':     int(data.get('books_availability', 60)),
        'dropout_rate':           float(data.get('dropout_rate', 10.0)),
        'community_participation':int(data.get('community_participation', 50)),
        'govt_partnership':       int(data.get('govt_partnership', 60)),
        'ngo_partnership':        int(data.get('ngo_partnership', 50)),
        'school_partnership':     int(data.get('school_partnership', 60)),
        'monthly_attendance':     [int(data.get('attendance_rate', 70))] * 12,
        'monthly_performance':    [int(data.get('attendance_rate', 70)) - 10] * 12,
        'registered_on':          datetime.now().strftime('%Y-%m-%d'),
    }

    # ── Build user record ──
    new_user = {
        'username':  username,
        'password':  password,
        'role':      'school',
        'school_id': school_id,
        'name':      data['school_name']
    }

    schools.append(new_school)
    users.append(new_user)
    save_json('schools_data.json', schools)
    save_json('users.json', users)

    return jsonify({
        'success':   True,
        'school_id': school_id,
        'username':  username,
        'password':  password,
        'message':   f'School registered successfully. Login credentials generated.'
    }), 201


@app.route('/api/admin/registered-schools', methods=['GET'])
def registered_schools():
    users   = load_json('users.json')
    schools = load_json('schools_data.json')
    school_users = [u for u in users if u['role'] == 'school']
    result = []
    for u in school_users:
        school = next((s for s in schools if s['school_id'] == u['school_id']), {})
        result.append({
            'school_id':   u['school_id'],
            'school_name': u['name'],
            'username':    u['username'],
            'password':    u['password'],
            'region':      school.get('region', '—'),
            'registered_on': school.get('registered_on', '—'),
        })
    return jsonify(result)


@app.route('/api/admin/all-uploads', methods=['GET'])
def all_uploads():
    uploads = load_json('uploads_metadata.json')
    schools = load_json('schools_data.json')
    school_map = {s['school_id']: s['school_name'] for s in schools}
    # Attach school name and image URL to each upload
    result = []
    for u in uploads:
        entry = dict(u)
        entry['school_name'] = school_map.get(u['school_id'], u['school_id'])
        entry['image_url']   = f'http://127.0.0.1:5000/uploads/{u["filename"]}'
        result.append(entry)
    # Newest first
    result.sort(key=lambda x: x.get('upload_date', ''), reverse=True)
    return jsonify(result)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
