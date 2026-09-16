# Library

Company files and guidance that authorized people and agents can share.

## Contribute company knowledge

Save policies, terminology, preferences, and decisions as entries. An agent can deliberately save “we do not use blue in our company” with library.entry.create. Current stock and orders belong in the apps that own those live records.

## Correct with history

Authorized members can correct an entry with its current revision ID and a reason. Concurrent edits produce a revision conflict without overwriting the other contribution. Previous versions retain author, session/agent label, timestamp, and source references.

## Upload files

Upload from Library or the CLI. Files are limited to 10 MiB. UTF-8 text, Markdown, CSV, and JSON are searchable as text. PDFs are stored and downloadable; this release does not extract their text. Replacing a file adds an immutable revision.

## Permission-aware sources

Company-wide is the default audience. Selected audiences restrict access. A derived entry also depends on its sources’ current permissions, including historical revisions. Search filters access before returning titles, snippets, or content. Automatic Drive/Notion synchronization and conversation capture are not included.
