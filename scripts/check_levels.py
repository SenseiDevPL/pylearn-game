"""Check every level offline: its solution must win, its starter code must not.

Runs the same bridge.py the game runs in Pyodide. Usage:
    python3 scripts/check_levels.py
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
BRIDGE = (ROOT / "src/workers/bridge.py").read_text()
LEVELS = json.loads((ROOT / "src/data/levels.json").read_text())


NO_BOARD = {"width": 1, "height": 1, "playerStart": {"x": 0, "y": 0}, "goal": {"x": 0, "y": 0}, "walls": [], "items": []}


def run(level, code):
    env = {"_LEVEL_JSON": json.dumps(level.get("grid", NO_BOARD)), "_level_id": level["id"]}
    try:
        exec(BRIDGE + f"\n_run({json.dumps(code, ensure_ascii=False)})\n", env)
    except Exception as e:  # the game shows these as errors
        return "error", f"{type(e).__name__}: {e}", ""
    p = env["player"]
    output = "\n".join(env["_output_lines"])
    if "grid" not in level:  # "Python w pracy": judged by console output only
        exp, req = level.get("expectedOutput"), level.get("requires")
        if exp is not None and output.strip() != exp:
            return "output", repr(output[:80]), output
        if req and not re.search(req["pattern"], code):
            return "requires", req["message"], output
        return "win", "", output
    if not env["_commands"]:
        return "no-commands", "", output
    if p._crashed:
        return "wall", "", output
    if not p.at_goal():
        return "goal", "", output
    if env["_items"]:
        return "items", "", output
    req = level.get("requires")
    if req and not re.search(req["pattern"], code):
        return "requires", req["message"], output
    exp = level.get("expectedOutput")
    if exp is not None and output.strip() != exp:
        return "output", repr(output), output
    return "win", "", output


bad = 0
for level in LEVELS:
    sol = run(level, level["solution"])
    start = run(level, level["starterCode"])
    ok = sol[0] == "win" and start[0] != "win"
    bad += not ok
    print(f"{level['id']:>2} {'OK ' if ok else 'BAD'} {'AI ' if level.get('ai') else '   '}"
          f"solution={sol[0]}{' ' + sol[1] if sol[1] else ''} | starter={start[0]} {start[1][:70]}")
print("ALL OK" if not bad else f"{bad} BAD")
