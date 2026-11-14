"""Critical path of each run: when every subagent started and finished, from the trace.

    python3 phases.py results/<batch>/*/*/rep-*/trace.jsonl
"""
import json,sys
from datetime import datetime
def ts(s): return datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
for path in sys.argv[1:]:
    t0=None; spawns={}; ends={}; order=[]; last=None; main_bash=0; bstart={}
    for line in open(path):
        try: e=json.loads(line)
        except: continue
        if e.get('timestamp'):
            t=ts(e['timestamp']); t0=t0 or t; last=t
        if e.get('type')=='assistant' and not e.get('parent_tool_use_id'):
            for c in e['message'].get('content',[]):
                if c.get('type')=='tool_use' and c['name']=='Agent':
                    spawns[c['id']]=(ts(e['timestamp']), (c['input'].get('subagent_type') or '').split(':')[-1], c['input'].get('description',''))
                    order.append(c['id'])
                if c.get('type')=='tool_use' and c['name']=='Bash': bstart[c['id']]=(ts(e['timestamp']),c['input'].get('command',''))
        if e.get('type')=='user' and not e.get('parent_tool_use_id') and isinstance(e['message'].get('content'),list):
            for c in e['message']['content']:
                if isinstance(c,dict) and c.get('tool_use_id') in bstart:
                    s,cmd=bstart.pop(c['tool_use_id']); main_bash+=ts(e['timestamp'])-s
        if e.get('type')=='system' and e.get('subtype')=='task_notification' and e.get('tool_use_id') in spawns:
            ends[e['tool_use_id']]=ts(e.get('timestamp') or '1970-01-01T00:00:00Z') if e.get('timestamp') else last
    print('==',path.split('/')[1],path.split('/')[2], f'total {(last-t0)/60:.1f} min, orchestrator foreground bash {main_bash/60:.1f} min')
    busy=0
    for i in order:
        s,role,d=spawns[i]; en=ends.get(i)
        dur=(en-s)/60 if en else float('nan'); busy+=dur if en else 0
        print(f'  {(s-t0)/60:5.1f}–{((en or s)-t0)/60:5.1f}  {dur:5.1f}m  {role:<17} {d[:45]}')
