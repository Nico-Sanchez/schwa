# Schwa

The 44 sounds of English, with the symbols Oxford and Cambridge use, explained from the learner's own language.

**Live:** https://nico-sanchez.github.io/schwa/ — installable as an app on macOS, iOS, Android and Windows, and works offline.

- **Chart:** every phoneme with a model recording, a key word, how to make it, a vowel map and the typical mistake for speakers of your language.
- **Transcribe:** type English and see it sound by sound in IPA.
- **Practice:** a five-minute daily session, plus minimal pairs, same or different, sentences, IPA dictation, word stress, finding the schwa, weak forms and reading IPA. Rounds never repeat an item, and missed items come back through spaced review.
- **Record yourself:** hear your attempt at the model's volume and get plain-language feedback on fricatives and, after a 10-second calibration, on vowels. The spectrogram stays one tap away.
- Interface in English and Spanish. Native-language notes so far: Spanish (Latin America, Spain, Río de la Plata).

One synthetic voice reads every sound, word and sentence, so comparisons always have the same speaker at the same volume. Only text typed into Transcribe falls back to a voice on the device.

## Build

```sh
python3 -I src/build.py src site/schwa.html
```

`site/` is what gets deployed. `src/build.py` injects the data files into `src/template.html` and writes the installable app (`index.html`, `manifest.webmanifest`, `sw.js`) next to it. `src/validate.py src` checks examples, minimal pairs, sentences and stress words against the dictionary. `node --test tests/` covers the round scheduler and the audio analysis.

## Audio

`src/voice.py` generates every clip in `site/audio` with [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M), reading the app's own transcriptions so the audio always matches the IPA on screen. It needs `kokoro-onnx`, `scipy` and `ffmpeg`, plus `kokoro-v1.0.onnx` and `voices-v1.0.bin` in a model folder:

```sh
python3 src/voice.py <model-folder> src site
```

It skips clips that already exist; pass `--force` to regenerate them. Run it after adding pairs, sentences or words, then rebuild.

To add a native language, add a profile to `src/l1.json` (notes per phoneme, difficulty, priority contrasts); a profile can extend another with `base`.

## Credits

- Voice: [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) by hexgrad, Apache 2.0.
- Pronunciations: [Britfone](https://github.com/JoseLlarena/Britfone) by José Llarena, MIT licence (`data/LICENSE.txt`), converted to the Oxford symbol set.
- Icon set in [Gentium Book Plus](https://software.sil.org/gentium/) (SIL Open Font License).
