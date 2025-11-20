# Автоматична синхронизация AIRIS

## Настройка на автоматична синхронизация

Проектът е конфигуриран за автоматично синхронизиране между Spark environment и GitHub репозиторито `airis1.0`.

### Метод 1: GitHub Actions (Автоматично при push)

1. **Създайте Personal Access Token:**
   - Отидете на https://github.com/settings/tokens
   - Generate new token (classic)
   - Изберете scope: `repo` (Full control of private repositories)
   - Копирайте token-а

2. **Добавете Secret в репозиторито:**
   - Отидете на https://github.com/Radilovk/airis1.0/settings/secrets/actions
   - New repository secret
   - Name: `SYNC_TOKEN`
   - Value: вашият token

3. **Готово!** При всеки commit в `main` branch, промените автоматично се синхронизират.

### Метод 2: Ръчна синхронизация (Локален script)

Изпълнете в терминала:

```bash
./sync-to-repo.sh
```

Този script:
- ✅ Автоматично добавя всички промени
- ✅ Commit-ва с последното Spark съобщение
- ✅ Push-ва към airis1.0 репозиторито
- ✅ Показва линк към промените

### Метод 3: Git Hook (При всеки commit)

Настройка на автоматично push при commit:

```bash
# Създайте post-commit hook
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
git push airis1.0 main --force 2>/dev/null || echo "Sync skipped"
EOF

chmod +x .git/hooks/post-commit
```

## Проверка на синхронизацията

След промени, проверете:
- Local: `git log --oneline -5`
- Remote: https://github.com/Radilovk/airis1.0/commits/main

## Troubleshooting

### Ако синхронизацията не работи:

1. **Проверете remote:**
```bash
git remote -v
```

2. **Ръчно push:**
```bash
git push airis1.0 main --force
```

3. **Проверете token:**
```bash
git remote set-url airis1.0 https://TOKEN@github.com/Radilovk/airis1.0.git
```

## Структура

- `.github/workflows/auto-sync.yml` - GitHub Actions workflow
- `sync-to-repo.sh` - Ръчен sync script
- `.gitignore` - Минимални игнорирани файлове за пълен sync

Всички промени в Spark автоматично се прехвърлят без загуба на функционалност.
