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
    app.log(JSON.stringify(context))
    const params = context.issue({body: `Thank you ${context.payload.pull_request.user.login}!`})

    // Post a comment on the issue
    return context.github.issues.createComment(params)
  })

}
