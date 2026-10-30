# Schwa

The 44 sounds of English, with the symbols Oxford and Cambridge use, explained from the learner's own language.

**Live:** https://nico-sanchez.github.io/schwa/ — installable as an app on macOS, iOS, Android and Windows, and works offline.

- **Chart:** every phoneme with an isolated recording, a key word, how to make it, a vowel map and the typical mistake for speakers of your language.
- **Transcribe:** type English and see it sound by sound in IPA.
- **Practice:** minimal-pair listening and a game for reading IPA.
- **Record yourself:** compare your attempt with the model by ear and on a spectrogram.
- Interface in English and Spanish. Native-language notes so far: Spanish (Latin America, Spain, Río de la Plata).

## Build

```sh
python3 -I src/build.py src site/schwa.html
```

`site/` is what gets deployed. `src/build.py` injects the data files into `src/template.html` and writes the installable app (`index.html`, `manifest.webmanifest`, `sw.js`) next to it. `src/validate.py src` checks examples and minimal pairs against the dictionary.

To add a native language, add a profile to `src/l1.json` (notes per phoneme, difficulty, priority contrasts); a profile can extend another with `base`.

## Credits

- Isolated sound recordings: [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:IPA_sounds), CC BY-SA 3.0 (Denelson83, Peter Isotalo, Erutuon and others; /dʒ/ is public domain).
- Pronunciations: [Britfone](https://github.com/JoseLlarena/Britfone) by José Llarena, MIT licence (`data/LICENSE.txt`), converted to the Oxford symbol set.
- Icon set in [Gentium Book Plus](https://software.sil.org/gentium/) (SIL Open Font License).
