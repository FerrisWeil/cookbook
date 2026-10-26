# 0019. Data directory, backups, and permissions

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26, agent chat. Same night: the one env file sits beside the compose file, not in this data directory.

The path default is already in the skeleton. The backup steps are not a script yet. The feature guide writes them.

## Context

[0001](0001-self-host-on-unraid.md) stores state under appdata, usually `/mnt/user/appdata/cookbook`. [0013](0013-security-review.md) says a database password does not protect files on disk, and it names `pg_dump`, mode `0600` for `.env`, and "do not share the data directory." This ADR picks the directory layout and which backup is the one to trust. Detail is in [unraid production](../unraid-production.md).

## Options considered

1. **One `COOKBOOK_DATA_DIR`, default `/mnt/user/appdata/cookbook`, with `pg_dump` as the backup.** Subdirectories for Postgres, each Tailscale state dir, and dump output. The directory is not an SMB or NFS share. The env file is not in this directory. Recommended.
2. **Unraid appdata backup (CA Backup) as the only backup.** One plugin, and a copy of a running Postgres data directory can be corrupt.
3. **Copy `postgres/` while the container is running.** Fast, and unsafe for the same reason.

## Decision

Use option 1.

The one env file is `.env` next to `docker-compose.unraid.yml`. Mode `0600`. Compose Manager and SSH both read it. It is not mounted into a container, and it is not copied into `COOKBOOK_DATA_DIR`.

| Path under `COOKBOOK_DATA_DIR` | What it is |
| --- | --- |
| `postgres/` | Database files. The Postgres image sets the owner on first start. Do not chown it back while the database is running. |
| `tailscale-web/` | Web node state. |
| `tailscale-mcp/` | MCP node state. |
| `backups/` | `pg_dump` output. |

Take `pg_dump -Fc` while Postgres is running. Write a partial file and move it into `backups/` only after `pg_dump` exits 0, mode `0600`, so a failed dump does not erase the previous one. Restore with `pg_restore` into an empty `postgres/` directory after the init script has created the roles. Passwords come from `.env` again. Copy `postgres/` only when the database is stopped. An appdata backup of the whole directory is optional and is a consistent copy only when the stack is stopped.

## Consequences

* The array must be started before this directory exists to write ([0001](0001-self-host-on-unraid.md)).
* Losing a Tailscale directory means logging that node in again. It is not inside the SQL dump. Copying those two directories while the stack is up is fine.
* The feature guide writes the `pg_dump` command. It does not add a cron job.
* Disk encryption for a drive that leaves the house stays the control [0013](0013-security-review.md) already names. This ADR does not turn it on.
