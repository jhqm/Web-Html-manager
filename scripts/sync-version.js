const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const BASE_VERSION = '1.0.0'

function run(command) {

  return execSync(command, { encoding: 'utf8' }).trim()
}

function getVersion() {
  let headSha = 'nogit'
  let dirty = false

  try {
    headSha = run('git rev-parse --short HEAD')
    dirty = run('git status --porcelain').length > 0
  } catch {
    return `${BASE_VERSION}-dev.nogit`
  }

  try {
    const tag = run('git describe --tags --abbrev=0')
    const normalizedTag = tag.replace(/^v/, '')
    const tagCommit = run(`git rev-list -n 1 ${tag}`)
    const headCommit = run('git rev-parse HEAD')

    if (tagCommit === headCommit && !dirty) {
      return normalizedTag
    }

    return `${normalizedTag}-dev.${headSha}${dirty ? '.dirty' : ''}`
  } catch {
    return `${BASE_VERSION}-dev.${headSha}${dirty ? '.dirty' : ''}`
  }
}


function updatePackageVersion(nextVersion) {
  const pkgPath = path.join(__dirname, '..', 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  pkg.version = nextVersion
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
}

const version = getVersion()
updatePackageVersion(version)
console.log(`[sync:version] package.json version => ${version}`)
