import os, sys
os.chdir(r"E:\NoteExam\app\backend")
sys.path.insert(0, r"E:\NoteExam\app\backend")

from dotenv import load_dotenv, dotenv_values

# Check what dotenv actually reads
values = dotenv_values(".env")
print("dotenv_values:", values)

# Check raw file content
with open(".env", "rb") as f:
    raw = f.read()
print(f"Raw bytes: {raw}")
print(f"Has BOM: {raw[:3] == b'\\xef\\xbb\\xbf'}")

# Try with explicit path
load_dotenv(".env", override=True)
key = os.getenv("DEEPSEEK_API_KEY", "NOT_FOUND")
print(f"After explicit load: [{key}]")
