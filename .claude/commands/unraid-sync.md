# Unraid Template Sync

Review and update the Unraid Community Applications template.
File location: `unraid/GlucoSense.xml` (gitignored — local only).

## Checklist

Work through each item. Edit `unraid/GlucoSense.xml` for any that are out of date.

### 1. Port mappings
- Read `docker/nginx.conf` for the listening port (default 80 inside container)
- Read `Dockerfile` for any EXPOSE directives
- Confirm the template ContainerPort and HostPort are correct (default host: 3500)

### 2. Environment variables
- Read `.env.example` — every variable must have a corresponding `<Config>` entry in the template
- Check Type is correct: `Variable` for strings, `Path` for file paths, `Port` for ports
- Ensure Default values in template match `.env.example` defaults

### 3. Volume mounts
- Read `docker/entrypoint.sh` and `Dockerfile` for volume paths
- Confirm `/data` maps to `/mnt/user/appdata/glucosense` in template
- Add any new volumes introduced since last sync

### 4. Metadata
- Repository tag matches latest Docker image tag (e.g., `reloadfast/glucosense:latest`)
- Description is current
- Category: `Health`

### 5. Template XML structure reminder
```xml
<?xml version="1.0"?>
<Container>
  <Name>GlucoSense</Name>
  <Repository>reloadfast/glucosense:latest</Repository>
  <Registry/>
  <Network>bridge</Network>
  <Privileged>false</Privileged>
  <Support/>
  <Overview>Personal diabetes predictive intelligence — local CGM analytics and glucose forecasting.</Overview>
  <Category>Health:</Category>
  <WebUI>http://[IP]:[PORT:3500]/</WebUI>
  <TemplateURL/>
  <Icon/>
  <Config Name="Web UI Port" Target="80" Default="3500" Mode="tcp" Description="Web interface port" Type="Port" Display="always" Required="true" Mask="false">3500</Config>
  <Config Name="Data Path" Target="/data" Default="/mnt/user/appdata/glucosense" Mode="rw" Description="Persistent data directory" Type="Path" Display="always" Required="true" Mask="false">/mnt/user/appdata/glucosense</Config>
  <!-- All vars from .env.example go here as Type="Variable" -->
</Container>
```

## After updating

Manually import the updated XML into Unraid CA to verify it parses correctly.
Note any issues found during this sync session.
