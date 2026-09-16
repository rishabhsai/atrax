# Issue tracker

Tickets live in GitHub Issues at `rishabhsai/atrax`. The user approved the launch's twelve-ticket breakdown and GitHub publication on September 15, 2026.

Use native blocking relationships. Implementation tickets also list blockers in the issue body; wayfinding tickets follow the format below. Work only tickets whose blockers are complete. The local launch index records issue numbers for coordination; GitHub is the tracker.

PRs as a request surface: off.

## Wayfinding operations

A map is an issue labelled `wayfinder:map`. Its decision tickets are native GitHub sub-issues, labelled `wayfinder:research`, `wayfinder:grilling`, `wayfinder:prototype`, or `wayfinder:task`. Refer to each issue by its linked title in human-facing notes.

- List children with `gh api repos/rishabhsai/atrax/issues/MAP_NUMBER/sub_issues --paginate`.
- Add a child with `POST /repos/rishabhsai/atrax/issues/MAP_NUMBER/sub_issues` and its numeric database `sub_issue_id`.
- Use native `dependencies/blocked_by` relationships for blockers. Query each child's blockers and their current states when finding the frontier. A frontier ticket is open, unassigned, and has no open blockers.
- Claim before work with `gh issue edit NUMBER --repo rishabhsai/atrax --add-assignee rishabhsai`. Assignment is the claim.
- Keep the question in the ticket body. Put the answer in a resolution comment using `--body-file`, then close the ticket.
- The coordinator owns tracker writes and the map index. Research agents return findings from isolated `research/<name>` branches; the coordinator publishes them and records linked resolution comments.
- Fetch the latest map body before appending a closed ticket's linked title and one-line gist to Decisions so far. Detailed evidence stays in that ticket and its linked research note.
- Keep implementation tickets outside the map unless its Notes explicitly include execution.
