# logmodmobile-electron
electron.js wrapper for exitB LogModMobile (blisstribute logistic module)

# dev
- using electron ^30.5.1 equals modules version 123 which is hard coded by now, regardless the locally installed nodejs/electron version 

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

https://github.com/thiagoelg/node-printer/issues/45#issuecomment-1141526189

node-printer prebuild downloaded from
https://github.com/grandchef/node-printer/releases/tag/v0.8.0
https://releases.electronjs.org/releases.json