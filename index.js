const core = require('@actions/core');
const github = require('@actions/github');
const command = require('@actions/exec');

async function verifyInputs(core,defaultBranch, pullRequestBranch, ghToken){
    console.log('Verify inputs')
    if(!defaultBranch.length) {
        core.setFailed('Default Branch invalid')
    }
    if(!pullRequestBranch.length) {
        core.setFailed('Pull Request Branch invalid')
    }
    if(!ghToken.length) {
        core.setFailed('Token is required')
    }
    return
}

async function getHeadCommit(octokit,github,defaultBranch){
    console.log('Get Head Commit')
    const defaultBranchCommit = await octokit.request(`GET /repos/{owner}/{repo}/commits/${defaultBranch}`, {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo
    })
    return defaultBranchCommit.data.sha
}

async function getPrCommits(octokit,pullRequestBranch){
    console.log('Get Commits from PR')
    const prCommits = await octokit.request(`GET /repos/{owner}/{repo}/commits?sha=${pullRequestBranch}&per_page=100`,{
        owner: github.context.repo.owner,
        repo: github.context.repo.repo
    })

    return prCommits.data.map((c)=> c.sha)
}

async function getAllPrs(octokit,github){
    console.log('Get Prs from repo')
    const resultPRS = await octokit.request(`GET /repos/{owner}/{repo}/pulls`,{
        owner: github.context.repo.owner,
        repo: github.context.repo.repo
    })
    return resultPRS.data.map((p) =>{
        return {
            ref: p.head.ref,
            number: p.number
        }
    })
}

async function createLabels(command){
    console.log('Create labels if not exist')
    await command.exec('gh',['label','create','is-rebased','--description="branch actual is rebased with default branch"','--color=0E8A16','-f'])
    await command.exec('gh',['label','create','not-rebased','--description="branch actual is not rebased with default branch"','--color=B60205','-f'])
    return
}

async function executeVerify(core,command,allCommits,headCommit,pr){
    if (allCommits.includes(headCommit)){
        await command.exec('gh',['pr','edit',`${pr}`,'--add-label="is-rebased"','--remove-label="not-rebased"'])
        core.setOutput('rebased',true)
    }else{
        await command.exec('gh',['pr','edit',`${pr}`,'--add-label="not-rebased"','--remove-label="is-rebased"'])
        core.setOutput('rebased',false)
    }
    return
}

async function setPrNumberOutput(github,core){
    console.log('Set number pr to output')
    const pr = github.context.payload.pull_request.number
    if(github.context.payload.pull_request.number) core.setOutput('pr-number',github.context.payload.pull_request.number)
    return pr
}
async function run(){
    try {
        const eventName = github.context.eventName;
        const defaultBranch = core.getInput('default-branch');
        const pullRequestBranch = core.getInput('pull-request-branch');
        const ghToken = core.getInput('gh-token');
        const reactive = core.getBooleanInput('reactive');
        const octokit = github.getOctokit(ghToken)
        if(eventName == 'pull_request'){
            console.log('Single mode active')
            await verifyInputs(core,defaultBranch,pullRequestBranch,ghToken)
            const headCommit = await getHeadCommit(octokit,github,defaultBranch)
            const allCommits = await getPrCommits(octokit,pullRequestBranch)
            const pr = await setPrNumberOutput(github,core)
            await createLabels(command)
            console.log('Execute verify in PR and set label')
            await executeVerify(core,command,allCommits,headCommit,pr)
            return
        }
        else if(eventName == 'push' && reactive){
            const ref = github.context.ref
            if(ref.includes(defaultBranch)){
                console.log('Reactive mode active')
                if(!defaultBranch.length) {
                    core.setFailed('Default Branch invalid')
                }
                const headCommit = await getHeadCommit(octokit,github,defaultBranch)
                const allPrsBranches = await getAllPrs(octokit,github)
                await createLabels(command)
                console.log('Execute verify if rebased in all prs and set label')
                await Promise.allSettled(allPrsBranches.map(async(branch)=>{
                    const allCommits = await getPrCommits(octokit,branch.ref)
                    await executeVerify(core,command,allCommits,headCommit,branch.number)
                    
                }))

            }
            return
        }else{
            core.warning('Event not accepted without prop reactive in conjunction with branch default')
            
        }
    } catch (error) {
      core.setFailed(error.message);
    }
}

run()