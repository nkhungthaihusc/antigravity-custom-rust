"""Prepare user-supplied audio locally. Requires imageio-ffmpeg (build-time only)."""
import argparse, subprocess
from pathlib import Path
import imageio_ffmpeg

parser=argparse.ArgumentParser()
parser.add_argument('--music',required=True)
parser.add_argument('--login-video',required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
target=root/'src/renderer/audio';target.mkdir(parents=True,exist_ok=True)
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
def render(source,output,filters,duration=None):
    cmd=[ffmpeg,'-hide_banner','-loglevel','error','-y','-i',source,'-vn']
    if duration:cmd+=['-t',str(duration)]
    cmd+=['-af',filters,'-ar','44100','-ac','2','-c:a','libmp3lame','-b:a','192k','-map_metadata','-1',str(target/output)]
    subprocess.run(cmd,check=True)
# A short login cue: opening Link Start + connection rise, omit the menu/demo tail.
render(args.login_video,'sao-link-start.mp3','highpass=f=70,loudnorm=I=-18:TP=-2:LRA=7,afade=t=in:d=0.025,afade=t=out:st=4.2:d=0.6',4.8)
# Normalize the full track; a quiet onset avoids a jump when the session player starts.
render(args.music,'swordland.mp3','loudnorm=I=-21:TP=-2:LRA=9,afade=t=in:d=1.5')
print('Prepared Swordland and 4.8-second login cue (44.1 kHz stereo, 192 kbps).')
