# Blind copies for rac-shadow-hide (newarms-2)

This archive keeps only each letter's `<letter>.diff` and the files that diff touches, as they stand
in the build (`rac-shadow-hide/<letter>/...`). The full workspaces (a react-spectrum checkout with
about 1 GB of node_modules) are left out. The letter -> arm mapping is in `../blind-mapping.json`
next to this archive. Don't open it before judging.

To rebuild a letter's full tree:

```sh
mkdir rac-<letter> && cd rac-<letter>
bash <harness>/fixtures/setup_react_spectrum.sh b8f8d1d1842ce55063ca67ab3fef7fe172bc3b83
git apply --exclude='bin/*' <path>/ff-judge-n2/rac-shadow-hide/<letter>.diff
```

Use `--exclude='bin/*'`. Every `.diff` also deletes `bin/imports.js`, `bin/pure-render.js` and
`bin/useLayoutEffectRule.js` (the repo's custom eslint rules). No build deleted those files.
`prepare_blind.py` lists `bin` among its build-output folders, so the blind copy left them out, and
the diff it wrote shows them as deleted. Each build's real change is in
`<scenario>/<arm>/rep-N/diff.patch`, which doesn't touch `bin/`. All ten diffs apply cleanly to
b8f8d1d with that exclude (checked with `git apply --check`).

If you run `yarn install` in a rebuilt tree, it re-applies the repo's `@mdx-js/react` patch-package
patch to the copied node_modules. That duplicates `import {JSX}` in
`node_modules/@mdx-js/react/lib/index.d.ts` and breaks `yarn check-types`. Delete the duplicate line
if that happens.
