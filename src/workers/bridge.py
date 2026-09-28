import json as _json
import os as _os

_os.environ["MPLBACKEND"] = "AGG"  # charts are drawn off-screen and sent as PNG

# Prepended by the worker (and by scripts/check_levels.py):
#   _LEVEL_JSON = '<grid of the current level as JSON>'
#   _level_id = <number>
_grid = _json.loads(_LEVEL_JSON)

_commands = []
_MAX_COMMANDS = 1000

# The board is simulated here too, so sensors (can_move, on_item, at_goal)
# can answer while the code runs. Phaser replays the recorded commands
# afterwards; both follow the same rules: facing starts "right", a blocked
# move ends the run.
_DIRS = {"up": (0, -1), "right": (1, 0), "down": (0, 1), "left": (-1, 0)}
_ORDER = ["up", "right", "down", "left"]
_walls = {(w["x"], w["y"]) for w in _grid.get("walls", [])}
_items = {(i["x"], i["y"]) for i in _grid.get("items", [])}
_goal = (_grid["goal"]["x"], _grid["goal"]["y"])


class _Stop(Exception):
    """The player hit a wall: the run ends there, like in the Phaser replay."""


class _Player:
    def __init__(self):
        self._x = _grid["playerStart"]["x"]
        self._y = _grid["playerStart"]["y"]
        self._facing = "right"
        self._crashed = False

    def _record(self, action, args):
        if len(_commands) >= _MAX_COMMANDS:
            raise RuntimeError("_TOO_MANY_COMMANDS")
        _commands.append({"action": action, "args": args})

    def _ahead(self):
        dx, dy = _DIRS[self._facing]
        return self._x + dx, self._y + dy

    def _free(self, x, y):
        return 0 <= x < _grid["width"] and 0 <= y < _grid["height"] and (x, y) not in _walls

    def _turn(self, step):
        self._facing = _ORDER[(_ORDER.index(self._facing) + step) % 4]

    def move(self, direction="forward"):
        self._record("move", {"direction": direction})
        if self._crashed:
            return
        nx, ny = self._ahead()
        if self._free(nx, ny):
            self._x, self._y = nx, ny
        else:
            self._crashed = True
            raise _Stop()

    def move_forward(self):
        self.move("forward")

    def move_back(self):
        self.move("back")

    def turn_left(self):
        self._record("turn", {"direction": "left"})
        self._turn(-1)

    def turn_right(self):
        self._record("turn", {"direction": "right"})
        self._turn(1)

    def say(self, text):
        self._record("say", {"text": str(text)})

    def collect(self):
        self._record("collect", {})
        _items.discard((self._x, self._y))

    # Sensors: they only look, they don't move the player.
    def can_move(self):
        return self._free(*self._ahead())

    def on_item(self):
        return (self._x, self._y) in _items

    def at_goal(self):
        return (self._x, self._y) == _goal


player = _Player()
_output_lines = []

# builtins.print, not print: Pyodide keeps globals between runs, and the
# previous run's print is this override.
import builtins as _builtins
_original_print = _builtins.print


def print(*args, **kwargs):
    import io
    buf = io.StringIO()
    _original_print(*args, file=buf, **kwargs)
    _output_lines.append(buf.getvalue().rstrip('\n'))


def _run(code):
    # The student's code runs in its own namespace, so error line numbers
    # match the editor and it can't trip over the bridge's own names.
    try:
        exec(code, {"__name__": "__main__", "player": player, "print": print})
    except _Stop:
        pass
