const fs = require('fs')
const formatFiles = require('prettier-standard/src/format-files.js')
const git = require('isomorphic-git')
git.plugins.set('fs', fs)

module.exports = (app) => {
  // Your code here
  app.log('Yay! The app was loaded!')

  // example of probot responding 'Hello World' to a new issue being opened
  app.on('issues.opened', async context => {
    // `context` extracts information from the event, which can be passed to
    // GitHub API calls. This will return:
    //   {owner: 'yourname', repo: 'yourrepo', number: 123, body: 'Hello World!}
    const params = context.issue({body: 'Hello World!'})

    // Post a comment on the issue
    return context.github.issues.createComment(params)
  })
  
  // example of probot responding 'Hello World' to a new PR being opened
  app.on('pull_request.opened', async context => {
    app.log(`Oooh! A PR was opened by ${context.payload.pull_request.user.login}!`)
    // `context` extracts information from the event, which can be passed to
    // GitHub API calls. This will return:
    //   {owner: 'yourname', repo: 'yourrepo', number: 123, body: 'Hello World!}
    app.log(JSON.stringify(context, null, 2))
    const url = context.payload.pull_request.head.repo.clone_url
    const ref = context.payload.pull_request.head.ref
    const dir = fs.mkdtempSync('/tmp/clone-')
    await git.clone({dir, url, ref, singleBranch: true, depth: 1})
    let files = await git.listFiles({dir})
    await formatFiles([
      `${dir}/*.js`,
      `${dir}/src/*.js`,
      `${dir}/src/**/*.js`,
      `${dir}/__tests__/*.js`,
      `${dir}/__tests__/**/*.js`
    ])
    let matrix = await git.statusMatrix({dir, pattern: '**/*.js'})
    const FILENAME = 0
    const HEAD = 1
    const WORKDIR = 2
    const STAGE = 3
    let changes = false
    for (let row of matrix) {
      if (row[WORKDIR] !== row[STAGE]) {
        await git.add({dir, filepath: row[FILENAME]})
        changes = true
      }
    }
    if (!changes) return
    await git.commit({
      dir,
      message: 'format code with prettier-standard',
      author: {
        name: 'isomorphic-git[bot]',
        email: 'bot@isomorphic-git.org',
      }
    })
    const params = context.issue({body: `Thank you ${context.payload.pull_request.user.login}! ${JSON.stringify(files, null, 2)}`})

    // Post a comment on the issue
    return context.github.issues.createComment(params)
  })

}
