const Git = require('simple-git/promise')
const path = require('path')
const URL = require('url')
const shell = require('shelljs')
const yaml = require('js-yaml')
const fs = require('fs')
const gitToken = process.env.GITHUB_TOKEN || console.error('No github token provided')
const gitUrl = process.env.REPO_URL || console.error('No repo url provided')
const rootTempDirectory = '.'
const directory = path.join(rootTempDirectory, path.basename(gitUrl, '.git'))
const branch = process.env.GIT_BRANCH || 'master'

const skipUpdateConfig = Boolean(process.env.SKIP_UPDATE_CONFIG)

let authUrl = URL.parse(gitUrl)
authUrl.auth = gitToken + ':x-oauth-basic'
authUrl = URL.format(authUrl)
shell.rm('-rf', directory)
shell.mkdir('-p', directory)
const git = Git(directory)

const gitClone = async () => {
    try {
        await git.clone(authUrl, rootTempDirectory, ['--branch', branch || 'master'])
        console.log('Git cloned', gitUrl)
    } catch (err) {
        console.error('Error with git clone:', err)
        throw err
    }
}

const gitCommitAndPush = async () => {
    try {
        await git.add('.')
        let status = await git.status()
        console.log(status.files)
        await git.commit('Updated with new files')
        console.log('Git committed')
        await git.push('origin', branch)
        console.log('Git pushed')
    } catch (err) {
        console.error('Error with commiting new files:', err)
        throw err
    }
}

const updateOrderInConfig = async (newDirectories) => {
    // Sort new file names in order of recency
    const sortedDirectoryPaths = newDirectories.sort((a, b) => {
        return b.date - a.date
    }).map(a => a.directoryName)
    try {
        const configJson = yaml.safeLoad(fs.readFileSync(path.join(directory, '_config.yml'), 'utf8'))
        let documentOrder = configJson['document_order']
        if (!documentOrder) {
            documentOrder = []
        }
        configJson['document_order'] = sortedDirectoryPaths.concat(documentOrder)
        console.log(configJson)
        const configYaml = yaml.safeDump(configJson)
        fs.writeFileSync(path.join(directory, '_config.yml'), configYaml, 'utf8')
        console.log('_config.yml updated')
    } catch (err) {
        console.error('Error with updating _config.yml', err)
        throw err
    }
}

const updateGitRepoWithNewFiles = async (newFiles) => {
    try {
        if (!skipUpdateConfig) {
            await updateOrderInConfig(newFiles)
        }
        await gitCommitAndPush()
    } catch (err) {
        throw err
    }
}

module.exports = {
    directory,
    updateGitRepoWithNewFiles,
    gitClone,
}
