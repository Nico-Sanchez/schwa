#!/bin/zsh
src=$1; dst=$2
for f in $src/*.ogg; do
  s=$(basename $f .ogg); out=$dst/$s.mp3
  [ -s $out ] && continue
  [ $(stat -f %z $f) -lt 1000 ] && continue
  ffmpeg -v error -y -i $f -ac 1 -ar 44100 -af "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,adelay=40,apad=pad_dur=0.08,loudnorm=I=-17:TP=-1.5:LRA=11" -codec:a libmp3lame -b:a 64k $out && echo "$s $(ffprobe -v error -show_entries format=duration -of csv=p=0 $out)"
done
