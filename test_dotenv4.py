import os
os.chdir(r"E:\NoteExam\app\backend")

# Read raw bytes
with open(".env", "rb") as f:
    raw = f.read()
print(f"Raw ({len(raw)} bytes): {raw}")

# Try reading as text
with open(".env", "r", encoding="utf-8") as f:
    text = f.read()
print(f"Text: {repr(text[:80])}")

# Check first line
first_line = text.split("\n")[0]
print(f"First line: {repr(first_line)}")
