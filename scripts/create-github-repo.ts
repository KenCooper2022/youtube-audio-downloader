import { createRepository, getAuthenticatedUser } from '../server/github';
import { execSync } from 'child_process';

async function main() {
  try {
    console.log('Getting authenticated user...');
    const user = await getAuthenticatedUser();
    console.log(`Authenticated as: ${user.login}`);

    const repoName = 'youtube-audio-downloader';
    const description = 'YouTube audio downloader with search functionality, MP3 downloads using yt-dlp, and PostgreSQL database storage';

    console.log(`\nCreating repository: ${repoName}...`);
    const repo = await createRepository(repoName, description, false);
    console.log(`Repository created: ${repo.html_url}`);

    console.log('\nAdding remote origin...');
    try {
      execSync('git remote remove origin', { stdio: 'pipe' });
    } catch (e) {
      // Remote might not exist, that's fine
    }
    execSync(`git remote add origin ${repo.clone_url}`, { stdio: 'inherit' });

    console.log('Pushing code to GitHub...');
    execSync('git push -u origin main', { stdio: 'inherit' });

    console.log('\n✓ Success! Your repository is ready at:');
    console.log(repo.html_url);
    console.log('\nYou can clone it with:');
    console.log(`git clone ${repo.clone_url}`);

  } catch (error: any) {
    if (error.status === 422) {
      console.error('Repository already exists. You may need to choose a different name or delete the existing one.');
    } else {
      console.error('Error:', error.message || error);
    }
    process.exit(1);
  }
}

main();
