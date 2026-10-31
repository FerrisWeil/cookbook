# Security

Category N1. Status: Proposed.

Drawn from the accepted security decisions. Each statement stays Proposed until Taylor accepts it.

## N1.1 Public repo

Status: Proposed.

The public repo contains no secret, recipe, or personal note.

### N1.1.1 Scan

Status: Proposed.

CI rejects a secret in the tree.

### N1.1.2 Demos

Status: Proposed.

A demo, fixture, or doc uses no real recipe, note, token, or tailnet name. A stand-in title starts with `Example:`.

## N1.2 Database

Status: Proposed.

The database is not on a published port.

## N1.3 Roles

Status: Proposed.

The request role cannot change the schema. The migrator is a different role. The image superuser is used only to initialize the database.

## N1.4 Checklist

Status: Proposed.

Every pull request is checked against the security checklist before it is marked ready.

### N1.4.1 Findings

Status: Proposed.

The pull request records a security finding only when there is one.

## N1.5 Local token

Status: Proposed.

A documented token that is not a secret may boot a local stack. The NAS rejects that token.
