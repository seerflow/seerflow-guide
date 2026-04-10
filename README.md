# Seerflow Guide

Comprehensive documentation for [Seerflow](https://github.com/seerflow/seerflow) — a streaming, entity-centric log intelligence agent.

**Live site:** [docs.seerflow.dev](https://docs.seerflow.dev)

## Local Development

```bash
pip install -r requirements.txt
mkdocs serve
```

Open [http://localhost:8000](http://localhost:8000).

## Build

```bash
mkdocs build --strict
```

## Publishing a new version

The Seerflow Guide uses [`mike`](https://github.com/jimporter/mike) for multi-version documentation. Versions live on the `gh-pages` branch and are served by GitHub Pages.

### First-time setup

```bash
pip install -r requirements.txt
git checkout main
git pull

# Deploy version 0.1 as both latest and stable
mike deploy --push --update-aliases 0.1 latest stable
mike set-default --push stable
```

### Publishing subsequent versions

```bash
# Always publish the main branch as the new version
mike deploy --push --update-aliases <version> latest

# When a version becomes the new stable cut
mike deploy --push --update-aliases <version> stable
```

### Listing and inspecting versions

```bash
mike list              # show all published versions
mike serve             # preview locally
```

### Removing a version

```bash
mike delete --push <version>
```

### CI automation

CI does not currently publish versions automatically. Future automation (a GitHub Action triggered by tags) is tracked as a separate story.

## License

Apache 2.0 — see [LICENSE](LICENSE).
