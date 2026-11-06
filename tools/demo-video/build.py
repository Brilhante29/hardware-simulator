"""Junta os clipes de out/ em docs/media/hardware-studio-apresentacao.mp4 com transições."""
import subprocess, glob, os
here = os.path.dirname(os.path.abspath(__file__))
clips = sorted(glob.glob(os.path.join(here, 'out', '0*.mp4')))
dur = [float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', c])) for c in clips]
F = 0.6; args = ['ffmpeg', '-y', '-loglevel', 'error']
for c in clips: args += ['-i', c]
fc = []; prev = '[0:v]'; acc = dur[0]
for i in range(1, len(clips)):
    fc.append(f'{prev}[{i}:v]xfade=transition={"slideleft" if i % 2 else "fadeblack"}:duration={F}:offset={acc - F:.3f}[v{i}]')
    prev = f'[v{i}]'; acc += dur[i] - F
fc.append(f'{prev}fade=t=in:st=0:d=0.5,fade=t=out:st={acc - 0.8:.3f}:d=0.8,format=yuv420p[vout]')
out = os.path.join(here, '..', '..', 'docs', 'media', 'hardware-studio-apresentacao.mp4')
args += ['-filter_complex', ';'.join(fc), '-map', '[vout]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-movflags', '+faststart', out]
subprocess.check_call(args); print(f'{out}: {acc:.1f}s')
