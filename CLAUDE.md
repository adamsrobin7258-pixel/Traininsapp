# Kalethra – Hinweise für Claude Code

Verbindlicher Git-Ablauf für jede Phase: [README.md → Branch-Workflow](README.md#branch-workflow).

- **Vor Beginn:** Standard-Branch `claude/fitness-app-phase-1-dqkef9` holen, Commit und Version
  bestimmen und als Startpunkt im Bericht nennen; nur auf diesem Stand arbeiten.
- **Nach erfolgreichem Abschluss** (Tests, Build, CI grün, Commit und Version final): Feature-Branch
  pushen, dann den Standard-Branch **nur per Fast-Forward** (`git merge --ff-only`) nachziehen und
  pushen – ohne gesonderte Aufforderung. Kein Merge-Commit, kein Reset, kein Force-Push; geht kein
  Fast-Forward, Standard-Branch unverändert lassen und melden.
- Qualität vor jedem Commit: `npm run check`; Projektregeln siehe [README.md](README.md#beitrag-leisten).
