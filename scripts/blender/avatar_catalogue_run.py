"""One bounded isolated Blender invocation, with exact process receipts.

Start from repository root: python scripts/blender/avatar_catalogue_run.py
No retries; stdout/stderr and timeout/exit are retained in ignored evidence.
"""
from pathlib import Path
import json
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'odd/artifacts/avatar-customization/catalogue'
COMMAND = ['D:/Descargas App/Blender/blender.exe','--background','--factory-startup',
           '--python-exit-code','1','--python',str(ROOT/'scripts/blender/avatar_catalogue.py')]


def run():
    OUT.mkdir(parents=True,exist_ok=True)
    receipt = OUT/'invocation.json'
    assert not receipt.exists(), 'One invocation only: previous receipt exists'
    data = {'command':COMMAND,'command_display':subprocess.list2cmdline(COMMAND),
            'cwd':str(ROOT),'timeout_seconds':1200,'status':'running'}
    receipt.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
    started = time.monotonic()
    with (OUT/'stdout.log').open('x',encoding='utf-8') as stdout, (OUT/'stderr.log').open('x',encoding='utf-8') as stderr:
        try:
            result = subprocess.run(COMMAND,cwd=ROOT,stdout=stdout,stderr=stderr,timeout=1200,check=False)
            data.update(status='exited',exit_code=result.returncode)
        except subprocess.TimeoutExpired:
            data.update(status='timed-out',exit_code=None)
        except OSError as error:
            data.update(status='launch-failed',exit_code=None,error=str(error))
    data['elapsed_seconds'] = time.monotonic()-started
    receipt.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
    return data.get('exit_code') if data.get('exit_code') is not None else 1


if __name__=='__main__':
    sys.exit(run())
