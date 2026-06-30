import sys
sys.stdout.reconfigure(encoding="utf-8")

FP = r"E:\NoteExam\app\backend\routers\exams.py"
with open(FP, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Show lines around list_exams query
for i, line in enumerate(lines):
    if "async def list_exams" in line:
        for j in range(i, min(i+25, len(lines))):
            print(f"L{j+1}: {lines[j].rstrip()}")
        break
