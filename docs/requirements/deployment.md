# Deployment

Category S1. Status: Proposed.

Drawn from the accepted hosting decisions. Each statement stays Proposed until Taylor accepts it.

## S1.1 NAS

Status: Proposed.

Production is one Compose stack on the household Unraid NAS.

### S1.1.1 Images

Status: Proposed.

The NAS runs images built elsewhere. It does not compile the app.

### S1.1.2 Ports and defaults

Status: Proposed.

Production publishes no host ports and has no default secret.

## S1.2 Tailnet

Status: Proposed.

The household reaches the app only over the tailnet.

### S1.2.1 Identities

Status: Proposed.

The app and the MCP server are separate tailnet identities.

### S1.2.2 Grants

Status: Proposed.

Family devices can open the app. The bot can open the MCP server only.

### S1.2.3 Public ingress

Status: Proposed.

There is no public ingress. Funnel is off.

### S1.2.4 Local stack

Status: Proposed.

A local stack may publish ports. That path is not how the household reaches production.

### S1.2.5 Tailnet HTTPS

Status: Proposed.

Tailnet HTTPS is off.

## S1.3 Backups

Status: Proposed.

Backups are logical dumps of the running database.

### S1.3.1 Hidden rows

Status: Proposed.

A dump includes a deleted recipe.

## S1.4 Updates

Status: Proposed.

An update does not start until a dump of the current database has been taken. Nothing pulls new images on its own.

## S1.5 Shape

Status: Proposed.

v1 is the web app, the API, Postgres, and one cookbook MCP. Chef is outside this repo.
