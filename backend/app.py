from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os
import math

app = Flask(__name__)
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')

def load_json(filename):
    with open(os.path.join(DATA_DIR, filename), 'r') as f:
        return json.load(f)

# ─── AI / Rule-based scoring ────────────────────────────────────────────────

def compute_dropout_risk(school):
    """
    Rule-based dropout risk score (0–100).
    Higher = more at risk.
    """
    score = 0

    # Attendance weight: 35%
    att = school['attendance_rate']
    if att < 50:
        score += 35
    elif att < 65:
        score += 20
    elif att < 75:
        score += 10
    else:
        score += 0

    # Teacher-student ratio weight: 20%
    ratio = school['students'] / max(school['teacher_count'], 1)
    if ratio > 60:
        score += 20
    elif ratio > 40:
        score += 12
    elif ratio > 25:
        score += 6
    else:
        score += 0

    # NGO support weight: 15%
    ngo = school['ngo_support_level']
    if ngo <= 2:
        score += 15
    elif ngo <= 5:
        score += 8
    else:
        score += 0

    # Funding weight: 15%
    funding = school['funding_status']
    if funding == 'none':
        score += 15
    elif funding == 'partial':
        score += 8
    else:
        score += 0

    # Infrastructure weight: 10%
    infra = school['infrastructure_score']
    if infra < 35:
        score += 10
    elif infra < 55:
        score += 5
    else:
        score += 0

    # Community participation weight: 5%
    comm = school['community_participation']
    if comm < 30:
        score += 5
    elif comm < 50:
        score += 2
    else:
        score += 0

    return min(score, 100)


def risk_label(score):
    if score >= 65:
        return 'Critical'
    elif score >= 40:
        return 'High'
    elif score >= 20:
        return 'Medium'
    else:
        return 'Low'


def compute_engagement_score(school):
    """Composite engagement score 0–100."""
    weights = {
        'attendance_rate': 0.30,
        'community_participation': 0.20,
        'ngo_support_level': 0.15,   # normalised /10
        'infrastructure_score': 0.20,
        'books_availability': 0.15,
    }
    score = (
        school['attendance_rate'] * weights['attendance_rate'] +
        school['community_participation'] * weights['community_participation'] +
        (school['ngo_support_level'] * 10) * weights['ngo_support_level'] +
        school['infrastructure_score'] * weights['infrastructure_score'] +
        school['books_availability'] * weights['books_availability']
    )
    return round(score, 1)


def generate_ai_insights(schools):
    insights = []

    for s in schools:
        risk = compute_dropout_risk(s)
        eng = compute_engagement_score(s)

        if risk >= 65:
            insights.append({
                'type': 'critical',
                'icon': '🚨',
                'school': s['school_name'],
                'region': s['region'],
                'message': f"{s['school_name']} is at CRITICAL dropout risk (score: {risk}). Immediate intervention required.",
                'metric': f"Dropout Risk: {risk}%"
            })
        elif risk >= 40:
            insights.append({
                'type': 'warning',
                'icon': '⚠️',
                'school': s['school_name'],
                'region': s['region'],
                'message': f"{s['school_name']} shows HIGH dropout risk. Attendance at {s['attendance_rate']}% needs attention.",
                'metric': f"Dropout Risk: {risk}%"
            })

        if eng < 40:
            insights.append({
                'type': 'weak_zone',
                'icon': '📉',
                'school': s['school_name'],
                'region': s['region'],
                'message': f"Weak engagement zone detected at {s['school_name']} in {s['region']}. Engagement score: {eng}.",
                'metric': f"Engagement: {eng}/100"
            })

        if s['ngo_support_level'] <= 2:
            insights.append({
                'type': 'info',
                'icon': '🤝',
                'school': s['school_name'],
                'region': s['region'],
                'message': f"NGO involvement is critically low at {s['school_name']}. Support level: {s['ngo_support_level']}/10.",
                'metric': f"NGO Support: {s['ngo_support_level']}/10"
            })

        if s['teacher_count'] < 5 and s['students'] > 150:
            insights.append({
                'type': 'warning',
                'icon': '👩‍🏫',
                'school': s['school_name'],
                'region': s['region'],
                'message': f"Teacher shortage at {s['school_name']}: only {s['teacher_count']} teachers for {s['students']} students.",
                'metric': f"Ratio: 1:{s['students']//s['teacher_count']}"
            })

    # Sort: critical first
    order = {'critical': 0, 'weak_zone': 1, 'warning': 2, 'info': 3}
    insights.sort(key=lambda x: order.get(x['type'], 4))
    return insights


# ─── API Routes ──────────────────────────────────────────────────────────────

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

    total_students = sum(s['students'] for s in schools)
    avg_attendance = round(sum(s['attendance_rate'] for s in schools) / len(schools), 1)
    avg_teacher_ratio = round(
        sum(s['students'] / max(s['teacher_count'], 1) for s in schools) / len(schools), 1
    )
    avg_ngo = round(sum(s['ngo_support_level'] for s in schools) / len(schools), 1)
    avg_infra = round(sum(s['infrastructure_score'] for s in schools) / len(schools), 1)
    avg_books = round(sum(s['books_availability'] for s in schools) / len(schools), 1)
    avg_dropout = round(sum(s['dropout_rate'] for s in schools) / len(schools), 1)
    internet_count = sum(1 for s in schools if s['internet_access'])

    risk_counts = {'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0}
    for s in schools:
        risk_counts[risk_label(compute_dropout_risk(s))] += 1

    return jsonify({
        'total_schools': len(schools),
        'total_students': total_students,
        'avg_attendance': avg_attendance,
        'avg_teacher_ratio': avg_teacher_ratio,
        'avg_ngo_support': avg_ngo,
        'avg_infrastructure': avg_infra,
        'avg_books_availability': avg_books,
        'avg_dropout_rate': avg_dropout,
        'internet_enabled_schools': internet_count,
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
        result.append({
            'school_id': s['school_id'],
            'school_name': s['school_name'],
            'region': s['region'],
            'dropout_risk_score': score,
            'risk_label': risk_label(score),
            'engagement_score': compute_engagement_score(s),
            'attendance_rate': s['attendance_rate'],
            'dropout_rate': s['dropout_rate']
        })
    result.sort(key=lambda x: x['dropout_risk_score'], reverse=True)
    return jsonify(result)


@app.route('/api/partnerships', methods=['GET'])
def partnerships():
    timeline = load_json('partnership_timeline.json')
    schools = load_json('schools_data.json')

    # Aggregate current partnership strengths
    avg_govt = round(sum(s['govt_partnership'] for s in schools) / len(schools), 1)
    avg_ngo = round(sum(s['ngo_partnership'] for s in schools) / len(schools), 1)
    avg_school = round(sum(s['school_partnership'] for s in schools) / len(schools), 1)

    # Detect weak partnerships
    weak_areas = []
    for s in schools:
        if s['ngo_partnership'] < 30:
            weak_areas.append({
                'school': s['school_name'],
                'region': s['region'],
                'type': 'NGO Partnership',
                'score': s['ngo_partnership']
            })
        if s['govt_partnership'] < 35:
            weak_areas.append({
                'school': s['school_name'],
                'region': s['region'],
                'type': 'Government Partnership',
                'score': s['govt_partnership']
            })

    return jsonify({
        'timeline': timeline,
        'current_strength': {
            'government': avg_govt,
            'ngo': avg_ngo,
            'school': avg_school
        },
        'weak_areas': weak_areas,
        'network': [
            {'from': 'Government', 'to': 'Schools', 'strength': avg_govt},
            {'from': 'NGOs', 'to': 'Schools', 'strength': avg_ngo},
            {'from': 'Government', 'to': 'NGOs', 'strength': round((avg_govt + avg_ngo) / 2, 1)},
        ]
    })


@app.route('/api/regions', methods=['GET'])
def regions():
    schools = load_json('schools_data.json')
    region_map = {}
    for s in schools:
        r = s['region']
        if r not in region_map:
            region_map[r] = {
                'region': r,
                'schools': 0,
                'total_students': 0,
                'avg_attendance': 0,
                'avg_dropout': 0,
                'avg_ngo': 0,
                'school_list': []
            }
        region_map[r]['schools'] += 1
        region_map[r]['total_students'] += s['students']
        region_map[r]['avg_attendance'] += s['attendance_rate']
        region_map[r]['avg_dropout'] += s['dropout_rate']
        region_map[r]['avg_ngo'] += s['ngo_support_level']
        region_map[r]['school_list'].append(s['school_name'])

    for r in region_map.values():
        n = r['schools']
        r['avg_attendance'] = round(r['avg_attendance'] / n, 1)
        r['avg_dropout'] = round(r['avg_dropout'] / n, 1)
        r['avg_ngo'] = round(r['avg_ngo'] / n, 1)

    return jsonify(list(region_map.values()))


if __name__ == '__main__':
    app.run(debug=True, port=5000)