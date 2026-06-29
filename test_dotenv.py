import os, sys
os.chdir(r"E:\NoteExam\app\backend")
sys.path.insert(0, r"E:\NoteExam\app\backend")

from dotenv import load_dotenv
load_dotenv()

key = os.getenv("DEEPSEEK_API_KEY", "NOT_FOUND")
print(f"API Key: [{key}]")
print(f"Length: {len(key)}")
print(f"repr: {repr(key)}")
print(f".env exists: {os.path.exists('.env')}")
print(f"CWD: {os.getcwd()}")
