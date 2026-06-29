import requests

# Create note
r = requests.post("http://localhost:3000/api/notes", json={
    "content": "测试上传笔记内容", "note_type": "text"
}, timeout=5)
print(f"Upload: {r.status_code}")
nid = r.json().get("data", {}).get("id")
print(f"Note ID: {nid}")

if nid:
    # Try generate - should fail with real API error, not header error
    r = requests.post("http://localhost:3000/api/exams/generate", json={
        "note_id": nid, "question_types": ["single_choice"],
        "difficulties": ["basic"], "total_questions": 5
    }, timeout=15)
    print(f"Generate: {r.status_code}")
    detail = r.json().get("detail", "")
    print(f"Detail: {detail[:200]}")
    
    if "Illegal header" in detail:
        print("FAIL: Still getting Illegal header error")
    elif "401" in detail or "Unauthorized" in detail or "Authentication" in detail:
        print("PASS: Correctly getting auth error (fake key), not header format error")
    else:
        print(f"CHECK: {detail[:100]}")
