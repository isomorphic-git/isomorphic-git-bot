const { execSync } = require('child_process')
const fs = require('fs')
const formatFiles = require('prettier-standard/src/format-files.js')
const git = require('isomorphic-git')

const debounceMap = new Map()

git.plugins.set('fs', fs)

module.exports = (app) => {
  // Your code here
  app.log('Yay! The app was loaded!')

  const action = async (context) => {
    
    const getAuthToken = async () => {
      // Have to authenticate as the Github App for this API
      const octokitAsApp = await app.auth()
      const installation_id = context.payload.installation.id
      const token = await octokitAsApp.apps.createInstallationToken({ installation_id })
      return token.data.token
    }
    
    app.log(JSON.stringify(context, null, 2))
    
    app.log(`Checking for pre-existing pending onTimeout for ${context.payload.pull_request._links.self.href}`)
    let mytimeout = debounceMap.get(context.payload.pull_request._links.self.href)
    if (mytimeout) {
      app.log(`Canceling the pre-existing pending onTimeout for ${context.payload.pull_request._links.self.href}`)
      clearTimeout(mytimeout)
    }
    
    // Create a new pending action
    const onTimeout = async () => {
      app.log(`onTimeout executing NOW`)
      const url = context.payload.pull_request.head.repo.clone_url
      const ref = context.payload.pull_request.head.ref
      const dir = fs.mkdtempSync('/tmp/clone-')
      app.log(`cloning...`)
      await git.clone({dir, url, ref, singleBranch: true, depth: 1})
      app.log(`organize imports...`)
      const srcPaths = [
        `${dir}/*.js`,
        `${dir}/src/*.js`,
        `${dir}/src/**/*.js`,
        `${dir}/__tests__/*.js`,
        `${dir}/__tests__/**/*.js`
      ]
      execSync(`node ./node_modules/organize-js-imports -maxNamesLength 0 -paths ${srcPaths.join(' ')}`)
      app.log(`formatting files...`)
      await formatFiles(srcPaths)
      app.log(`git status...`)
      let matrix = await git.statusMatrix({dir, pattern: '**/*.js'})
      app.log(`adding changed files...`)
      const FILENAME = 0
      const HEAD = 1
      const WORKDIR = 2
      const STAGE = 3
      let changes = false
      for (let row of matrix) {
        if (row[WORKDIR] !== row[STAGE]) {
          app.log(`modified ${row[FILENAME]}`)
          await git.add({dir, filepath: row[FILENAME]})
          changes = true
        }
      }
      if (!changes) {
        app.log('No changes to push')
        return
      }
      app.log(`commit...`)
      let sha = await git.commit({
        dir,
        message: 'chore: format code with prettier-standard',
        author: {
          name: 'isomorphic-git-bot',
          email: 'wmhilton+isomorphic-git-bot@gmail.com',
        }
      })

      await git.push({
        dir,
        username: 'x-access-token',
        password: await getAuthToken()
      })
      const params = context.issue({body: `Thank you ${context.payload.pull_request.user.login}! I auto-formatted the code using [prettier-standard](https://github.com/sheerun/prettier-standard). :robot:`})

      // Post a comment on the issue
      return context.github.issues.createComment(params)
    }
    
    // Set a timer for 5 seconds //10 minutes
    let id = setTimeout(onTimeout, 5000 /*10 * 60 * 1000*/)
    debounceMap.set(context.payload.pull_request._links.self.href, id)
  }
  
  app.on('pull_request.opened', (context) => {
    app.log(`Oooh! A PR was opened by ${context.payload.pull_request.user.login}!`)
    action(context)
  })

  app.on('pull_request.edited', (context) => {
    app.log(`Ahhh! A PR was edited by ${context.payload.pull_request.user.login}!`)
    action(context)
  })
}
