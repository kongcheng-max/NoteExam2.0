import os, sys
os.chdir(r"E:\NoteExam\app\backend")

from dotenv import load_dotenv, dotenv_values

# Check what dotenv reads now
vals = dotenv_values(".env")
print("dotenv_values:", dict(vals))

# Load with override
result = load_dotenv(".env", override=True)
print(f"load_dotenv result: {result}")

key = os.getenv("DEEPSEEK_API_KEY")
print(f"After load: [{key}]")

# Also check all env vars with DEEPSEEK
for k, v in os.environ.items():
    if "DEEPSEEK" in k or "deepseek" in k.lower():
        print(f"ENV: {k} = [{v}]")
