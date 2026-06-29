import requests

print("Simulating user upload through frontend proxy...")

# Test 1: Normal upload
try:
    r = requests.post("http://localhost:3000/api/notes", json={
        "content": "这是一段测试笔记内容", "note_type": "text"
    }, timeout=5)
    print(f"Status: {r.status_code}")
    print(f"Response: {r.text[:300]}")
    print()
except Exception as e:
    print(f"Error: {e}")

# Test 2: What does createNote send?
# Looking at api.js: createNote sends {content, note_type}
# But note - it sends content as a positional arg, not wrapped in object
# Let me check...

print("Checking api.createNote call signature:")
print("createNote: (content, noteType) => request('/notes', { method: 'POST', body: JSON.stringify({ content, note_type: noteType }) })")
print("This looks correct.")
print()

# Test 3: upload with longer content
try:
    long_content = "这是一段较长的测试笔记内容，包含多个句子。用于验证上传功能是否正常工作。" * 10
    r = requests.post("http://localhost:3000/api/notes", json={
        "content": long_content, "note_type": "text"
    }, timeout=5)
    print(f"Long upload: status={r.status_code}")
    print(f"Response: {r.text[:200]}")
except Exception as e:
    print(f"Error: {e}")
