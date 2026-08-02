import sys
sys.stdout.reconfigure(encoding='utf-8')

with open("reconstructed_normal_app.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

print("=== Preloader JS in reconstructed_normal_app.js ===")
for idx, line in enumerate(lines):
    if "preloader" in line or "loaded" in line:
        print(f"Line {idx+1}: {line.strip()}")
        # print surrounding
        start = max(0, idx - 4)
        end = min(len(lines), idx + 8)
        for j in range(start, end):
            print(f"  {j+1}: {lines[j]}", end="")
        print("-" * 40)
