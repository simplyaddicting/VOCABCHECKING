# Vocabulary Check

A timed, self-grading vocabulary quiz for classroom use. Static site — no build step, no backend required.

## Files

- `index.html` — page structure (splash, quiz, results, import modal)
- `styles.css` — all styling
- `script.js` — app logic (timer, parsing, grading)

## Running it locally in VS Code

Just open `index.html` in a browser, or use the "Live Server" VS Code extension for auto-reload while you edit.

## Publishing on GitHub Pages

1. Create a new GitHub repo and push these three files to it (e.g. on the `main` branch, at the repo root).
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)`.
4. Save. After a minute, your site will be live at `https://<your-username>.github.io/<repo-name>/`.
5. Any time you push changes to `main`, the live site updates automatically within a minute or two.

## Loading today's word list

Click the small **"⚙ Teacher: load today's words"** link on the splash screen before class. You can either paste a list directly or upload a `.txt`/`.csv` file in the same format — both load into the browser tab for that session (nothing is saved between page reloads yet, so do this fresh each class).

### Format

One word per line:

```
word | meaning | synonym1, synonym2 | antonym1, antonym2
```

Separate multiple accepted synonyms or antonyms with commas.

### Words with missing fields

Not every word needs all three parts. Leave a field blank but **keep the pipes** so the line still has 4 parts:

```
ephemeral | lasting for a very short time | fleeting, transient | permanent, enduring
mirth | great amusement or laughter | |
stoic | | unaffected, unemotional | emotional, reactive
```

`mirth` only asks for a meaning. `stoic` only asks for synonyms and antonyms, no meaning. The quiz and grading automatically skip whatever a word doesn't have — students won't see an input box for a part that isn't being tested, and it won't count toward the total score.

A line is skipped if the word is missing, or if all three of meaning/synonyms/antonyms are blank.

## Grading logic

- **Meaning** is checked by keyword overlap rather than exact wording: if a student's answer shares at least 40% of the meaningful words in the correct definition, it's marked correct. This is intentionally lenient since meanings can be phrased many ways.
- **Synonyms/antonyms** are checked against the accepted list you provide. A student's answer is correct if it matches any one accepted word (comma-separate if you want to allow several attempts in one box).

If the grading feels too strict or too lenient once you've tried it with real students, the thresholds live in `script.js` inside `gradeMeaning` (the `0.4` ratio) and `matchAny`.

## Logo

A logo (`logo.png`) is already wired into the quiz and results screens via `.footer-logo` in `styles.css`. To swap it for a different image later, just replace `logo.png` with your new file (same filename), or change the `src` in `index.html` if you rename it. The image displays at a fixed height of 40px and keeps its own aspect ratio automatically.

## Storing results beyond the screen

Right now, results only display on screen for each student (as requested for this first version). There's a clearly marked spot in `script.js`, inside the `submitQuiz` function, with a commented-out example `fetch()` call — that's where a real server call should go once a backend for storing results is ready.
