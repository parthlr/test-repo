import { Octokit, App } from "octokit";
import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device";
import fs from 'fs/promises';
import path from 'path';
import { globby } from 'globby';

/*const auth = createOAuthDeviceAuth({
    clientType: "oauth-app",
    clientId: "",
    scopes: ["public_repo"],
    onVerification(verification) {
  
      console.log("Open %s", verification.verification_uri);
      console.log("Enter code: %s", verification.user_code);
    },
  });
  
  const tokenAuthentication = await auth({
    type: "oauth",
  });

  console.log(tokenAuthentication);*/

const authenticateUser = (auth_key) => {
    const client = new Octokit({ auth: auth_key });
    return client;
};

const getUser = async (client) => {
    const authenticated_user = await client.rest.users.getAuthenticated();
    return authenticated_user.data.login;
}

const createNewRepository = async (client, user, name) => {
    const repos = await client.rest.repos.listForUser({ username: user });

    if (!repos.data.map((repo) => repo.name).includes(name)) {
        console.log("Repo " + name + " doesn't exist");
        console.log("Creating repo " + name + "...");
        await client.rest.repos.createForAuthenticatedUser({
            name: name,
            auto_init: true
        });
        console.log("Created repo " + name);
    } else {
        console.log("Repo " + name + " already exists");
    }
}

const getLatestCommit = async (client, user, repository, branch) => {
    const headRef = await client.rest.git.getRef({
        owner: user,
        repo: repository,
        ref: `heads/${branch}`
    });
    
    const latestCommit = await client.rest.git.getCommit({
        owner: user,
        repo: repository,
        commit_sha: headRef.data.object.sha
    });

    return latestCommit;
}

const createFileBlob = async (client, user, repository, filePath) => {
    const fileContent = await fs.readFile(filePath, { encoding: 'utf-8' });
    
    const newBlob = await client.rest.git.createBlob({
        owner: user,
        repo: repository,
        content: fileContent,
        encoding: 'utf-8'
    });

    return newBlob;
}

const createNewTree = async (client, user, repository, files, parentSha) => {
    const blobs = await Promise.all(files.map((filePath) => createFileBlob(client, user, repository, filePath)));
    const fileTree = blobs.map((blob, index) => {
        const file = files[index];
        return {
            path: file,
            mode: '100644',
            type: 'blob',
            sha: blob.data.sha
        }
    });

    const tree = await client.rest.git.createTree({
        owner: user,
        repo: repository,
        tree: fileTree,
        base_tree: parentSha
    });

    return tree;
}

const commitFiles = async (client, user, repository, commitMessage, tree, latestCommit) => {
    const commit = await client.rest.git.createCommit({
        owner: user,
        repo: repository,
        message: commitMessage,
        tree: tree.data.sha,
        parents: [latestCommit.data.sha]
    });

    return commit;
}

const updateBranchHeadRef = async (client, user, repository, branch, latestCommit) => {
    const newHeadRef = await client.rest.git.updateRef({
        owner: user,
        repo: repository,
        ref: `heads/${branch}`,
        sha: latestCommit.data.sha
    });

    return newHeadRef;
}

const getCommitContent = async (client, user, repository, file, commit) => {
    const commitContent = await client.rest.repos.getContent({
        owner: user,
        repo: repository,
        path: file,
        ref: commit
    });

    return atob(commitContent.data.content);
}

// 
const client = authenticateUser('');
const user = await getUser(client);
console.log("Hello, %s", user);

const repository = 'test-repo';
const branch = 'master';
//await createNewRepository(client, user, repository);

const latestCommit = await getLatestCommit(client, user, repository, branch);
//console.log(latestCommit);

//const blob = await createFileBlob(client, user, repository, '');
//console.log(blob);

const saveFolder = 'test_files';
const files = await globby(`**/${saveFolder}/**/*`);
console.log(files);
const tree = await createNewTree(client, user, repository, files, latestCommit.data.tree.sha);
//console.log(tree);

const newCommit = await commitFiles(client, user, repository, 'Test file upload', tree, latestCommit);
//console.log(newCommit);

const newBranchHead = await updateBranchHeadRef(client, user, repository, branch, newCommit);
//console.log(newBranchHead);

const commit = await getCommitContent(client, user, repository, 'test_files/test_file1.txt', '7c3261f');
console.log(commit); 

// Create a personal access token at https://github.com/settings/tokens/new?scopes=repo
/*const octokit = new Octokit({ auth: '' });

// Compare: https://docs.github.com/en/rest/reference/users#get-the-authenticated-user
const authenticated_user = await octokit.rest.users.getAuthenticated();
/*const {
  data: { login },
} = await octokit.rest.users.getAuthenticated();
console.log("Hello, %s", authenticated_user.data.login);*/
