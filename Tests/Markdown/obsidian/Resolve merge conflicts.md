# Resolve merge conflicts

08 October 2025 10:15

| Column 1 | Column 2 | Column 3 | Column 4 | Column 5 |
| ---: | :--- | ---: | :--- | :--- |
| Class: | Skills for GitHub | Files: |  | [OneDrive folder](https://1drv.ms/f/c/6C8DED377E6CF4C2/Ai4WkYPuiz5Iu9vwvbL-D5w?e=OXY2iA) |
| Topic: | Learn why conflicts happen and how to resolve them. |  |  |  |
| Website: | [https://github.com/skills/resolve-merge-conflicts](https://github.com/skills/resolve-merge-conflicts) |  |  |  |
| Cues Notes What you'll learn? What merge conflicts are, how you resolve merge conflicts, how to reduce merge conflicts. What you'll build? We'll work with a short Markdown resume file in this course. In this course you will: Create a pull request. Resolve a merge conflict. Create a merge conflict. Merge your pull request. What is a merge conflict? A merge conflict occurs when changes are made to the same part of a file on two different branches. You can usually find out about conflicts in a pull request. Where to find merge conflicts? Merge conflicts can be found within pull requests, usually at the bottom of the page. Look for the button 'Resolve conflicts'. Look for the highlighted sections that begins with "<<<<<<< branch-name" and ends with ">>>>>>> main". These markers are added by Git to show you the content that is in the conflict. How to resolve the merge conflict Remove the changes made on the main branch by deleting all of the content below the "=======" and above ">>>>>>> main". Next remove the merge conflict markers by deleting the following lines: <<<<<<< my-resume ======= >>>>>>> main With the merge conflict markers removed, click button 'Mark as resolved'. Finally, click button 'Commit merge'. What happens when you merge a conflict? Resolving a conflict doesn't automatically merge the pull request in GitHub. Instead, it stores the resolution of the conflict in a merge commit and allows you and your team to keep working. To resolve a conflict, GitHub performs what is known as a "reverse merge". This means that the changes from the "main" branch were merged into you "side" branch. With a reverse merge, only the "side" branch is updated. This allows you to test the resolved changes on your branch before you merge it into "main" branch. Creating your own conflict for testing purposes In this activity, you created a conflict on your "side" branch by updating the "references.md" file. Lessons learned: Learned why merge conflicts happen. Learned how to resolve a simple merge conflict. Created a merge conflict of my own and resolved that too. |  |  |  |  |
| Summary |  |  |  |  |
| - GitHub is very helpful in identifying where the merge conflict is on the file and what steps you can take to resolve it. |  |  |  |  |
| - Merge conflicts can become complicated very quickly. |  |  |  |  |
| Study Questions |  |  |  |  |
| - How do you untangle and resolve complicated merge conflicts? |  |  |  |  |

Created with OneNote.