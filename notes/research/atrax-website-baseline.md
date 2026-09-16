# Atrax website reference before the next design decision

Recorded September 16, 2026. This is local history and the user's stated direction, not the final design brief.

## The earlier hero

The earlier homepage used a centered, full-height hero. Its title was "A cloud for everyone." A short explanation and copyable command followed directly below. The capability rail stayed compact. The layout was a single reading path, rather than copy on one side and an architectural image on the other.

Sources: [earlier homepage](https://github.com/rishabhsai/atrax/blob/8caf3b0/app/page.tsx), [earlier hero styles](https://github.com/rishabhsai/atrax/blob/8caf3b0/app/globals.css).

Several versions of the copy action existed. One copied a command that retrieved the agent reference. A later version copied an npm creation command. The user now explicitly prefers a plain-English agent prompt as the primary action, with CLI setup alongside it.

Sources: [agent reference copy action](https://github.com/rishabhsai/atrax/blob/f5c19dc/app/components/AgentCommand.tsx), [npm copy action](https://github.com/rishabhsai/atrax/blob/29a3d54/app/components/AgentCommand.tsx).

The old hero also described a retired anonymous deployment and claim-token flow. Its layout is a useful reference; those obsolete behavior claims are not part of the requested restoration.

## User direction

- Restore the earlier straightforward hero and prominent copy action.
- Use tree-like imagery or branches entering from the sides, leaving the central words readable.
- Remove eyebrow headings.
- Describe platform capabilities broadly. The user marked inventory reservation and brand-preference examples as too specific for the main capability descriptions.
- Shared context includes company knowledge. Shared secrets also includes actual API keys and credentials, as explicitly confirmed.
- Investigate `atrax.run/agents.md` for agent instructions and `atrax.run/agents.sh` for CLI and Atrax skill installation.
- Research other companies first. Use YC's directory to choose relevant references and inspect their first-party sites before designing another version.

## Decision record

The canonical [website and onboarding map](https://github.com/rishabhsai/atrax/issues/19) holds the research and design decisions. Its children hold the detailed evidence and later user choices. No public-site code changes or deployment are part of this research turn.
