# Blind builds: rac-shadow-hide (ff-judge-r2-2)

Each letter keeps only its `.diff` and the files that diff adds or changes. To rebuild a full tree for a letter:

```sh
mkdir work && cd work
bash <repo>/feature-flow-lite/evals/harness/fixtures/setup_react_spectrum.sh b8f8d1d1842ce55063ca67ab3fef7fe172bc3b83
git apply --exclude='bin/*' ../ff-judge-r2-2/rac-shadow-hide/<L>.diff
```

Use `--exclude='bin/*'`: each `.diff` also shows `bin/imports.js`, `bin/pure-render.js` and `bin/useLayoutEffectRule.js` as deleted. The builds didn't delete them. `prepare_blind.py` leaves out every folder named `bin` as build output, and in react-spectrum `bin/` holds the eslint rules. The runs' own `diff.patch` files don't touch `bin/`.

Letters to arms and reps: `20261117-063720-blind-mapping.json` (the top-up reps are numbered 4 and 5).
