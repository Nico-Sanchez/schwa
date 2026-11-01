# Schwa

The 44 sounds of English, with the symbols Oxford and Cambridge use, explained from the learner's own language.

**Live:** https://nico-sanchez.github.io/schwa/ — installable as an app on macOS, iOS, Android and Windows, and works offline.

- **Chart:** every phoneme with a model recording, a key word, how to make it, a vowel map and the typical mistake for speakers of your language.
- **Transcribe:** type English and see it sound by sound in IPA.
- **Practice:** a five-minute daily session, plus minimal pairs, same or different, sentences, IPA dictation, word stress, finding the schwa, weak forms and reading IPA. Rounds never repeat an item, and missed items come back through spaced review.
- **Record yourself:** hear your attempt at the model's volume and get plain-language feedback on fricatives and, after a 10-second calibration, on vowels. The spectrogram stays one tap away.
- Interface in English and Spanish. Native-language notes so far: Spanish (Latin America, Spain, Río de la Plata).

Sound recordings are human and come from several speakers. Words and sentences are read by a voice on the device, which you can pick in the header.

## Build

```sh
python3 -I src/build.py src site/schwa.html
```

`site/` is what gets deployed. `src/build.py` injects the data files into `src/template.html` and writes the installable app (`index.html`, `manifest.webmanifest`, `sw.js`) next to it. `src/validate.py src` checks examples, minimal pairs, sentences and stress words against the dictionary. `node --test tests/*.test.mjs` covers the round scheduler and the audio analysis.

## Audio

`site/audio` holds the sound recordings from Wikimedia Commons; `src/commons.json` lists each source and licence. `src/convert.sh` trims the originals and `src/level.py` brings them all to the same loudness (it needs `scipy` and `ffmpeg`):

```sh
python3 src/level.py site/audio
```

The diphthongs have no recording, so the device voice reads them.

To add a native language, add a profile to `src/l1.json` (notes per phoneme, difficulty, priority contrasts); a profile can extend another with `base`.

## Credits

- Isolated sound recordings: [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:IPA_sounds), CC BY-SA 3.0 (Denelson83, Peter Isotalo, Erutuon and others; /dʒ/ is public domain).
- Pronunciations: [Britfone](https://github.com/JoseLlarena/Britfone) by José Llarena, MIT licence (`data/LICENSE.txt`), converted to the Oxford symbol set.
- Icon set in [Gentium Book Plus](https://software.sil.org/gentium/) (SIL Open Font License).
