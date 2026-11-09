
DB_USER="postgres"
DB_NAME="biletflow_db"
BACKUP_DIR="./backups"

PG_DUMP="/Applications/Postgres.app/Contents/Versions/latest/bin/pg_dump"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql"

echo "Создание бэкапа базы данных ${DB_NAME}"

"$PG_DUMP" -U "$DB_USER" -d "$DB_NAME" -F p -b -v -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Бэкап успешно создан: $BACKUP_FILE"
    find "$BACKUP_DIR" -type f -name "*.sql" -mtime +7 -exec rm {} \;
else
    echo "Ошибка при создании бэкапа" >&2
    exit 1
fi