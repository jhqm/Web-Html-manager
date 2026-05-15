const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function run(command) {
  return execSync(command, { encoding: 'utf8' }).trim()
}

function getVersion() {
  try {
    const tag = run('git describe --tags --abbrev=0')
    const normalizedTag = tag.replace(/^v/, '')
    const headSha = run('git rev-parse --short HEAD')
    const tagCommit = run(`git rev-list -n 1 ${tag}`)
    const headCommit = run('git rev-parse HEAD')
    const dirty = run('git status --porcelain').length > 0

    if (tagCommit === headCommit && !dirty) {
      return normalizedTag
    }

    return `${normalizedTag}-dev.${headSha}${dirty ? '.dirty' : ''}`
  } catch {
    const headSha = run('git rev-parse --short HEAD')
    return `0.0.0-dev.${headSha}`
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
