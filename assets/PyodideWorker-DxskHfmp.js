const l="https://cdn.jsdelivr.net/pyodide/v0.27.5/full/";let i=null;function s(e){self.postMessage(e)}async function f(){try{i=await(await import(`${l}pyodide.mjs`)).loadPyodide({indexURL:l}),s({type:"ready"})}catch(e){s({type:"error",message:`Nie udało się załadować Pyodide: ${e}`})}}function _(e){return`
import json as _json

_commands = []

class _Player:
    def move(self, direction="forward"):
        _commands.append({"action": "move", "args": {"direction": direction}})

    def move_forward(self):
        self.move("forward")

    def move_back(self):
        self.move("back")

    def turn_left(self):
        _commands.append({"action": "turn", "args": {"direction": "left"}})

    def turn_right(self):
        _commands.append({"action": "turn", "args": {"direction": "right"}})

    def say(self, text):
        _commands.append({"action": "say", "args": {"text": str(text)}})

    def collect(self):
        _commands.append({"action": "collect", "args": {}})

player = _Player()
_level_id = ${e}
_output_lines = []

_original_print = print
def print(*args, **kwargs):
    import io
    buf = io.StringIO()
    _original_print(*args, file=buf, **kwargs)
    _output_lines.append(buf.getvalue().rstrip('\\n'))

`}const y=`
_json.dumps({
    "commands": _commands,
    "output": "\\n".join(_output_lines)
})
`;async function g(e,r){if(!i)throw new Error("Pyodide nie jest gotowe");const o=performance.now(),m=_(r);try{const t=m+e+`
`+y,a=i.runPythonAsync(t),c=new Promise((w,p)=>setTimeout(()=>p(new Error("TIMEOUT: Kod wykonywał się dłużej niż 5 sekund. Sprawdź pętle.")),5e3)),d=await Promise.race([a,c]),n=JSON.parse(d),u=performance.now()-o;return{success:!0,output:n.output,error:null,commands:n.commands,executionTime:u}}catch(t){const a=performance.now()-o;return{success:!1,output:"",error:(t instanceof Error?t.message:String(t)).split(`
`).filter(n=>!n.includes("_commands")&&!n.includes("_Player")).join(`
`),commands:[],executionTime:a}}}self.onmessage=async e=>{const r=e.data;if(r.type==="execute")try{const o=await g(r.code,r.levelId);s({type:"result",data:o})}catch(o){s({type:"error",message:o instanceof Error?o.message:"Unknown error"})}};f();
