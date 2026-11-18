path = "index.html"
lines = open(path, encoding="utf-8").readlines()

start = 15497  # 1-indexed, function _hydraRecordFor
end = 15696    # 1-indexed, closing brace of printHydraPlantelPDF

assert lines[start-1].startswith("function _hydraRecordFor"), repr(lines[start-1])
assert lines[end-1].strip() == "}", repr(lines[end-1])
assert "printHydraPlantelPDF" in "".join(lines[end-30:end])

new_block = open("/tmp/new_block.txt", encoding="utf-8").read()
if not new_block.endswith("\n"):
    new_block += "\n"

new_lines = lines[:start-1] + [new_block] + lines[end:]
open(path, "w", encoding="utf-8").write("".join(new_lines))
print("SCRIPT_B_OK")
