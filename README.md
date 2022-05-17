# logmodmobile-electron
electron.js wrapper for exitB LogModMobile (blisstribute logistic module)

# dev
- node14
- git+https://github.com/ccarnivore/pdf-to-printer.git#master

# autoupdate for dev (UX/UI only)
- copy `dev-app-update.yml.dist` to `dev-app-update.yml` 
- change url to valid endpoint
- change version in `package.json`
- run `npm run build`
- copy over output (exitB* + latest*) to webroot of url above
- start logmod -> Tools -> Auf Updates pruefen

# autoupdate for testing
- `default.json` -> `app.devUpdateServer` -> valid url endpoint 
- run build (see above) and copy output to webroot