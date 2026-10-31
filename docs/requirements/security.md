## N1 Security

N1.1 The public repo contains no secret, recipe, or personal note.
- N1.1.1 CI rejects a secret in the tree. [Proposed]
- N1.1.2 A demo, fixture, or doc uses no real recipe, note, token, or tailnet name. [Proposed]
- N1.1.3 A stand-in title starts with `Example:`. [Proposed]

N1.2 The database stays unpublished.
- N1.2.1 The database is not on a published port. [Proposed]

N1.3 Database roles stay separate.
- N1.3.1 The request role cannot change the schema. [Proposed]
- N1.3.2 The migrator is a different role. [Proposed]
- N1.3.3 The image superuser is used only to initialize the database. [Proposed]

N1.4 Every pull request is checked against the security checklist.
- N1.4.1 The check happens before the pull request is marked ready. [Proposed]
- N1.4.2 The pull request records a security finding only when there is one. [Proposed]

N1.5 A local stack may boot with a documented token.
- N1.5.1 That token is not a secret. [Proposed]
- N1.5.2 The NAS rejects that token. [Proposed]

N1.6 v1 does not authenticate household users.
- N1.6.1 v1 has no household login. [Proposed]
- N1.6.2 The API does not require a shared secret. [Proposed]
