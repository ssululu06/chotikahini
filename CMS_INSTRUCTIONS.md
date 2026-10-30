# Story Publishing Panel (CMS) Instructions

This project includes a built-in, mobile-first CMS located at `/admin/`. This panel allows you to write, edit, save drafts, and publish stories directly to your GitHub repository, automatically triggering a Vercel deployment.

## 1. Environment Setup

To use the CMS on production (or locally), you must add the following Environment Variables in your Vercel Project Settings (**Settings > Environment Variables**):

- `ADMIN_USERNAME`: Your chosen admin username to log in.
- `ADMIN_PASSWORD`: Your secret password to log in.
- `GITHUB_TOKEN`: A Personal Access Token (PAT) from your GitHub account. It must have at least `repo` permissions to allow the CMS to read/write files to the repository.
- `GITHUB_OWNER`: Your GitHub username (e.g., `yourusername`).
- `GITHUB_REPO`: `chotikahini`
- `GITHUB_BRANCH`: `main`

## 2. Using the CMS

1. **Log In:** Go to `https://yourwebsite.com/admin` and enter the `ADMIN_USERNAME` and `ADMIN_PASSWORD` you configured in Vercel.
2. **Dashboard:** Here you can see your published stories (loaded from the website) and any drafts you have saved (loaded from GitHub).
3. **Write a Story:** Click **New Story**. You can select the author and category, type tags, and paste a cover image URL.
4. **Formatting:** The text editor automatically formats your paragraphs. Just press `Enter` to start a new paragraph. You do not need to write raw MDX or YAML frontmatter; the CMS handles all of this automatically.
5. **Save Draft:** Clicking **Save Draft** will push the story to the `content/drafts` directory in your GitHub repo. It won't be visible to your readers, but you can come back and edit it later.
6. **Publish:** Clicking **Publish** will push the story directly to `content/posts/` on your GitHub repo. Vercel will detect this change and automatically deploy your new story in seconds!

## 3. Editing Existing Stories

To edit a published story, simply go to the Dashboard, find the story in the list, and click **Edit**. After making your changes, click **Publish** to push the updated MDX file to GitHub.
