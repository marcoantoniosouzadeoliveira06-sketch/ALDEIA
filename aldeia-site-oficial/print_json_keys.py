import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

def preview_file(name):
    path = f"C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\ace05e9d-d997-4023-86be-023df1b5f191\\scratch\\app_writes\\{name}"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"=== {name} ===")
    for k, v in data.items():
        if isinstance(v, str):
            print(f"  Key '{k}': len={len(v)}")
            print(f"    Start: {repr(v[:150])}")
            print(f"    End: {repr(v[-150:])}")
        else:
            print(f"  Key '{k}': {type(v)}")

preview_file("step_1063_tool_0_write_to_file_app.js.json")
preview_file("step_1577_tool_0_write_to_file_app.js.json")
preview_file("step_1982_tool_0_multi_replace_file_content_app.js.json")
